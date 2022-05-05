import { ethers, network } from "hardhat";
import { expect } from "chai";

import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { JsonRpcSigner } from "@ethersproject/providers";

import ERC20ABI from "./fixtures/ERC20.json";
import VECRVABI from "./fixtures/veCRV.json";
import SDVECRVABI from "./fixtures/sdVeCrv.json";
import WalletCheckerABI from "./fixtures/WalletChecker.json";
import VeFXSABI from "./fixtures/veFXS.json";
import CRVLOCKERABI from "./fixtures/crvLocker.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "@ethersproject/units";

const SDVECRVWHALE1 = "0xb0e83c2d71a991017e0116d58c5765abc57384af";
const SDVECRVWHALE2 = "0xddb50ffdba4d89354e1088e4ea402de895562173";
const CRVWHALE = "0x7a16ff8270133f063aab6c9977183d9e72835428";
const DAO = "0x2d95A6D0ee4cD129f8f0b0ec91961D51Fb33fFd6";
const CRV = "0xD533a949740bb3306d119CC777fa900bA034cd52";
const SDVECRV = "0x478bBC744811eE8310B461514BDc29D03739084D";
const VECRV = "0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2";
const OLD_LOCKER = "0x52f541764E6e90eeBc5c21Ff570De0e2D63766B6";
const SDVECRV_GOVERNANCE_MULTI = "0xF930EBBd05eF8b25B1797b9b2109DDC9B0d43063";
const SDT_DEPLOYER = "0xb36a0671B3D49587236d7833B01E79798175875f";

const ACC = "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0"; // StakeDAO multisig
const SDT = "0x73968b9a57c6e53d41345fd57a6e6ae27d6cdb2f";

const RANDOM = "0x478bBC744811eE8310B461514BDc29D03739084D";
const VESDTP = "0x0C30476f66034E11782938DF8e4384970B6c9e8a";

const PROXY_AD = "0xfE612c237A81527a86f2Cac1FD19939CF4F91B9B";

const THREECRV = "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490";

const SDTD_PROXY = "0x06F66Bc79aeD1b49a393bF5fcF68a70499A2B5DC";

const CRV_STRATEGY_PROXY = "0xF34Ae3C7515511E29d8Afe321E67Bdf97a274f1A";

