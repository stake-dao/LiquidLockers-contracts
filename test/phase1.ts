import { ethers, network } from "hardhat";
import { expect } from "chai";

import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { JsonRpcSigner } from "@ethersproject/providers";

import ERC20ABI from "./fixtures/ERC20.json";
import WalletCheckerABI from "./fixtures/WalletChecker.json";
import VeFXSABI from "./fixtures/veFXS.json";
import MasterchefABI from "./fixtures/Masterchef.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "@ethersproject/units";

const ONE_YEAR_IN_SECONDS = 24 * 3600 * 365;
const ONE_WEEK_IN_SECONDS = 86400;

const ETH_100 = BigNumber.from(10).mul(BigNumber.from(10).pow(18)).toHexString();

const SDTWHALE = "0x40FeD1b6f25DE00Ff9745E0158C333EB46d33A5D";
const FXS_HOLDER = "0xF977814e90dA44bFA03b6295A0616a897441aceC";
const FXS_HOLDER_2 = "0x5028D77B91a3754fb38B2FBB726AF02d1FE44Db6";
const SUSHI_HOLDER = "0xd96dd2337d964514eb7e2e50d8eea0d846fec960";

const FXS = "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0";
const VE_FXS = "0xc8418aF6358FFddA74e09Ca9CC3Fe03Ca6aDC5b0";
const SUSHI = "0x6b3595068778dd592e39a122f4f5a5cf09c90fe2";

const SDT = "0x73968b9a57c6E53d41345FD57a6E6ae27d6CDB2F";
const MASTERCHEF = "0xfEA5E213bbD81A8a94D0E1eDB09dBD7CEab61e1c";

const WALLET_CHECKER = "0x53c13BA8834a1567474b19822aAD85c6F90D9f9F";
const WALLET_CHECKER_OWNER = "0xb1748c79709f4ba2dd82834b8c82d4a505003f27";

const TIMELOCK = "0xD3cFc4E65a73BB6C482383EB38f5C3E1d1411616";

const YIELD_DISTRIBUTOR = "0xc6764e58b36e26b08Fd1d2AeD4538c02171fA872";
const FRAX_GAUGE_CONTROLLER = "0x44ade9AA409B0C29463fF7fcf07c9d3c939166ce";

const GAUGE = "0xEB81b86248d3C2b618CcB071ADB122109DA96Da2"; // sdFRAX3CRV LP gauge

const getNow = () => {
  return Math.round(Date.now() / 1000);
};

