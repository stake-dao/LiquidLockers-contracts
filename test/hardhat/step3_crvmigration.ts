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

const SDVECRVWHALE1 = "0x82b8b659A4A98f69cB7899e1A07089EA3B90a894";
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
    proxyAdmin = await ethers.getContractAt("ProxyAdmin", PROXY_AD);
    sdtDProxy = await ethers.getContractAt("SdtDistributor", SDTD_PROXY);
    crvLocker = await ethers.getContractAt(CRVLOCKERABI, OLD_LOCKER);
    veBoostProxy = await ethers.getContractAt("veBoostProxy", VE_BOOST_PROXY);
    crvStrategyProxy = await ethers.getContractAt(STRATEGYPROXYABI, CRV_STRATEGY_PROXY);
    crv3 = await ethers.getContractAt(ERC20ABI, THREECRV);

    await network.provider.send("hardhat_setBalance", [sdtDeployer._address, parseEther("10").toHexString()]);
    await network.provider.send("hardhat_setBalance", [crvWhale._address, parseEther("10").toHexString()]);
    await network.provider.send("hardhat_setBalance", [sdVeCrvWhale1._address, parseEther("10").toHexString()]);

    // change the sdveCrv governance address to a EOA
    // the actual governance is a multisig contract, it should require some signers to execute it
    await network.provider.send("hardhat_setStorageAt", [
      sdVeCrv.address,
      "0x7",
      "0x000000000000000000000000b36a0671B3D49587236d7833B01E79798175875f"
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
      sdtDeployer._address,
      sdt.address,
      veSDTProxy.address,
      veBoostProxy.address,
      sdtDProxy.address
    ]);
    crvPPSGaugeProxy = await Proxy.connect(sdtDeployer).deploy(
      liquidityGauge.address,
      proxyAdmin.address,
      dataCrvGauge
    );
    crvPPSGaugeProxy = await ethers.getContractAt("LiquidityGaugeV4", crvPPSGaugeProxy.address);

    crvAcc = await Accumulator.connect(sdtDeployer).deploy(THREECRV);

    // change crvLocker strategy address to the crvDepositor
    await network.provider.send("hardhat_setStorageAt", [
      crvLocker.address,
      "0x1",
      "0x000000000000000000000000" + crvDepositor.address.substring(2)
    ]);

    // Setter functions
    await crvDepositor.connect(sdtDeployer).setGauge(crvPPSGaugeProxy.address);

    await sdCRVToken.connect(sdtDeployer).setOperator(crvDepositor.address);

    await crvAcc.connect(sdtDeployer).setLocker(OLD_LOCKER);
    await crvAcc.connect(sdtDeployer).setGauge(crvPPSGaugeProxy.address);

    await crvPPSGaugeProxy.connect(sdtDeployer).add_reward(crv3.address, crvAcc.address);
  });

  it("sdveCrv minting should be disable", async function () {
    const crvToDeposit = parseEther("10");
    await crv.connect(crvWhale).approve(sdVeCrv.address, crvToDeposit);
    await expect(sdVeCrv.connect(crvWhale).deposit(crvToDeposit)).to.be.reverted;
  });

  it("the balance sdCRV should be minted to DAO", async function () {
    const balance = await sdVeCrv.totalSupply(); // 2.737M sdveCrv
    var locked = await veCrv.locked(OLD_LOCKER); //3.358M crv
    var lockedAmount = locked["amount"];
    const daoBalance = await sdCRVToken.balanceOf(DAO); // 620K sdCrv
    expect(daoBalance).to.equal(lockedAmount.sub(balance));
  });

  it("user with sdVeCRV should be able to lock & receive equal amount in sdCRV", async function () {
    await sdVeCrv.connect(sdVeCrvWhale1).approve(crvDepositor.address, parseEther("1"));
    await crvDepositor.connect(sdVeCrvWhale1).lockSdveCrvToSdCrv(parseEther("1"));
    expect(await sdCRVToken.balanceOf(sdVeCrvWhale1._address)).to.equal(parseEther("1"));
  });

  it("user with sdVeCRV should be able to lock sdVeCRV a second time & receive equal amount in sdCRV", async function () {
    await sdVeCrv.connect(sdVeCrvWhale1).approve(crvDepositor.address, parseEther("1"));
    await crvDepositor.connect(sdVeCrvWhale1).lockSdveCrvToSdCrv(parseEther("1"));
    expect(await sdCRVToken.balanceOf(sdVeCrvWhale1._address)).to.equal(parseEther("2"));
  });

  it("user should be able to claim 3crv even after the migration", async function () {
    const crv3BalanceBefore = await crv3.balanceOf(sdVeCrvWhale1._address);
    await sdVeCrv.connect(sdVeCrvWhale1).claim();
    const crv3BalanceAfter = await crv3.balanceOf(sdVeCrvWhale1._address);
    expect(crv3BalanceAfter.sub(crv3BalanceBefore)).gt(0);
  });

  it("user should be able to deposit CRV to mint sdCRV, but neither lock and stake it", async function () {
    const amountToLock = parseEther("1");
    await crv.connect(crvWhale).approve(crvDepositor.address, amountToLock);
    const sdCRVBalanceBefore = await sdCRVToken.balanceOf(crvWhale._address);
    await crvDepositor.connect(crvWhale).deposit(amountToLock, false, false, crvWhale._address);
    const sdCRVBalanceAfter = await sdCRVToken.balanceOf(crvWhale._address);
    expect(sdCRVBalanceAfter.sub(sdCRVBalanceBefore)).gt(0);
    expect(await sdCRVToken.balanceOf(crvWhale._address)).to.gt(0);
    expect(await sdCRVToken.balanceOf(crvWhale._address)).to.lt(parseEther("1"));
  });

  it("user should be able to deposit CRV to mint sdCRV, and lock it but not stake", async function () {
    const amountToLock = parseEther("1");
    await crv.connect(crvWhale).approve(crvDepositor.address, amountToLock);
    const sdCRVBalanceBefore = await sdCRVToken.balanceOf(crvWhale._address);
    await crvDepositor.connect(crvWhale).deposit(amountToLock, true, false, crvWhale._address);
    const sdCRVBalanceAfter = await sdCRVToken.balanceOf(crvWhale._address);
    expect(sdCRVBalanceAfter.sub(sdCRVBalanceBefore)).eq(amountToLock.add(parseEther("0.001")));
  });

  it("user should be able to deposit CRV to mint sdCRV, and lock, stake them", async function () {
    const amountToLock = parseEther("1");
    await crv.connect(crvWhale).approve(crvDepositor.address, amountToLock);
    const sdCRVBalanceBefore = await sdCRVToken.balanceOf(crvWhale._address);
    await crvDepositor.connect(crvWhale).deposit(amountToLock, true, true, crvWhale._address);
    const sdCRVBalanceAfter = await sdCRVToken.balanceOf(crvWhale._address);
    expect(sdCRVBalanceAfter.sub(sdCRVBalanceBefore)).eq(0);
    const gaugeBalance = await sdCRVToken.balanceOf(crvPPSGaugeProxy.address);
    expect(gaugeBalance).to.equal(amountToLock);
  });

  it("should claim 3crv via the strategyProxy and send them to the accumulator", async function () {
    // simulate new reward
    await crv3.connect(crv3Whale).transfer(CRV_FEE_D, parseEther("10000"));
    // change crvLocker strategy address to the crvStrategyProxy
    await network.provider.send("hardhat_setStorageAt", [
      crvLocker.address,
      "0x1",
      "0x000000000000000000000000" + crvStrategyProxy.address.substring(2)
    ]);

    await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 3]); // + 12 hours
    await network.provider.send("evm_mine", []);

    await crvStrategyProxy.connect(sdtDeployer).setSdveCRV(sdtDeployer._address);
    await crvStrategyProxy.connect(sdtDeployer).claim(crvAcc.address);
    const crv3Balance = await crv3.balanceOf(crvAcc.address);
    expect(crv3Balance).gt(0);
  });

  it("should notify 3crv to the LGV4", async function () {
    const crv3BalanceBefore = await crv3.balanceOf(crvAcc.address);
    await crvAcc.notifyAll();
    const crv3BalanceAfter = await crv3.balanceOf(crvAcc.address);
    expect(crv3BalanceAfter).eq(0);
    const crv3BalanceGauge = await crv3.balanceOf(crvPPSGaugeProxy.address);
    expect(crv3BalanceGauge).eq(crv3BalanceBefore);
  });

  it("should claim 3crv reward from LGV4", async function () {
    await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 3]); // + 12 hours
    await network.provider.send("evm_mine", []);

    const crv3BalanceBefore = await crv3.balanceOf(crvWhale._address);
    await crvPPSGaugeProxy.connect(crvWhale)["claim_rewards()"]();
    const crv3BalanceAfter = await crv3.balanceOf(crvWhale._address);
    expect(crv3BalanceAfter.sub(crv3BalanceBefore)).gt(0);
  });
});