describe("CRV Migration", function () {
  let sdVeCrvWhale1: JsonRpcSigner;
  let sdVeCrvWhale2: JsonRpcSigner;
  let crvWhale: JsonRpcSigner;
  let sdtDeployer: JsonRpcSigner;
  let deployer: SignerWithAddress;
  let crvDepositor: Contract;
  let crv: Contract;
  let sdCRVToken: Contract;
  let sdVeCrv: Contract;
  let veCrv: Contract;
  let liquidityGauge: Contract;
  let crvPPSGaugeProxy: Contract;
  let sdt: Contract;
  let veSDTProxy: Contract;
  let veBoostProxy: Contract;
  let proxyAdmin: Contract;
  let sdtDProxy: Contract;
  let crvAcc: Contract;
  let crvLocker: Contract;

  before(async function () {
    //this.timeout(0);
    [deployer] = await ethers.getSigners();
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SDVECRVWHALE1]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SDVECRVWHALE2]
    });
    await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [CRVWHALE]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SDT_DEPLOYER]
    });

    sdVeCrvWhale1 = ethers.provider.getSigner(SDVECRVWHALE1);
    sdVeCrvWhale2 = ethers.provider.getSigner(SDVECRVWHALE2);
    crvWhale = ethers.provider.getSigner(CRVWHALE);
    sdtDeployer = ethers.provider.getSigner(SDT_DEPLOYER);
    crv = await ethers.getContractAt(ERC20ABI, CRV);
    sdVeCrv = await ethers.getContractAt(SDVECRVABI, SDVECRV);
    veCrv = await ethers.getContractAt(VECRVABI, VECRV);
    sdt = await ethers.getContractAt(ERC20ABI, SDT);
    veSDTProxy = await ethers.getContractAt("veSDT", VESDTP);
    proxyAdmin = await ethers.getContractAt("ProxyAdmin", PROXY_AD)
    sdtDProxy = await ethers.getContractAt("SdtDistributor", SDTD_PROXY)
    crvLocker = await ethers.getContractAt(CRVLOCKERABI, OLD_LOCKER)

    // change the sdveCrv governance address to a EOA
    // the actual governance is a multisig contract, it should require some signers to execute it
    await network.provider.send("hardhat_setStorageAt", [
      sdVeCrv.address,
      "0x7",
      "0x000000000000000000000000b36a0671B3D49587236d7833B01E79798175875f",
    ]);
    
    // change crvLocker governance
    // await network.provider.send("hardhat_setStorageAt", [
    //   crvLocker.address,
    //   "0x0",
    //   "0x000000000000000000000000b36a0671B3D49587236d7833B01E79798175875f",
    // ]);

    const SdCRVToken = await ethers.getContractFactory("sdCRV");
    const CrvDepositor = await ethers.getContractFactory("CrvDepositor");
    const LiquidityGauge = await ethers.getContractFactory("LiquidityGaugeV4");
    const VeBoostProxy = await ethers.getContractFactory("veBoostProxy");
    const Proxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
    //const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    const Accumulator = await ethers.getContractFactory("CurveAccumulator");

    // 1) sdveCrv setters
    // disable sdveCrv minting
    await sdVeCrv.connect(sdtDeployer).setProxy("0x0000000000000000000000000000000000000000");
    // disable fee claim
    await sdVeCrv.connect(sdtDeployer).setFeeDistribution("0x0000000000000000000000000000000000000000");

    // 2) New contracts to deploy
    sdCRVToken = await SdCRVToken.deploy("Stake DAO CRV", "sdCRV");

    crvDepositor = await CrvDepositor.deploy(crv.address, OLD_LOCKER, sdCRVToken.address);
    veBoostProxy = await VeBoostProxy.deploy(
      veSDTProxy.address,
      "0x0000000000000000000000000000000000000000",
      deployer.address
    );
    liquidityGauge = await LiquidityGauge.deploy();

    let ABI_LGV4 = [
      "function initialize(address _staking_token, address _admin, address _SDT, address _voting_escrow, address _veBoost_proxy, address _distributor)"
    ];
    let iface_gv4 = new ethers.utils.Interface(ABI_LGV4);
    const dataCrvGauge = iface_gv4.encodeFunctionData("initialize", [
      sdCRVToken.address,
      deployer.address,
      sdt.address,
      veSDTProxy.address,
      veBoostProxy.address,
      sdtDProxy.address
    ]);
    crvPPSGaugeProxy = await Proxy.connect(deployer).deploy(liquidityGauge.address, proxyAdmin.address, dataCrvGauge);

    crvAcc = await Accumulator.deploy(THREECRV);

    // change crvLocker strategy address to the crvAccumulator
    await network.provider.send("hardhat_setStorageAt", [
      crvLocker.address,
      "0x1",
      "0x000000000000000000000000" + crvAcc.address.substring(2),
    ]);

    //await crvDepositor.setGauge(liquidityGauge.address);

    await sdCRVToken.setOperator(crvDepositor.address);

    await crvAcc.setLocker(OLD_LOCKER);
    await crvAcc.setGauge(liquidityGauge.address);
  });

  it("sdveCrv minting should be disable", async function () {
    //this.timeout(0);
    const crvToDeposit = parseEther("10");
    await crv.connect(crvWhale).approve(sdVeCrv.address, crvToDeposit);
    await expect(sdVeCrv.connect(crvWhale).deposit(crvToDeposit)).to.be.reverted;
  });

  it("the balance sdCRV should be minted to DAO", async function () {
    const balance = await sdVeCrv.totalSupply();
    var locked = await veCrv.locked(OLD_LOCKER);
    var lockedAmount = locked["amount"];
    expect(await sdCRVToken.balanceOf(DAO)).to.equal(lockedAmount.sub(balance));
  });

  it("user with sdVeCRV should be able to lock & receive equal amount in sdCRV", async function () {
    //this.timeout(0);
    await sdVeCrv.connect(sdVeCrvWhale1).approve(crvDepositor.address, parseEther("1"));
    await crvDepositor.connect(sdVeCrvWhale1).lockSdveCrvToSdCrv(parseEther("1"));
    expect(await sdCRVToken.balanceOf(crvDepositor.address)).to.equal(parseEther("1"));
  });

  it("user with sdVeCRV should be able to lock sdVeCRV a second time & receive equal amount in sdCRV", async function () {
    //this.timeout(0);
    await sdVeCrv.connect(sdVeCrvWhale1).approve(crvDepositor.address, parseEther("1"));
    await crvDepositor.connect(sdVeCrvWhale1).lockSdveCrvToSdCrv(parseEther("1"));
    expect(await sdCRVToken.balanceOf(crvDepositor.address)).to.equal(parseEther("2"));
  });

  it("user should be able to deposit CRV", async function () {
    await crv.connect(crvWhale).approve(crvDepositor.address, parseEther("1"));
    await crvDepositor.connect(crvWhale).deposit(parseEther("1"), false, false, crvWhale._address);
    expect(await sdCRVToken.balanceOf(crvWhale._address)).to.equal(parseEther("0.999"));
  });

  it("should claim fees from the accumulator", async function () {
    //await crvLocker.connect(sdtDeployer).setStrategy(crvAcc.address);
    const strategy = await crvLocker.strategy();
    console.log(strategy)
    await crvAcc.notifyAll();
    //await crvDepositor.connect(crvWhale).deposit(parseEther("1"), false, false, crvWhale._address);
    //expect(await sdCRVToken.balanceOf(crvWhale._address)).to.equal(parseEther("0.999"));
  });
});