describe("FXS Depositor", function () {
  let locker: Contract;
  let fxs: Contract;
  let veFXS: Contract;
  let walletChecker: Contract;
  let gaugeProxyPPS: Contract;
  let masterchef: Contract;
  let veSDT: Contract;
  let sdt: Contract;
  let sushi: Contract;
  let fxsDepositor: Contract;
  let sushiDepositor: Contract;
  let accumulator: Contract;
  let sdFXSToken: Contract;
  let claimContract: Contract;
  let gaugeMultiRewardsPPS: Contract;
  let fxsHolder: JsonRpcSigner;
  let fxsHolder2: JsonRpcSigner;
  let sushiHolder: JsonRpcSigner;
  let walletCheckerOwner: JsonRpcSigner;
  let timelock: JsonRpcSigner;
  let sdtWhaleSigner: JsonRpcSigner;
  let deployer: SignerWithAddress;
  let baseOwner: SignerWithAddress;
  let randomLocker1: Contract;
  let randomLocker2: Contract;

  before(async function () {
    this.enableTimeouts(false);

    [deployer] = await ethers.getSigners();
    const temp = await ethers.getSigners();

    baseOwner = temp[0];

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [TIMELOCK]
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [FXS_HOLDER]
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [FXS_HOLDER_2]
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [WALLET_CHECKER_OWNER]
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SDTWHALE]
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SUSHI_HOLDER]
    });

    const FraxLocker = await ethers.getContractFactory("FraxLocker");
    const GaugeProxy = await ethers.getContractFactory("GaugeProxy");
    const VeSDT = await ethers.getContractFactory("veSDT");
    const FxsDepositor = await ethers.getContractFactory("FxsDepositor");
    const SushiDepositor = await ethers.getContractFactory("SushiDepositor");
    const FXSAccumulator = await ethers.getContractFactory("FXSAccumulator");
    const GaugeMultiRewardsPPS = await ethers.getContractFactory("GaugeMultiRewards");
    const SdFXSToken = await ethers.getContractFactory("sdFXSToken");
    const ClaimContract = await ethers.getContractFactory("ClaimContract");

    fxsHolder = ethers.provider.getSigner(FXS_HOLDER);
    fxsHolder2 = ethers.provider.getSigner(FXS_HOLDER_2);
    sushiHolder = ethers.provider.getSigner(SUSHI_HOLDER);
    walletCheckerOwner = ethers.provider.getSigner(WALLET_CHECKER_OWNER);
    timelock = ethers.provider.getSigner(TIMELOCK);
    sdtWhaleSigner = ethers.provider.getSigner(SDTWHALE);

    fxs = await ethers.getContractAt(ERC20ABI, FXS);
    sdt = await ethers.getContractAt(ERC20ABI, SDT);
    sushi = await ethers.getContractAt(ERC20ABI, SUSHI);
    veFXS = await ethers.getContractAt(VeFXSABI, VE_FXS);
    walletChecker = await ethers.getContractAt(WalletCheckerABI, WALLET_CHECKER);
    masterchef = await ethers.getContractAt(MasterchefABI, MASTERCHEF);

    await network.provider.send("hardhat_setBalance", [FXS_HOLDER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [TIMELOCK, ETH_100]);

    /** DEPLOYMENTS GLOBAL */
    veSDT = await VeSDT.deploy(SDT, "Voting Escrow SDT", "veSDT", "v1.0.0");
    sdFXSToken = await SdFXSToken.deploy();
    accumulator = await FXSAccumulator.deploy();
    locker = await FraxLocker.deploy(accumulator.address);
    //random locker used to simulate other locks
    randomLocker1 = await FraxLocker.deploy(accumulator.address);
    randomLocker2 = await FraxLocker.deploy(accumulator.address);
    fxsDepositor = await FxsDepositor.deploy(locker.address, sdFXSToken.address);
    sushiDepositor = await SushiDepositor.deploy(); // Only to mockup the depositFor call 
    gaugeProxyPPS = await GaugeProxy.deploy(MASTERCHEF, SDT, veSDT.address);
    gaugeMultiRewardsPPS = await GaugeMultiRewardsPPS.deploy(sdFXSToken.address, SDT, veSDT.address);
    claimContract = await ClaimContract.deploy();

    /** sdFXS */
    await sdFXSToken.mint(deployer.address, parseEther('10000'));
    await sdFXSToken.setOperator(fxsDepositor.address);

    /** Fxs Accumulator */
    await accumulator.setLocker(locker.address);
    await accumulator.setGauge(gaugeMultiRewardsPPS.address);

    //Should be done by FRAX team (whitelisting contract for creating a lock)
    await walletChecker.connect(walletCheckerOwner).approveWallet(locker.address);
    await walletChecker.connect(walletCheckerOwner).approveWallet(randomLocker1.address);
    await walletChecker.connect(walletCheckerOwner).approveWallet(randomLocker2.address);

    /** Fxs Lockers */
    await locker.setFxsDepositor(fxsDepositor.address);
    await randomLocker1.setFxsDepositor(fxsDepositor.address);
    await randomLocker2.setFxsDepositor(fxsDepositor.address);
    await fxs.connect(fxsHolder).transfer(randomLocker1.address, "1");
    await fxs.connect(fxsHolder).transfer(randomLocker2.address, "1");
    await randomLocker1.createLock("1", getNow() + ONE_WEEK_IN_SECONDS * 8);
    await randomLocker2.createLock("1", getNow() + ONE_YEAR_IN_SECONDS * 3);

    /** Fxs Depositor */
    await fxsDepositor.setGauge(gaugeMultiRewardsPPS.address);
    await sushiDepositor.setGauge(gaugeMultiRewardsPPS.address);

    /** Gauges */
    await gaugeProxyPPS.addGauge(sdFXSToken.address, gaugeMultiRewardsPPS.address);
    const gaugeTokens = await gaugeProxyPPS.tokens();
    expect(gaugeTokens.length).to.be.eq(1);
    const gaugeSdFXSToken = await gaugeProxyPPS.getGauge(sdFXSToken.address);
    expect(gaugeSdFXSToken).to.be.eq(gaugeMultiRewardsPPS.address);
    await gaugeMultiRewardsPPS.addReward(SDT, gaugeProxyPPS.address, 604800);
    await gaugeMultiRewardsPPS.addReward(FXS, accumulator.address, 604800);
    await gaugeMultiRewardsPPS.addReward(SUSHI, SUSHI_HOLDER, 604800);
    await gaugeMultiRewardsPPS.setClaimContract(claimContract.address);
    await gaugeMultiRewardsPPS.setRewardsDistributor(fxs.address, accumulator.address);
    await gaugeMultiRewardsPPS.setGovernance(deployer.address);
    await gaugeProxyPPS.setGovernance(deployer.address);
    const rewardsLenght = await gaugeMultiRewardsPPS.getRewardTokensLength();
    expect(rewardsLenght).to.be.eq(3);
    const rewardDurationFXS = await gaugeMultiRewardsPPS.getRewardForDuration(fxs.address);
    const rewardDurationSDT = await gaugeMultiRewardsPPS.getRewardForDuration(sdt.address);
    expect(rewardDurationFXS).to.be.eq(0);
    expect(rewardDurationSDT).to.be.eq(0);

    /** Claim contract */
    await claimContract.setDepositor(sdt.address, veSDT.address);
    await claimContract.setDepositor(fxs.address, fxsDepositor.address);
    await claimContract.setDepositorProxy(FXS_HOLDER);

    /** Masterchef <> GaugeProxy PPS setup */
    const masterTokenPPS = await gaugeProxyPPS.masterToken();
    await masterchef.connect(timelock).add(1000, masterTokenPPS, false);
    const poolLengthPPS = await masterchef.poolLength();
    const pidPPS = poolLengthPPS - 1;
    await gaugeProxyPPS.deposit(pidPPS);

    /** veSDT */
    await sdt.connect(sdtWhaleSigner).transfer(deployer.address, parseEther('1'));
    await sdt.approve(veSDT.address, parseEther('1'));
    await veSDT.create_lock(parseEther('1'), getNow() + ONE_YEAR_IN_SECONDS);
  });

  describe("sdFXS", function () {
    it("should change sdFXS operator via FxsDepositor", async function () {
      this.enableTimeouts(false);

      await fxsDepositor.setSdFXSOperator(FXS_HOLDER);
      const operator = await sdFXSToken.operator();

      expect(operator).to.be.equal(FXS_HOLDER);
    });

    it("should mint some sdFXS tokens", async function () {
      this.enableTimeouts(false);
      // 500 sdFXS
      const amount = parseEther("500");

      const sdFXSSuppyBefore = await sdFXSToken.totalSupply();
      const sdFXSBalanceBefore = await sdFXSToken.balanceOf(FXS_HOLDER);

      await (await sdFXSToken.connect(fxsHolder).mint(FXS_HOLDER, amount)).wait();

      const sdFXSBalanceAfter = await sdFXSToken.balanceOf(FXS_HOLDER);
      const sdFXSSuppyAfter = await sdFXSToken.totalSupply();

      expect(sdFXSSuppyAfter).to.be.equal(sdFXSSuppyBefore.add(amount));
      expect(sdFXSBalanceAfter).to.be.equal(sdFXSBalanceBefore.add(amount));
    });

    it("should burn some sdFXS tokens", async function () {
      this.enableTimeouts(false);
      // 500 sdFXS
      const amount = BigNumber.from("500000000000000000000");

      const sdFXSSuppyBefore = await sdFXSToken.totalSupply();
      const sdFXSBalanceBefore = await sdFXSToken.balanceOf(FXS_HOLDER);

      await (await sdFXSToken.connect(fxsHolder).burn(FXS_HOLDER, amount)).wait();

      const sdFXSBalanceAfter = await sdFXSToken.balanceOf(FXS_HOLDER);
      const sdFXSSuppyAfter = await sdFXSToken.totalSupply();

      expect(sdFXSSuppyBefore).to.be.equal(sdFXSSuppyAfter.add(amount));
      expect(sdFXSBalanceBefore).to.be.equal(sdFXSBalanceAfter.add(amount));

      // chainging sdFXS operator back to FxsDepoitor
      await (await sdFXSToken.connect(fxsHolder).setOperator(fxsDepositor.address)).wait();
    });
  });

  describe("FxsDepositor setters", function () {
    it("should check if all setters work correctly", async function () {
      this.enableTimeouts(false);

      await (await fxsDepositor.setGovernance(FXS_HOLDER)).wait();
      expect(await fxsDepositor.governance()).to.be.equal(FXS_HOLDER);
      await (await fxsDepositor.connect(fxsHolder).setGovernance(baseOwner.address)).wait();

      await (await fxsDepositor.setGauge(FXS_HOLDER)).wait();
      expect(await fxsDepositor.gauge()).to.be.equal(FXS_HOLDER);
      await (await fxsDepositor.setGauge(gaugeMultiRewardsPPS.address)).wait();

      await (await fxsDepositor.setRelock(false)).wait();
      expect(await fxsDepositor.relock()).to.be.equal(false);
      await (await fxsDepositor.setRelock(true)).wait();

      await (await fxsDepositor.setFees(20)).wait();
      expect(await fxsDepositor.lockIncentive()).to.be.equal(20);
      await (await fxsDepositor.setFees(10)).wait();

      await (await accumulator.setGovernance(FXS_HOLDER)).wait();
      expect(await accumulator.governance()).to.be.equal(FXS_HOLDER);
      await (await accumulator.connect(fxsHolder).setGovernance(baseOwner.address)).wait();
    });
  });

  describe("Lock", function () {
    it("should check if all setters work correctly", async function () {
      this.enableTimeouts(false);

      await (await locker.setGovernance(FXS_HOLDER)).wait();
      expect(await locker.governance()).to.be.equal(FXS_HOLDER);
      await (await locker.connect(fxsHolder).setGovernance(baseOwner.address)).wait();

      await (await locker.setYieldDistributor(FXS_HOLDER)).wait();
      expect(await locker.yieldDistributor()).to.be.equal(FXS_HOLDER);
      await (await locker.setYieldDistributor(YIELD_DISTRIBUTOR)).wait();

      await (await locker.setFxsDepositor(FXS_HOLDER)).wait();
      expect(await locker.fxsDepositor()).to.be.equal(FXS_HOLDER);
      await (await locker.setFxsDepositor(fxsDepositor.address)).wait();

      await (await locker.setGaugeController(FXS_HOLDER)).wait();
      expect(await locker.gaugeController()).to.be.equal(FXS_HOLDER);
      await (await locker.setGaugeController(FRAX_GAUGE_CONTROLLER)).wait();

      await (await locker.setAccumulator(FXS_HOLDER)).wait();
      expect(await locker.accumulator()).to.be.equal(FXS_HOLDER);
      await (await locker.setAccumulator(accumulator.address)).wait();
    });

    it("Should create a lock", async function () {
      this.enableTimeouts(false);
      const lockingAmount = BigNumber.from("1").mul(BigNumber.from(10).pow(18));
      const lockEnd = getNow() + ONE_YEAR_IN_SECONDS * 3;

      await (await fxs.connect(fxsHolder).transfer(locker.address, lockingAmount)).wait();
      await (await locker.createLock(lockingAmount, lockEnd)).wait();

      const veFXSLocked = await veFXS.locked(locker.address);
      const veFXSBalance = await veFXS["balanceOf(address)"](locker.address);

      expect(veFXSLocked.amount).to.be.equal(lockingAmount);

      // as curve doing modulo on thursday for locked end
      expect(veFXSBalance).to.be.gt(lockingAmount.mul(324).div(100));
      expect(veFXSBalance).to.be.lt(lockingAmount.mul(363).div(100));
    });

    it("Should increase locktime", async function () {
      this.enableTimeouts(false);
      const veFXSLocked = await veFXS.locked(locker.address);
      const unlockTime = parseInt(veFXSLocked.end) + ONE_YEAR_IN_SECONDS * 0.5;
      await (await locker.increaseUnlockTime(unlockTime)).wait();
      const veFXSLockedAfter = await veFXS.locked(locker.address);
      expect(veFXSLockedAfter.end).to.be.gt(veFXSLocked.end);
    });

    it("Should increase amount", async function () {
      this.enableTimeouts(false);
      const addedLockingAmount = BigNumber.from("1").mul(BigNumber.from(10).pow(18));
      await (await fxs.connect(fxsHolder).transfer(locker.address, addedLockingAmount)).wait();

      const veFXSLocked = await veFXS.locked(locker.address);
      await (await locker.increaseAmount(addedLockingAmount)).wait();
      const veFXSLockedAfter = await veFXS.locked(locker.address);

      expect(veFXSLockedAfter.amount).to.be.equal(veFXSLocked.amount.add(addedLockingAmount));
    });

    it("Should lock FXS", async function () {
      this.enableTimeouts(false);

      const lockingAmount = BigNumber.from("1").mul(BigNumber.from(10).pow(18));
      
      // Lock FXS already deposited into the Depositor if there is any
      await fxsDepositor.lockFXS();
      const fxsBalance = await fxs.balanceOf(fxsDepositor.address);
      expect(fxsBalance).to.be.equal(0);
    });

    it("Should deposit and lock FXS via FxsDepositor", async function () {
      this.enableTimeouts(false);

      const veFXSLocked = await veFXS.locked(locker.address);
      const userFxsBalanceBefore = await fxs.balanceOf(fxsHolder._address);
      console.log({
        veFXSLocked: veFXSLocked.amount.toString() / 1e18,
        userFxsBalanceBefore: userFxsBalanceBefore.toString() / 1e18
      });

      const addedLockingAmount = BigNumber.from("1000").mul(BigNumber.from(10).pow(18));
      await (await fxs.connect(fxsHolder).approve(fxsDepositor.address, addedLockingAmount)).wait();
      // lock -> false stake -> true
      await (await fxsDepositor.connect(fxsHolder).deposit(addedLockingAmount.div(2), false, true)).wait();
      // lock -> true stake -> true
      await (await fxsDepositor.connect(fxsHolder).deposit(addedLockingAmount.div(2), true, true)).wait();

      const veFXSLockedAfter = await veFXS.locked(locker.address);
      const userFxsBalanceAfter = await fxs.balanceOf(fxsHolder._address);
      const userSdFxsBalanceAfter = await gaugeMultiRewardsPPS.balanceOf(fxsHolder._address);
      console.log({
        veFXSLockedAfter: veFXSLockedAfter.amount.toString() / 1e18,
        userFxsBalanceAfter: userFxsBalanceAfter.toString() / 1e18,
        userSdFxsBalanceAfter: userSdFxsBalanceAfter.toString() / 1e18
      });

      expect(veFXSLockedAfter.amount).to.be.equal(veFXSLocked.amount.add(addedLockingAmount));
      expect(userFxsBalanceAfter).to.be.equal(userFxsBalanceBefore.sub(addedLockingAmount));
      expect(userSdFxsBalanceAfter).to.be.equal(addedLockingAmount);
    });

    it("Should deposit but neither lock nor stake FXS via FxsDepositor", async function () {
      this.enableTimeouts(false);

      const veFXSLocked = await veFXS.locked(locker.address);
      const userFxsBalanceBefore = await fxs.balanceOf(fxsHolder2._address);

      const fxsBalance = BigNumber.from("1000").mul(BigNumber.from(10).pow(18));
      await (await fxs.connect(fxsHolder2).approve(fxsDepositor.address, fxsBalance)).wait();
      // lock -> false stake -> false
      await (await fxsDepositor.connect(fxsHolder2).deposit(fxsBalance, false, false)).wait();

      const veFXSLockedAfter = await veFXS.locked(locker.address);
      const userFxsBalanceAfter = await fxs.balanceOf(fxsHolder2._address);
      const userSdFxsBalanceAfter = await sdFXSToken.balanceOf(fxsHolder2._address);

      expect(userFxsBalanceAfter).to.be.equal(userFxsBalanceBefore.sub(fxsBalance));
      // less than, coz incentive amount of sdFXS is deducted for this user as he's not locking
      expect(userSdFxsBalanceAfter).to.be.lt(fxsBalance);
    });

    it("depositFor", async function () {
      this.enableTimeouts(false);
      await sdt.connect(sdtWhaleSigner).transfer(deployer.address, "1000000000000000000000");

      const addedLockingAmount = parseEther("1");

      const sdFXSBalanceBefore = await sdFXSToken.balanceOf(gaugeMultiRewardsPPS.address);
      await (await fxs.approve(fxsDepositor.address, addedLockingAmount)).wait();

      await (await fxs.connect(fxsHolder).transfer(baseOwner.address, addedLockingAmount)).wait();

      await (await fxsDepositor.depositFor(fxsHolder.getAddress(), addedLockingAmount)).wait();
      const sdFXSBalanceAfter = await sdFXSToken.balanceOf(gaugeMultiRewardsPPS.address);
      // greater than, coz this user is locking all FXS in FxsDepositor, hence gets the incentive sdFXS
      expect(sdFXSBalanceAfter.sub(sdFXSBalanceBefore)).to.be.gt(addedLockingAmount);
    });

    it("Should depositAll and lock FXS via FxsDepositor", async function () {
      this.enableTimeouts(false);

      const veFXSLocked = await veFXS.locked(locker.address);
      const userFxsBalanceBefore = await fxs.balanceOf(fxsHolder2._address);
      console.log({
        veFXSLocked: veFXSLocked.amount.toString() / 1e18,
        userFxsBalanceBefore: userFxsBalanceBefore.toString() / 1e18
      });

      const fxsBalance = await fxs.balanceOf(fxsHolder2._address);
      await (await fxs.connect(fxsHolder2).approve(fxsDepositor.address, fxsBalance)).wait();
      // lock -> true stake -> false
      await (await fxsDepositor.connect(fxsHolder2).depositAll(true, true)).wait();

      const veFXSLockedAfter = await veFXS.locked(locker.address);
      const userFxsBalanceAfter = await fxs.balanceOf(fxsHolder2._address);
      const userSdFxsBalanceAfter = await gaugeMultiRewardsPPS.balanceOf(fxsHolder2._address);
      console.log({
        veFXSLockedAfter: veFXSLockedAfter.amount.toString() / 1e18,
        userFxsBalanceAfter: userFxsBalanceAfter.toString() / 1e18,
        userSdFxsBalanceAfter: userSdFxsBalanceAfter.toString() / 1e18
      });

      expect(veFXSLockedAfter.amount).to.be.equal(veFXSLocked.amount.add(fxsBalance));
      expect(userFxsBalanceAfter).to.be.equal(userFxsBalanceBefore.sub(fxsBalance));
      expect(userSdFxsBalanceAfter).to.be.equal(fxsBalance);
    });

    it("Should lock FXS", async function () {
      this.enableTimeouts(false);

      // Lock FXS already deposited into the Depositor if there is any
      const addedLockingAmount = BigNumber.from("1000").mul(BigNumber.from(10).pow(18));
      await (await fxs.connect(fxsHolder).approve(fxsDepositor.address, addedLockingAmount)).wait();
      // lock -> false stake -> true
      await (await fxsDepositor.connect(fxsHolder).deposit(addedLockingAmount, false, true)).wait();
      await fxsDepositor.lockFXS();
      const fxsBalance = await fxs.balanceOf(fxsDepositor.address);
      expect(fxsBalance).to.be.equal(0);
    });

    it("Should vote for a gauge via locker", async function () {
      this.enableTimeouts(0);
      const voteAmount = parseEther("0.5");
      await locker.voteGaugeWeight(GAUGE, 0);
    });

    it("Should execute any call via locker", async function() {
      const data = "0x" // empty
      const response = await locker.execute(
        accumulator.address,
        0,
        data 
      );
    });

    it("Should claim rewards", async function () {
      await network.provider.send("evm_increaseTime", [604800]); // 1 week
      await network.provider.send("evm_mine", []);

      const fxsBalanceBefore = await fxs.balanceOf(deployer.address);
      expect(fxsBalanceBefore).to.be.equal(0);
      await locker.claimFXSRewards(locker.governance());
      const fxsBalanceAfter = await fxs.balanceOf(deployer.address);
      expect(fxsBalanceAfter).to.be.gt(0);
    });

    it("Should accumulate FXS from PPS, strategies", async function () {
      await network.provider.send("evm_increaseTime", [604800]); // 1 week
      await network.provider.send("evm_mine", []);

      // simulating strategies sending FXS to accumulator
      await (await fxs.connect(fxsHolder).transfer(accumulator.address, "500000000000000000000")).wait();

      const fxsBalanceBefore = await fxs.balanceOf(gaugeMultiRewardsPPS.address);
      await (await accumulator.claimAndNotify()).wait();
      const fxsBalanceAfter = await fxs.balanceOf(gaugeMultiRewardsPPS.address);
      console.log({
        GaugeFXSBefore: fxsBalanceBefore.toString() / 1e18,
        GaugeFXSAfter: fxsBalanceAfter.toString() / 1e18
      });
      expect(fxsBalanceAfter).to.be.gte(fxsBalanceBefore.add(parseEther("500")));
      const totalSupply = await gaugeMultiRewardsPPS.totalSupply();
      expect(totalSupply).to.be.gt(0);
    });

    it("Should allow user to claim FXS from GaugeMultiRewards", async function () {
      await network.provider.send("evm_increaseTime", [604800]); // 1 week
      await network.provider.send("evm_mine", []);

      const sdtBalanceBefore = await sdt.balanceOf(fxsHolder._address);
      const fxsBalanceBefore = await fxs.balanceOf(fxsHolder._address);
      await (await gaugeMultiRewardsPPS.connect(fxsHolder).getReward()).wait();
      const sdtBalanceAfter = await sdt.balanceOf(fxsHolder._address);
      const fxsBalanceAfter = await fxs.balanceOf(fxsHolder._address);
      console.log({
        UserFXSBefore: fxsBalanceBefore.toString() / 1e18,
        UserFXSAfter: fxsBalanceAfter.toString() / 1e18,
        UserSDTBefore: sdtBalanceBefore.toString() / 1e18,
        UserSDTAfter: sdtBalanceAfter.toString() / 1e18
      });
      expect(fxsBalanceAfter).to.be.gt(fxsBalanceBefore);
    });

    it("Should release locked FXS", async function () {
      this.enableTimeouts(false);
      /* random release*/
      await network.provider.send("evm_increaseTime", [ONE_WEEK_IN_SECONDS]);
      await network.provider.send("evm_mine", []);
      await randomLocker1.release(deployer.address);
    });

    it("depositFor", async function () {
      this.enableTimeouts(false);
      await sdt.connect(sdtWhaleSigner).transfer(deployer.address, "1000000000000000000000");
      await (await sdt.approve(veSDT.address, "1000000000000000000000")).wait();
      let blockNum = await ethers.provider.getBlockNumber();
      let block = await ethers.provider.getBlock(blockNum);
      var time = block.timestamp;
      const addedLockingAmount = parseEther("1");
      const lockingAmount = parseEther("1");
      blockNum = await ethers.provider.getBlockNumber();
      block = await ethers.provider.getBlock(blockNum);
      time = block.timestamp;
      const lockEnd = time + ONE_YEAR_IN_SECONDS * 3;
      await (await fxs.transfer(locker.address, lockingAmount)).wait();
      const sdFXSBalanceBefore = await sdFXSToken.balanceOf(gaugeMultiRewardsPPS.address);
      await (await fxs.approve(fxsDepositor.address, addedLockingAmount)).wait();
      await (await fxsDepositor.depositFor(fxsHolder.getAddress(), addedLockingAmount)).wait();
      const sdFXSBalanceAfter = await sdFXSToken.balanceOf(gaugeMultiRewardsPPS.address);
      expect(sdFXSBalanceAfter.sub(sdFXSBalanceBefore)).to.be.equal(addedLockingAmount);
    });

    it("should vote with veSDT for 1 gauge", async function () {
      this.enableTimeouts(false);
      await gaugeProxyPPS.vote([await sdFXSToken.address], [1]);
      const usedWeights = await gaugeProxyPPS.usedWeights(sdtWhaleSigner._address);
    });

    it("user should be able to getreward & lock it", async function () {
      this.enableTimeouts(false);
      const addedLockingAmount = BigNumber.from("1000").mul(BigNumber.from(10).pow(18));
      await (await fxs.connect(fxsHolder).transfer(deployer.address, addedLockingAmount)).wait();
      await (await fxs.approve(fxsDepositor.address, addedLockingAmount)).wait();
      await (await fxsDepositor.deposit(addedLockingAmount, true, true)).wait();

      // simulating strategies sending FXS to accumulator
      await (await fxs.connect(fxsHolder).transfer(accumulator.address, parseEther("500"))).wait();

      await network.provider.send("evm_increaseTime", [604800]); // 1 week
      await network.provider.send("evm_mine", []);
      await (await accumulator.claimAndNotify()).wait();
      await network.provider.send("evm_increaseTime", [604800]); // 1 week
      await network.provider.send("evm_mine", []);
      await gaugeProxyPPS.distribute()
      console.log("sdFXSBalance " + (await sdFXSToken.balanceOf(gaugeMultiRewardsPPS.address)).toString() / 1e18);
      
      await gaugeMultiRewardsPPS.getRewardAndLock( [true,true,false], [veSDT.address, fxsDepositor.address,SUSHI_HOLDER]);

      console.log("sdFXSBalance " + (await sdFXSToken.balanceOf(gaugeMultiRewardsPPS.address)).toString() / 1e18);
    });

    it("user should be able to getreward & lock for", async function () {
      this.enableTimeouts(false);
      const addedLockingAmount = BigNumber.from("1000").mul(BigNumber.from(10).pow(18));
      await (await fxs.connect(fxsHolder).transfer(deployer.address, addedLockingAmount)).wait();
      await (await fxs.approve(fxsDepositor.address, addedLockingAmount)).wait();
      await (await fxsDepositor.deposit(addedLockingAmount, true, true)).wait();

      // simulating strategies sending FXS to accumulator
      await (await fxs.connect(fxsHolder).transfer(accumulator.address, parseEther("500"))).wait();

      await network.provider.send("evm_increaseTime", [604800]); // 1 week
      await network.provider.send("evm_mine", []);
      await (await accumulator.claimAndNotify()).wait();
      await network.provider.send("evm_increaseTime", [604800]); // 1 week
      await network.provider.send("evm_mine", []);
      await gaugeProxyPPS.distribute()
      console.log("sdFXSBalance " + (await sdFXSToken.balanceOf(gaugeMultiRewardsPPS.address)).toString() / 1e18);
      console.log("SDTBalance " + (await sdt.balanceOf(gaugeMultiRewardsPPS.address)).toString() / 1e18);
      await gaugeMultiRewardsPPS.getRewardAndLockFor(deployer.address, [true,false,false], [veSDT.address, fxsDepositor.address,SUSHI_HOLDER]);

      console.log("sdFXSBalance " + (await sdFXSToken.balanceOf(gaugeMultiRewardsPPS.address)).toString() / 1e18);
      console.log("SDTBalance " + (await sdt.balanceOf(gaugeMultiRewardsPPS.address)).toString() / 1e18);
    });

    it("should be able to set a new reward period", async function () {
      this.enableTimeouts(false);
      await network.provider.send("evm_increaseTime", [604800]); // 1 week
      await network.provider.send("evm_mine", []);
      //await gaugeMultiRewardsPPS.setRewardsDuration(fxs.address, 604800);
      await accumulator.setRewardsDuration(2592000);
    });

    it("should be able to rescue ERC20", async function () {
      this.enableTimeouts(false);
      const sushiAmount = parseEther("10");
      await sushi.connect(sushiHolder).transfer(gaugeMultiRewardsPPS.address, sushiAmount);
      await gaugeMultiRewardsPPS.recoverERC20(sushi.address, sushiAmount, deployer.address);
      expect(await sushi.balanceOf(gaugeProxyPPS.address)).to.be.eq(0);
      expect(await sushi.balanceOf(deployer.address)).to.be.eq(sushiAmount);
    });
  });

  describe("GaugeProxyPPS voter", function () {
    it("should distribute SDT to 1 gauge", async function () {
      this.enableTimeouts(false);

      // simulating strategies sending FXS to accumulator
      await (await fxs.connect(fxsHolder).transfer(accumulator.address, parseEther("500"))).wait();
      await network.provider.send("evm_increaseTime", [604800]); // 1 week
      await network.provider.send("evm_mine", []);
      await (await accumulator.claimAndNotify()).wait();
      await network.provider.send("evm_increaseTime", [604800]); // 1 week
      await network.provider.send("evm_mine", []);

      await gaugeProxyPPS.distribute();
      const balanceG = await sdt.balanceOf(gaugeProxyPPS.address);
      console.log(balanceG.toString())
      const balance = await sdt.balanceOf(gaugeMultiRewardsPPS.address);
      expect(balance).to.be.gt(0);
    });

    it("user should be able to claim the rewards", async function () {
      const sdtBalanceBefore = await sdt.balanceOf(deployer.address);
      const fxsBalanceBefore = await fxs.balanceOf(deployer.address);
      await (await gaugeMultiRewardsPPS.getReward()).wait();
      const sdtBalanceAfter = await sdt.balanceOf(deployer.address);
      const fxsBalanceAfter = await fxs.balanceOf(deployer.address);
      expect(sdtBalanceAfter).to.be.gt(sdtBalanceBefore);
      expect(fxsBalanceAfter).to.be.gt(fxsBalanceBefore);
      console.log({
        UserFXSBefore: fxsBalanceBefore.toString() / 1e18,
        UserFXSAfter: fxsBalanceAfter.toString() / 1e18,
        UserSDTBefore: sdtBalanceBefore.toString() / 1e18,
        UserSDTAfter: sdtBalanceAfter.toString() / 1e18
      });
    });

    it("user should be able to reset their vote", async function () {
      //await gaugeProxyPPS.poke(sdtWhaleSigner._address);
      await gaugeProxyPPS.poke(deployer.address);
    });
  });

  describe("ClaimContract Tests", async function () {
    it("User could claim rewards", async function () {
      this.enableTimeouts(false);

      await fxs.approve(fxsDepositor.address, parseEther("1"));
      await fxsDepositor.deposit(parseEther("1"), true, true);

      // simulating strategies sending FXS to accumulator
      await (await fxs.connect(fxsHolder).transfer(accumulator.address, parseEther("500"))).wait();
      await network.provider.send("evm_increaseTime", [604800]); // 1 week
      await network.provider.send("evm_mine", []);
      await (await accumulator.claimAndNotify()).wait();
      await network.provider.send("evm_increaseTime", [604800]); // 1 week
      await network.provider.send("evm_mine", []);
      await gaugeProxyPPS.distribute();

      //time travel
      await network.provider.send("evm_increaseTime", [604800]); // 1 week
      await network.provider.send("evm_mine", []);

      var fxsBalanceBefore = await fxs.balanceOf(deployer.address);
      var beforeSDT = await sdt.balanceOf(deployer.address);
      await sdt.approve(veSDT.address, "1000000000000000000000");
      await claimContract.claimRewards([gaugeMultiRewardsPPS.address]);
      var fxsBalanceAfter = await fxs.balanceOf(deployer.address);
      var afterSDT = await sdt.balanceOf(deployer.address);

      //SDT was claimed
      expect(afterSDT).to.be.gt(beforeSDT);
      //FXS was claimed
      expect(fxsBalanceAfter).to.be.gt(fxsBalanceBefore);
    });

    it("User could claim rewards and deposit", async function () {
      this.enableTimeouts(false);

      await (await fxs.approve(fxsDepositor.address, parseEther("1"))).wait();
      await fxsDepositor.deposit(parseEther("1"), true, true);

      // simulating strategies sending FXS to accumulator
      await (await fxs.connect(fxsHolder).transfer(accumulator.address, parseEther("500"))).wait();
      await network.provider.send("evm_increaseTime", [604800]); // 1 week
      await network.provider.send("evm_mine", []);
      await (await accumulator.claimAndNotify()).wait();
      await network.provider.send("evm_increaseTime", [604800]); // 1 week
      await network.provider.send("evm_mine", []);
      await gaugeProxyPPS.distribute();
      //Adding rewards to the gaugemultireward
      var rewardsAmount = parseEther("1");

      await sushi.connect(sushiHolder).approve(gaugeMultiRewardsPPS.address, rewardsAmount);
      await gaugeMultiRewardsPPS.connect(sushiHolder).notifyRewardAmount(SUSHI, rewardsAmount);

      await network.provider.send("evm_increaseTime", [604800]); // 1 week
      await network.provider.send("evm_mine", []);

      var fxsBalanceBefore = await fxs.balanceOf(deployer.address);
      var beforeSDT = await sdt.balanceOf(deployer.address);
      var beforeSUSHI = await sushi.balanceOf(deployer.address);
      var locks: any[] = [
        { locked: [true, true, true], tokens: [SUSHI] }
      ];
      await claimContract.claimAndLock([gaugeMultiRewardsPPS.address], locks, [SUSHI]);
      var fxsBalanceAfter = await fxs.balanceOf(deployer.address);
      var afterSDT = await sdt.balanceOf(deployer.address);
      var afterSUSHI = await sushi.balanceOf(deployer.address);
      //SDT was claimed and deposited
      expect(beforeSDT).to.be.eq(afterSDT);
      //FXS was claimed and deposited
      expect(fxsBalanceBefore).to.be.eq(fxsBalanceAfter);
      //SUSHI was claimed and deposited
      expect(beforeSUSHI).to.be.lt(afterSUSHI);
    });

    it("User could claim and deposit some rewards", async function () {
      this.enableTimeouts(false);

      await fxs.connect(fxsHolder).transfer(deployer.address, parseEther("1"));

      await fxs.approve(fxsDepositor.address, parseEther("1"));
      await fxsDepositor.deposit(parseEther("1"), true, true);

      // simulating strategies sending FXS to accumulator
      await (await fxs.connect(fxsHolder).transfer(accumulator.address, parseEther("500"))).wait();
      await (await accumulator.claimAndNotify()).wait();

      //Adding rewards to the gaugemultireward
      var rewardsAmount = parseEther("1");

      await sushi.connect(sushiHolder).approve(gaugeMultiRewardsPPS.address, rewardsAmount);
      await gaugeMultiRewardsPPS.connect(sushiHolder).notifyRewardAmount(SUSHI, rewardsAmount);

      await network.provider.send("evm_increaseTime", [604800]); // 1 week
      await network.provider.send("evm_mine", []);
      await sdt.transfer(gaugeProxyPPS.address,parseEther('1'));
      await gaugeProxyPPS.distribute();
      var fxsBalanceBefore = await fxs.balanceOf(deployer.address);
      var beforeSDT = await sdt.balanceOf(deployer.address);
      var beforeSUSHI = await sushi.balanceOf(deployer.address);
      var locks: any[] = [
        { locked: [false, true, false], tokens: [SDT, FXS, SUSHI] }
      ];
      await claimContract.setDepositor(SUSHI, sushiDepositor.address);
      await sushi.connect(sushiHolder).transfer(claimContract.address, parseEther("1"))
      await claimContract.claimAndLock([ gaugeMultiRewardsPPS.address], locks, [SUSHI]);
      var fxsBalanceAfter = await fxs.balanceOf(deployer.address);
      var afterSDT = await sdt.balanceOf(deployer.address);
      var afterSUSHI = await sushi.balanceOf(deployer.address);
      //SDT was claimed and deposited
      expect(beforeSDT).to.be.lt(afterSDT);
      //FXS was claimed
      expect(fxsBalanceBefore).to.be.eq(fxsBalanceAfter);
      //SUSHI was claimed
      expect(beforeSUSHI).to.be.lt(afterSUSHI);
    });

    it("Apart from depositorProxy no one can call ClaimAndSend", async function () {
      await expect(
        claimContract.claimAndSend(fxsHolder._address, [ gaugeMultiRewardsPPS.address])
      ).to.be.revertedWith("!depositorProxy");
    });

    it("depositorProxy should be able to call ClaimAndSend", async function () {
      this.enableTimeouts(false);

      await fxs.connect(fxsHolder).transfer(deployer.address, parseEther("1"));

      await fxs.approve(fxsDepositor.address, parseEther("1"));
      await fxsDepositor.deposit(parseEther("1"), true, true);

      // simulating strategies sending FXS to accumulator
      await (await fxs.connect(fxsHolder).transfer(accumulator.address, parseEther("500"))).wait();
      await network.provider.send("evm_increaseTime", [604800]); // 1 week
      await network.provider.send("evm_mine", []);
      await (await accumulator.claimAndNotify()).wait();
      await network.provider.send("evm_increaseTime", [604800]); // 1 week
      await network.provider.send("evm_mine", []);

      //Adding rewards to the gaugemultireward
      var rewardsAmount = parseEther("1");
      await sdt.transfer(gaugeProxyPPS.address,parseEther('1'));
      await sushi.connect(sushiHolder).approve(gaugeMultiRewardsPPS.address, rewardsAmount);
      await gaugeMultiRewardsPPS.connect(sushiHolder).notifyRewardAmount(SUSHI, rewardsAmount);

      await network.provider.send("evm_increaseTime", [604800]); // 1 week
      await network.provider.send("evm_mine", []);
      console.log((await sdt.balanceOf(gaugeProxyPPS.address)).toString());
      await gaugeProxyPPS.distribute();
      var fxsBalanceBefore = await fxs.balanceOf(FXS_HOLDER);
      var beforeSDT = await sdt.balanceOf(FXS_HOLDER);
      var beforeSUSHI = await sushi.balanceOf(FXS_HOLDER);

      await claimContract
        .connect(fxsHolder)
        .claimAndSend(deployer.address, [gaugeMultiRewardsPPS.address]);
      var fxsBalanceAfter = await fxs.balanceOf(FXS_HOLDER);
      var afterSDT = await sdt.balanceOf(FXS_HOLDER);
      var afterSUSHI = await sushi.balanceOf(FXS_HOLDER);

      //SDT was claimed and deposited
      expect(beforeSDT).to.be.lt(afterSDT);
      //FXS was claimed
      expect(fxsBalanceBefore).to.be.lt(fxsBalanceAfter);
      //SUSHI was claimed
      expect(beforeSUSHI).to.be.lt(afterSUSHI);
    });

    it("recover ERC20", async function () {
      var beforeSUSHI = await sushi.balanceOf(fxsHolder._address);
      await sushi.connect(sushiHolder).transfer(claimContract.address, parseEther("1"));
      await claimContract.recoverERC20(SUSHI, parseEther("1"), fxsHolder._address);
      var afterSUSHI = await sushi.balanceOf(fxsHolder._address);
      expect(afterSUSHI.sub(beforeSUSHI)).to.be.eq(parseEther("1"));
    });

    it("setGovernance", async function () {
      await claimContract.setGovernance(FXS_HOLDER);
      expect(await claimContract.governance()).to.be.eq(FXS_HOLDER);
    });
  });

  describe('GaugeMultirewards',function(){
    it('staking',async function(){
      const stakedAmountBeforeStake = await gaugeMultiRewardsPPS.balanceOf(deployer.address);
      
      await sdFXSToken.approve(gaugeMultiRewardsPPS.address, parseEther('1'));
      await gaugeMultiRewardsPPS.stake(parseEther('1'));
      const stakedAmountAfterStake = await gaugeMultiRewardsPPS.balanceOf(deployer.address);
      expect(stakedAmountBeforeStake).to.be.lt(stakedAmountAfterStake);
    })

    it('withdraw',async function(){
      const stakedAmountBeforeStake = await gaugeMultiRewardsPPS.balanceOf(deployer.address);
      await gaugeMultiRewardsPPS.withdraw(parseEther('1'));
      const stakedAmountAfterStake = await gaugeMultiRewardsPPS.balanceOf(deployer.address);
      expect(stakedAmountBeforeStake).to.be.gt(stakedAmountAfterStake);
    })

    it('withdrawFor',async function(){
      const stakedAmountBeforeStake = await gaugeMultiRewardsPPS.balanceOf(deployer.address);
      await gaugeMultiRewardsPPS.withdrawFor(deployer.address,parseEther('1'));
      const stakedAmountAfterStake = await gaugeMultiRewardsPPS.balanceOf(deployer.address);
      expect(stakedAmountBeforeStake).to.be.gt(stakedAmountAfterStake);
    })
  })

  it("user should be able to reset their vote", async function () {
      await gaugeProxyPPS.reset();
    });
});