import { ethers, network } from "hardhat";
import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import { JsonRpcSigner } from "@ethersproject/providers";

import ERC20 from "./fixtures/ERC20.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";

const SDTWHALE = "0x48238Faf05BF8B745249dB3c26606A72149600B8";
const SDT = "0x73968b9a57c6e53d41345fd57a6e6ae27d6cdb2f";
const VESDTP = "0x0C30476f66034E11782938DF8e4384970B6c9e8a";

const sdFXS = "0x402F878BDd1f5C66FdAF0fabaBcF74741B68ac36"; // sdFXS
const sdANGLE = "0x752B4c6e92d96467fE9b9a2522EF07228E00F87c"; // sdANGLE

const MASTERCHEF = "0xfEA5E213bbD81A8a94D0E1eDB09dBD7CEab61e1c";
const SWW = "0x37E8386602d9EBEa2c56dd11d8E142290595f1b5"; // SmartWalletWhitelist 

const getNow = async function () {
  let blockNum = await ethers.provider.getBlockNumber();
  let block = await ethers.provider.getBlock(blockNum);
  var time = block.timestamp;
  return time;
};

describe("veSDT voting", () => {
  let sdt: Contract;
  let veSDTProxy: Contract;
  let gc: Contract;
  let lgv4FXSLogic: Contract;
  let fxsPPSGauge: Contract;
  let lgv4ANGLELogic: Contract;
  let anglePPSGauge: Contract;
  let proxyAdmin: Contract;
  let sww: Contract;
  let sdtDistributor: Contract;
  let sdtDProxy: Contract;
  let veBoost: Contract;
  let veBoostProxy: Contract;
  let sdtWhaleSigner: JsonRpcSigner;
  let deployer: SignerWithAddress;

  before(async function () {
    this.enableTimeouts(false);

    [deployer] = await ethers.getSigners();

    sdt = await ethers.getContractAt(ERC20, SDT);
    sww = await ethers.getContractAt("SmartWalletWhitelist", SWW);
    veSDTProxy = await ethers.getContractAt("veSDT", VESDTP);

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SDTWHALE]
    });

    sdtWhaleSigner = await ethers.provider.getSigner(SDTWHALE);
    await network.provider.send("hardhat_setBalance", [sdtWhaleSigner._address, parseEther("10").toHexString()]);

    const GaugeController = await ethers.getContractFactory("GaugeController");
    const LiquidityGaugeV4 = await ethers.getContractFactory("LiquidityGaugeV4");
    const SdtDistributor = await ethers.getContractFactory("SdtDistributor2"); 
    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    const Proxy  = await ethers.getContractFactory("TransparentUpgradeableProxy");
    const VeBoost = await ethers.getContractFactory("veBoost");
    const VeBoostProxy = await ethers.getContractFactory("veBoostProxy");

    // Deploy 
    gc = await GaugeController.connect(deployer).deploy(sdt.address, veSDTProxy.address, deployer.address);
    proxyAdmin = await ProxyAdmin.deploy();

    // Contracts upgradeable
    sdtDistributor = await SdtDistributor.deploy();
    lgv4FXSLogic = await LiquidityGaugeV4.deploy();
    lgv4ANGLELogic = await LiquidityGaugeV4.deploy();

    veBoostProxy = await VeBoostProxy.deploy(veSDTProxy.address, deployer.address, deployer.address);
    veBoost = await VeBoost.deploy(deployer.address, veSDTProxy.address, "veboost delegation", "veBoost", "ipfs://")

    let ABI_LGV4 = [
      "function initialize(address _staking_token, address _admin, address _SDT, address _voting_escrow, address _veBoost_proxy, address _distributor)"
    ];
    let iface_gv4 = new ethers.utils.Interface(ABI_LGV4);
    const dataFxsGauge = iface_gv4.encodeFunctionData("initialize", [sdFXS, proxyAdmin.address, sdt.address, veSDTProxy.address, veBoostProxy.address, deployer.address]);
    const dataAngleGauge = iface_gv4.encodeFunctionData("initialize", [sdANGLE, proxyAdmin.address, sdt.address, veSDTProxy.address, veBoostProxy.address, deployer.address]);

    let ABI_SDTD = [
      "function initialize(address _rewardToken, address _controller, address _masterchef, address governor, address guardian, address _delegate_gauge)"
    ];
    let iface = new ethers.utils.Interface(ABI_SDTD);
    const dataSdtD = iface.encodeFunctionData("initialize", [sdt.address,  gc.address,  MASTERCHEF, deployer.address, deployer.address, deployer.address]);

    fxsPPSGauge = await Proxy.connect(deployer).deploy(lgv4FXSLogic.address, proxyAdmin.address, dataFxsGauge);
    anglePPSGauge = await Proxy.connect(deployer).deploy(lgv4ANGLELogic.address, proxyAdmin.address, dataAngleGauge);
    sdtDProxy = await Proxy.connect(deployer).deploy(sdtDistributor.address, proxyAdmin.address, dataSdtD);

    // Add gauge types
    await gc.connect(deployer)["add_type(string,uint256)"]("Mainnet staking", parseEther("1")); // 0

    // add FXS and ANGLE gauges into gaugeController
    await gc.connect(deployer)["add_gauge(address,int128,uint256)"](fxsPPSGauge.address, 0, 0);
    await gc.connect(deployer)["add_gauge(address,int128,uint256)"](anglePPSGauge.address, 0, 0);

    // Lock SDT for 4 years
    const sdtToLock = parseEther("10");
    const unlockTime = 60 * 60 * 24 * 365 * 4; // 4 years
    await sdt.connect(sdtWhaleSigner).approve(veSDTProxy.address, sdtToLock);
    await veSDTProxy.connect(sdtWhaleSigner).create_lock(sdtToLock, await getNow() + unlockTime);
  });

  describe("voting", async () => {
    it("should vote for a gauge", async () => {
      const wholePercent = 10000;
      const veSDTBalance = await veSDTProxy["balanceOf(address)"](sdtWhaleSigner._address);
      // vote
      await gc.connect(sdtWhaleSigner).vote_for_gauge_weights(anglePPSGauge.address, wholePercent / 2);
      await gc.connect(sdtWhaleSigner).vote_for_gauge_weights(fxsPPSGauge.address, wholePercent / 2 );
      // check vote correctness
      const angleGW = await gc.get_gauge_weight(anglePPSGauge.address);
      const fxsGW = await gc.get_gauge_weight(fxsPPSGauge.address);
      expect(angleGW).to.be.eq(fxsGW);
    });
  });

  describe("SdtDistributor", async () => {
    it("should distribute reward", async () => {

    });
  });
});