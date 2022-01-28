import { ethers, network } from "hardhat";
import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import { JsonRpcSigner } from "@ethersproject/providers";

import ERC20 from "./fixtures/ERC20.json";
import MASTERCHEFABI from "./fixtures/Masterchef.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";

const SDTWHALE = "0x48238Faf05BF8B745249dB3c26606A72149600B8";
const SDT = "0x73968b9a57c6e53d41345fd57a6e6ae27d6cdb2f";
const VESDTP = "0x0C30476f66034E11782938DF8e4384970B6c9e8a";

const sdFXS = "0x402F878BDd1f5C66FdAF0fabaBcF74741B68ac36"; // sdFXS
const sdANGLE = "0x752B4c6e92d96467fE9b9a2522EF07228E00F87c"; // sdANGLE

const MASTERCHEF = "0xfEA5E213bbD81A8a94D0E1eDB09dBD7CEab61e1c";
const SWW = "0x37E8386602d9EBEa2c56dd11d8E142290595f1b5"; // SmartWalletWhitelist

const TIMELOCK = "0xD3cFc4E65a73BB6C482383EB38f5C3E1d1411616";

const sdFXSWHALE = "0xbd2471b4150619a42093ffba3a7af35335cec5b6";
const sdANGLEWHALE = "0xb36a0671b3d49587236d7833b01e79798175875f";

const getNow = async function () {
  let blockNum = await ethers.provider.getBlockNumber();
  let block = await ethers.provider.getBlock(blockNum);
  var time = block.timestamp;
  return time;
};

