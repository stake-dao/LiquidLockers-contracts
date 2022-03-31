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
import STRATEGYPROXYABI from "./fixtures/StrategyProxy.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "@ethersproject/units";

const SDVECRVWHALE1 = "0xb0e83c2d71a991017e0116d58c5765abc57384af";
const SDVECRVWHALE2 = "0xddb50ffdba4d89354e1088e4ea402de895562173";
const CRVWHALE = "0x7a16ff8270133f063aab6c9977183d9e72835428";
const CRV3_WHALE = "0x701aEcF92edCc1DaA86c5E7EdDbAD5c311aD720C";
const DAO = "0xF930EBBd05eF8b25B1797b9b2109DDC9B0d43063";
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

const VE_BOOST_PROXY = "0xD67bdBefF01Fc492f1864E61756E5FBB3f173506";

const CRV_FEE_D = "0xA464e6DCda8AC41e03616F95f4BC98a13b8922Dc";

describe("CRV Migration", function () {
  let sdVeCrvWhale1: JsonRpcSigner;
  let sdVeCrvWhale2: JsonRpcSigner;
  let crvWhale: JsonRpcSigner;
  let sdtDeployer: JsonRpcSigner;
  let crv3Whale: JsonRpcSigner;
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
  let crvStrategyProxy: Contract;
  let crv3: Contract;

  before(async function () {
    //this.enableTimeouts(false);
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
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [CRV3_WHALE]
    });

    sdVeCrvWhale1 = ethers.provider.getSigner(SDVECRVWHALE1);
    sdVeCrvWhale2 = ethers.provider.getSigner(SDVECRVWHALE2);
    crvWhale = ethers.provider.getSigner(CRVWHALE);
    sdtDeployer = ethers.provider.getSigner(SDT_DEPLOYER);
    crv3Whale = ethers.provider.getSigner(CRV3_WHALE);
    crv = await ethers.getContractAt(ERC20ABI, CRV);
    sdVeCrv = await ethers.getContractAt(SDVECRVABI, SDVECRV);
    veCrv = await ethers.getContractAt(VECRVABI, VECRV);
    sdt = await ethers.getContractAt(ERC20ABI, SDT);
    veSDTProxy = await ethers.getContractAt("veSDT", VESDTP);
    proxyAdmin = await ethers.getContractAt("ProxyAdmin", PROXY_AD)
    sdtDProxy = await ethers.getContractAt("SdtDistributor", SDTD_PROXY)
    crvLocker = await ethers.getContractAt(CRVLOCKERABI, OLD_LOCKER)
    veBoostProxy = await ethers.getContractAt("veBoostProxy", VE_BOOST_PROXY)
    crvStrategyProxy = await ethers.getContractAt(STRATEGYPROXYABI, CRV_STRATEGY_PROXY)
    crv3 = await ethers.getContractAt(ERC20ABI, THREECRV);

    await network.provider.send("hardhat_setBalance", [sdtDeployer._address, parseEther("10").toHexString()]);
    await network.provider.send("hardhat_setBalance", [crvWhale._address, parseEther("10").toHexString()]);
    await network.provider.send("hardhat_setBalance", [sdVeCrvWhale1._address, parseEther("10").toHexString()]);

    // change the sdveCrv governance address to a EOA
    // the actual governance is a multisig contract, it should require some signers to execute it
    await network.provider.send("hardhat_setStorageAt", [
      sdVeCrv.address,
      "0x7",
      "0x000000000000000000000000b36a0671B3D49587236d7833B01E79798175875f",
    ]);

    const SdCRVToken = await ethers.getContractFactory("sdCRV");
    const CrvDepositor = await ethers.getContractFactory("CrvDepositor");
    const LiquidityGauge = await ethers.getContractFactory("LiquidityGaugeV4");
    const Proxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
    const Accumulator = await ethers.getContractFactory("CurveAccumulator");

    // 1) sdveCrv setters
    // disable sdveCrv minting
    await sdVeCrv.connect(sdtDeployer).setProxy("0x0000000000000000000000000000000000000000");
    // disable fee claim
    await sdVeCrv.connect(sdtDeployer).setFeeDistribution("0x0000000000000000000000000000000000000000");

    // 2) New contracts to deploy
    sdCRVToken = await SdCRVToken.connect(sdtDeployer).deploy("Stake DAO CRV", "sdCRV");

    crvDepositor = await CrvDepositor.connect(sdtDeployer).deploy(crv.address, OLD_LOCKER, sdCRVToken.address);
    liquidityGauge = await LiquidityGauge.connect(sdtDeployer).deploy();

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
    crvPPSGaugeProxy = await Proxy.connect(sdtDeployer).deploy(liquidityGauge.address, proxyAdmin.address, dataCrvGauge);
    crvPPSGaugeProxy = await ethers.getContractAt("LiquidityGaugeV4", crvPPSGaugeProxy.address);

    crvAcc = await Accumulator.connect(sdtDeployer).deploy(THREECRV);

    // change crvLocker strategy address to the crvDepositor
    await network.provider.send("hardhat_setStorageAt", [
      crvLocker.address,
      "0x1",
      "0x000000000000000000000000" + crvDepositor.address.substring(2),
    ]);
    
    // Setter functions
    await crvDepositor.setGauge(crvPPSGaugeProxy.address);

    await sdCRVToken.setOperator(crvDepositor.address);

    await crvAcc.setLocker(OLD_LOCKER);
    await crvAcc.setGauge(crvPPSGaugeProxy.address);

    await crvPPSGaugeProxy.add_reward(crv3.address, crvAcc.address);
  });

  it("sdveCrv minting should be disable", async function () {
    //this.enableTimeouts(false);
    const crvToDeposit = parseEther("10");
    await crv.connect(crvWhale).approve(sdVeCrv.address, crvToDeposit);
    await expect(sdVeCrv.connect(crvWhale).deposit(crvToDeposit)).to.be.reverted;
  });

  it("the balance sdCRV should be minted to DAO", async function () {
    const balance = await sdVeCrv.totalSupply();
    var locked = await veCrv.locked(OLD_LOCKER);
    var lockedAmount = locked["amount"];
    const daoBalance = await sdCRVToken.balanceOf(DAO) // 620K sdCrv
    expect(daoBalance).to.equal(lockedAmount.sub(balance));
  });

  it("user with sdVeCRV should be able to lock & receive equal amount in sdCRV", async function () {
    //this.enableTimeouts(false);
    await sdVeCrv.connect(sdVeCrvWhale1).approve(crvDepositor.address, parseEther("1"));
    await crvDepositor.connect(sdVeCrvWhale1).lockSdveCrvToSdCrv(parseEther("1"));
    expect(await sdCRVToken.balanceOf(crvDepositor.address)).to.equal(parseEther("1"));
  });

  it("user with sdVeCRV should be able to lock sdVeCRV a second time & receive equal amount in sdCRV", async function () {
    //this.enableTimeouts(false);
    await sdVeCrv.connect(sdVeCrvWhale1).approve(crvDepositor.address, parseEther("1"));
    await crvDepositor.connect(sdVeCrvWhale1).lockSdveCrvToSdCrv(parseEther("1"));
    expect(await sdCRVToken.balanceOf(crvDepositor.address)).to.equal(parseEther("2"));
  });

  it("user should be able to deposit CRV", async function () {
    const amountToLock = parseEther("1");
    await crv.connect(crvWhale).approve(crvDepositor.address, amountToLock);
    await crvDepositor.connect(crvWhale).deposit(amountToLock, true, true, crvWhale._address);
    expect(await sdCRVToken.balanceOf(crvWhale._address)).to.equal(0);
    const lockerBalance = await sdCRVToken.balanceOf(crvLocker.address);
    expect(lockerBalance).to.equal(0);
    const gaugeBalance = await sdCRVToken.balanceOf(crvPPSGaugeProxy.address);
    expect(gaugeBalance).to.equal(amountToLock);
  });

  it("should claim 3crv via the strategyProxy and send them to the accumulator", async function () {

    // change crvLocker strategy address to the crvDepositor
    await network.provider.send("hardhat_setStorageAt", [
      crvLocker.address,
      "0x1",
      "0x000000000000000000000000" + crvStrategyProxy.address.substring(2),
    ]);

    await network.provider.send("evm_increaseTime", [60 * 60 * 12]); // + 12 hours
    await network.provider.send("evm_mine", []);

    await crvStrategyProxy.connect(sdtDeployer).setSdveCRV(sdtDeployer._address);
    await crvStrategyProxy.connect(sdtDeployer).claim(crvAcc.address);
    const crv3Balance = await crv3.balanceOf(crvAcc.address)
    expect(crv3Balance).gt(parseEther("8500"))
  });

  it("should notify 3crv to the LGV4", async function () {
    const crv3BalanceBefore = await crv3.balanceOf(crvAcc.address);
    await crvAcc.notifyAll();
    const crv3BalanceAfter = await crv3.balanceOf(crvAcc.address);
    expect(crv3BalanceAfter).eq(0);
    const crv3BalanceGauge = await crv3.balanceOf(crvPPSGaugeProxy.address);
    expect(crv3BalanceGauge).eq(crv3BalanceBefore);
  });
});