describe("veSDT voting", () => {
  let sdt: Contract;
  let sdfxs: Contract;
  let sdangle: Contract;
  let veSDTProxy: Contract;
  let gc: Contract;
  let lgv4FXSLogic: Contract;
  let fxsPPSGaugeProxy: Contract;
  let lgv4ANGLELogic: Contract;
  let anglePPSGaugeProxy: Contract;
  let proxyAdmin: Contract;
  let sww: Contract;
  let sdtDistributor: Contract;
  let sdtDProxy: Contract;
  let veBoost: Contract;
  let veBoostProxy: Contract;
  let masterchef: Contract;
  let timelock: JsonRpcSigner;
  let sdtWhaleSigner: JsonRpcSigner;
  let sdFXSWhaleSigner: JsonRpcSigner;
  let sdAngleWhaleSigner: JsonRpcSigner;
  let deployer: SignerWithAddress;

  before(async function () {
    this.enableTimeouts(false);

    [deployer] = await ethers.getSigners();

    sdt = await ethers.getContractAt(ERC20, SDT);
    sdfxs = await ethers.getContractAt(ERC20, sdFXS);
    sdangle = await ethers.getContractAt(ERC20, sdANGLE);
    sww = await ethers.getContractAt("SmartWalletWhitelist", SWW);
    veSDTProxy = await ethers.getContractAt("veSDT", VESDTP);
    masterchef = await ethers.getContractAt(MASTERCHEFABI, MASTERCHEF);

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SDTWHALE]
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [sdFXSWHALE]
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [sdANGLEWHALE]
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [TIMELOCK]
    });

    sdtWhaleSigner = await ethers.provider.getSigner(SDTWHALE);
    sdFXSWhaleSigner = await ethers.provider.getSigner(sdFXSWHALE);
    sdAngleWhaleSigner = await ethers.provider.getSigner(sdANGLEWHALE);
    timelock = await ethers.provider.getSigner(TIMELOCK);
    await network.provider.send("hardhat_setBalance", [sdtWhaleSigner._address, parseEther("10").toHexString()]);
    await network.provider.send("hardhat_setBalance", [timelock._address, parseEther("10").toHexString()]);

    const GaugeController = await ethers.getContractFactory("GaugeController");
    const LiquidityGaugeV4 = await ethers.getContractFactory("LiquidityGaugeV4");
    const SdtDistributor = await ethers.getContractFactory("SdtDistributor2");
    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    const Proxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
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
    veBoost = await VeBoost.deploy(deployer.address, veSDTProxy.address, "veboost delegation", "veBoost", "ipfs://");

    let ABI_SDTD = [
      "function initialize(address _rewardToken, address _controller, address _masterchef, address governor, address guardian, address _delegate_gauge)"
    ];
    let iface = new ethers.utils.Interface(ABI_SDTD);
    const dataSdtD = iface.encodeFunctionData("initialize", [
      sdt.address,
      gc.address,
      masterchef.address,
      deployer.address,
      deployer.address,
      deployer.address
    ]);

    sdtDProxy = await Proxy.connect(deployer).deploy(sdtDistributor.address, proxyAdmin.address, dataSdtD);
    sdtDProxy = await ethers.getContractAt("SdtDistributor2", sdtDProxy.address);

    let ABI_LGV4 = [
      "function initialize(address _staking_token, address _admin, address _SDT, address _voting_escrow, address _veBoost_proxy, address _distributor)"
    ];
    let iface_gv4 = new ethers.utils.Interface(ABI_LGV4);
    const dataFxsGauge = iface_gv4.encodeFunctionData("initialize", [
      sdFXS,
      proxyAdmin.address,
      sdt.address,
      veSDTProxy.address,
      veBoostProxy.address,
      sdtDProxy.address
    ]);
    const dataAngleGauge = iface_gv4.encodeFunctionData("initialize", [
      sdANGLE,
      proxyAdmin.address,
      sdt.address,
      veSDTProxy.address,
      veBoostProxy.address,
      sdtDProxy.address
    ]);

    fxsPPSGaugeProxy = await Proxy.connect(deployer).deploy(lgv4FXSLogic.address, proxyAdmin.address, dataFxsGauge);
    anglePPSGaugeProxy = await Proxy.connect(deployer).deploy(
      lgv4ANGLELogic.address,
      proxyAdmin.address,
      dataAngleGauge
    );

    // Add gauge types
    await gc.connect(deployer)["add_type(string,uint256)"]("Mainnet staking", parseEther("1")); // 0

    // add FXS and ANGLE gauges into gaugeController
    await gc.connect(deployer)["add_gauge(address,int128,uint256)"](fxsPPSGaugeProxy.address, 0, 0);
    await gc.connect(deployer)["add_gauge(address,int128,uint256)"](anglePPSGaugeProxy.address, 0, 0);

    // Lock SDT for 4 years
    const sdtToLock = parseEther("10");
    const unlockTime = 60 * 60 * 24 * 365 * 4; // 4 years
    await sdt.connect(sdtWhaleSigner).approve(veSDTProxy.address, sdtToLock);
    await veSDTProxy.connect(sdtWhaleSigner).create_lock(sdtToLock, (await getNow()) + unlockTime);

    /** Masterchef <> SdtDistributor setup */
    const masterToken = await sdtDProxy.masterchefToken();
    await masterchef.connect(timelock).add(1000, masterToken, false);
    const poolsLength = await masterchef.poolLength();
    const pidSdtD = poolsLength - 1;
    await sdtDProxy.connect(deployer).initializeMasterchef(pidSdtD);
    await sdtDProxy.connect(deployer).setDistribution(true);

    await sdfxs.connect(sdFXSWhaleSigner).transfer(SDTWHALE, parseEther("1"));
  });

  describe("voting", async () => {
    it("should vote for a gauge", async () => {
      const wholePercent = 10000;
      const veSDTBalance = await veSDTProxy["balanceOf(address)"](sdtWhaleSigner._address);
      // vote
      await gc.connect(sdtWhaleSigner).vote_for_gauge_weights(anglePPSGaugeProxy.address, 8000);
      await gc.connect(sdtWhaleSigner).vote_for_gauge_weights(fxsPPSGaugeProxy.address, 2000);
      // check vote correctness
      const angleGW = await gc.get_gauge_weight(anglePPSGaugeProxy.address);
      const fxsGW = await gc.get_gauge_weight(fxsPPSGaugeProxy.address);
      //expect(angleGW).to.be.eq(fxsGW);
    });
  });

  describe("SdtDistributor", async () => {
    it("should distribute rewards", async () => {
      await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 7]); // 1 week
      await network.provider.send("evm_mine", []);

      // await gc.checkpoint_gauge(fxsPPSGaugeProxy.address);
      // await gc.checkpoint_gauge(anglePPSGaugeProxy.address);

      await gc["gauge_relative_weight_write(address)"](fxsPPSGaugeProxy.address);
      await gc["gauge_relative_weight_write(address)"](anglePPSGaugeProxy.address);

      await sdtDProxy.distributeMulti([fxsPPSGaugeProxy.address]);

      const sdtAmountFxs = await sdt.balanceOf(fxsPPSGaugeProxy.address);
      const sdtAmountAngle = await sdt.balanceOf(anglePPSGaugeProxy.address);

      console.log("sdtAmountFxs", sdtAmountFxs.toString());
      console.log("sdtAmountAngle", sdtAmountAngle.toString());

      const sdtA = await sdt.balanceOf(sdtDProxy.address);
      console.log("sdt doistributor bamance", sdtA.toString());

      console.log("---------------------------------");
      console.log("---------------------------------");
      console.log("---------------------------------");

      await sdtDProxy.distributeMulti([anglePPSGaugeProxy.address]);

      const sdtAmountFxs2 = await sdt.balanceOf(fxsPPSGaugeProxy.address);
      const sdtAmountAngle2 = await sdt.balanceOf(anglePPSGaugeProxy.address);

      console.log("sdtAmountFxs2", sdtAmountFxs2.toString());
      console.log("sdtAmountAngle2", sdtAmountAngle2.toString());

      const sdtA2 = await sdt.balanceOf(sdtDProxy.address);
      console.log("sdt doistributor bamance2", sdtA2.toString());
    });

    it("user should be able to claim correct amount of rewards", async () => {
      // Users claim from frax, gauges, they should receive correct amount of SDT

      const fxsGauge = await ethers.getContractAt("LiquidityGaugeV4", fxsPPSGaugeProxy.address);

      console.log(await sdt.balanceOf(SDTWHALE));
      await sdfxs.connect(sdtWhaleSigner).approve(fxsGauge.address, parseEther("1"));

      await fxsGauge.connect(sdtWhaleSigner)["deposit(uint256)"](parseEther("1"));

      await fxsGauge.connect(sdtWhaleSigner)["claim_rewards()"]();
      console.log(await sdt.balanceOf(SDTWHALE));
    });
  });
});
