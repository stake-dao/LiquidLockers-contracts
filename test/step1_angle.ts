import { ethers, network } from "hardhat";
import { expect } from "chai";

import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { JsonRpcSigner } from "@ethersproject/providers";

import ERC20ABI from "./fixtures/ERC20.json";
import WalletCheckerABI from "./fixtures/WalletChecker.json";
import VeANGLEABI from "./fixtures/veANGLE.json";
import FEEDABI from "./fixtures/FeeD.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther, parseUnits } from "@ethersproject/units";

const ONE_YEAR_IN_SECONDS = 24 * 3600 * 365;

const ETH_100 = BigNumber.from(10).mul(BigNumber.from(10).pow(18)).toHexString();

const ANGLE_HOLDER = "0x7bB909d58E54aba5596DFCaA873df0d50bC5d760";
const ANGLE_HOLDER_2 = "0x9843C8a8263308A309BfC3C2d1c308126D8E754D";

const ANGLE = "0x31429d1856aD1377A8A0079410B297e1a9e214c2";
const VE_ANGLE = "0x0C462Dbb9EC8cD1630f1728B2CFD2769d09f0dd5";

const WALLET_CHECKER = "0xAa241Ccd398feC742f463c534a610529dCC5888E";
const WALLET_CHECKER_OWNER = "0xdC4e6DFe07EFCa50a197DF15D9200883eF4Eb1c8";

const FEE_DISTRIBUTOR = "0x7F82ff050128e29Fd89D85d01b93246F744E62A0";
const ANGLE_GAUGE_CONTROLLER = "0x9aD7e7b0877582E14c17702EecF49018DD6f2367";

const GAUGE = "0x3785Ce82be62a342052b9E5431e9D3a839cfB581"; // G-UNI LP gauge

const ACC = "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0"; // StakeDAO multisig

const SAN_USDC_EUR = "0x9C215206Da4bf108aE5aEEf9dA7caD3352A36Dad"; // sanUSDC_EUR

const SAN_USDC_EUR_HOLDER = "0xaC149daC01C4D5f6f5dB88AEC053a88fe958cB8B"; 

const FEE_D_ADMIN = "0xdC4e6DFe07EFCa50a197DF15D9200883eF4Eb1c8";

const getNow = async function() {
  let blockNum = await ethers.provider.getBlockNumber();
  let block = await ethers.provider.getBlock(blockNum);
  var time = block.timestamp;
  return time;
};

describe("ANGLE Depositor", function () {
  let locker: Contract;
  let angle: Contract;
  let veANGLE: Contract;
  let sanUsdcEur: Contract;
  let walletChecker: Contract;
  let angleDepositor: Contract;
  let sdANGLEToken: Contract;
  let angleHolder: JsonRpcSigner;
  let angleHolder2: JsonRpcSigner;
  let walletCheckerOwner: JsonRpcSigner;
  let deployer: SignerWithAddress;
  let sanLPHolder: JsonRpcSigner;
  let baseOwner: SignerWithAddress;
  let feeDAdmin: JsonRpcSigner;
  let feeDistributor: Contract;

  let randomLocker1: Contract;
  let randomLocker2: Contract;

  before(async function () {
    this.enableTimeouts(false);

    [deployer] = await ethers.getSigners();
    const temp = await ethers.getSigners();

    baseOwner = temp[0];

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ANGLE_HOLDER]
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ANGLE_HOLDER_2]
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [WALLET_CHECKER_OWNER]
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SAN_USDC_EUR_HOLDER]
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [FEE_D_ADMIN]
    });

    const AngleLocker = await ethers.getContractFactory("AngleLocker");
    const AngleDepositor = await ethers.getContractFactory("Depositor");
    const SdANGLEToken = await ethers.getContractFactory("sdToken");

    angleHolder = ethers.provider.getSigner(ANGLE_HOLDER);
    angleHolder2 = ethers.provider.getSigner(ANGLE_HOLDER_2);
    feeDAdmin = ethers.provider.getSigner(FEE_D_ADMIN);
    walletCheckerOwner = ethers.provider.getSigner(WALLET_CHECKER_OWNER);
    sanLPHolder = ethers.provider.getSigner(SAN_USDC_EUR_HOLDER);

    await network.provider.send("hardhat_setBalance", [ANGLE_HOLDER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [ANGLE_HOLDER_2, ETH_100]);
    await network.provider.send("hardhat_setBalance", [WALLET_CHECKER_OWNER, ETH_100]);

    angle = await ethers.getContractAt(ERC20ABI, ANGLE);
    veANGLE = await ethers.getContractAt(VeANGLEABI, VE_ANGLE);
    sanUsdcEur = await ethers.getContractAt(ERC20ABI, SAN_USDC_EUR);
    feeDistributor = await ethers.getContractAt(FEEDABI, FEE_DISTRIBUTOR);
    walletChecker = await ethers.getContractAt(WalletCheckerABI, WALLET_CHECKER);

    /**DEPLOYMENTS GLOBAL */
    sdANGLEToken = await SdANGLEToken.deploy("Stake DAO ANGLE", "sdANGLE");

    locker = await AngleLocker.deploy(ACC);
    //random locker used to simulate other locks
    randomLocker1 = await AngleLocker.deploy(ACC);
    randomLocker2 = await AngleLocker.deploy(ACC);

    angleDepositor = await AngleDepositor.deploy(angle.address, locker.address, sdANGLEToken.address);
    
    // Set AngleDepositor on lockers
    await locker.setAngleDepositor(angleDepositor.address);
    await randomLocker1.setAngleDepositor(angleDepositor.address);
    await randomLocker2.setAngleDepositor(angleDepositor.address);
    // Set the sdAngle token minter operator to the depositor 
    await sdANGLEToken.setOperator(angleDepositor.address);

    //Should be done by Angle team (whitelist the stakeDAO locker contract for locking ANGLE)
    await walletChecker.connect(walletCheckerOwner).approveWallet(locker.address);
    // Use only for simulating other locks
    await walletChecker.connect(walletCheckerOwner).approveWallet(randomLocker1.address);
    await walletChecker.connect(walletCheckerOwner).approveWallet(randomLocker2.address);

    const angleTolock = parseEther("1"); // 1 ANGLE
    await angle.connect(angleHolder).transfer(randomLocker1.address, angleTolock);
    await angle.connect(angleHolder).transfer(randomLocker2.address, angleTolock);

    // Create Lock
    await randomLocker1.createLock(angleTolock, await getNow() + ONE_YEAR_IN_SECONDS * 1.5);
    await randomLocker2.createLock(angleTolock, await getNow() + ONE_YEAR_IN_SECONDS * 3);
  });

  describe("sdANGLE", function () {
    it("should change sdAngle operator via angleDepositor", async function () {
      this.enableTimeouts(false);

      await angleDepositor.setSdTokenOperator(angleHolder._address);
      const operator = await sdANGLEToken.operator();

      expect(operator).to.be.equal(angleHolder._address);
    });

    it("should mint some sdANGLE tokens", async function () {
      this.enableTimeouts(false);
      const amount = parseEther("500"); // 500 sdANGLE

      const sdANGLESuppyBefore = await sdANGLEToken.totalSupply();
      const sdANGLEBalanceBefore = await sdANGLEToken.balanceOf(angleHolder._address);

      await sdANGLEToken.connect(angleHolder).mint(angleHolder._address, amount);

      const sdANGLEBalanceAfter = await sdANGLEToken.balanceOf(angleHolder._address);
      const sdANGLESuppyAfter = await sdANGLEToken.totalSupply();

      expect(sdANGLESuppyAfter).to.be.equal(sdANGLESuppyBefore.add(amount));
      expect(sdANGLEBalanceAfter).to.be.equal(sdANGLEBalanceBefore.add(amount));
    });

    it("should burn some sdANGLE tokens", async function () {
      this.enableTimeouts(false);
      // 500 sdANGLE
      const amount = BigNumber.from("500000000000000000000");

      const sdANGLESuppyBefore = await sdANGLEToken.totalSupply();
      const sdANGLEBalanceBefore = await sdANGLEToken.balanceOf(angleHolder._address);

      await sdANGLEToken.connect(angleHolder).burn(angleHolder._address, amount);

      const sdANGLEBalanceAfter = await sdANGLEToken.balanceOf(angleHolder._address);
      const sdANGLESuppyAfter = await sdANGLEToken.totalSupply();

      expect(sdANGLESuppyBefore).to.be.equal(sdANGLESuppyAfter.add(amount));
      expect(sdANGLEBalanceBefore).to.be.equal(sdANGLEBalanceAfter.add(amount));

      // chainging sdANGLE operator back to angleDepoitor
      await sdANGLEToken.connect(angleHolder).setOperator(angleDepositor.address);
    });
  });

  describe("Lock Initial Action", function () {
    it("Should create a lock", async function () {
      this.enableTimeouts(false);
      const lockingAmount = parseEther("1");
      const lockEnd = await getNow() + ONE_YEAR_IN_SECONDS * 3;

      await angle.connect(angleHolder).transfer(locker.address, lockingAmount);
      await locker.createLock(lockingAmount, lockEnd);

      const veANGLELocked = await veANGLE.locked(locker.address);
      const veANGLEBalance = await veANGLE["balanceOf(address)"](locker.address);

      expect(veANGLELocked.amount).to.be.equal(lockingAmount);

      // as curve doing modulo on thursday for locked end
      expect(veANGLEBalance).to.be.gt(lockingAmount.mul(74).div(100));
      expect(veANGLEBalance).to.be.lt(lockingAmount.mul(77).div(100));
    });

    it("should check if all setters work correctly", async function () {
      this.enableTimeouts(false);

      await (await locker.setGovernance(ANGLE_HOLDER)).wait();
      expect(await locker.governance()).to.be.equal(ANGLE_HOLDER);
      await (await locker.connect(angleHolder).setGovernance(baseOwner.address)).wait();

      await (await locker.setFeeDistributor(ANGLE_HOLDER)).wait();
      expect(await locker.feeDistributor()).to.be.equal(ANGLE_HOLDER);
      await (await locker.setFeeDistributor(FEE_DISTRIBUTOR)).wait();

      await (await locker.setAngleDepositor(ANGLE_HOLDER)).wait();
      expect(await locker.angleDepositor()).to.be.equal(ANGLE_HOLDER);
      await (await locker.setAngleDepositor(angleDepositor.address)).wait();

      await (await locker.setGaugeController(ANGLE_HOLDER)).wait();
      expect(await locker.gaugeController()).to.be.equal(ANGLE_HOLDER);
      await (await locker.setGaugeController(ANGLE_GAUGE_CONTROLLER)).wait();

      await (await locker.setAccumulator(ANGLE_HOLDER)).wait();
      expect(await locker.accumulator()).to.be.equal(ANGLE_HOLDER);
      await (await locker.setAccumulator(ACC)).wait();
    });
  });

  describe("AngleDepositor", function () {
    it("should check if all setters work correctly", async function () {
      this.enableTimeouts(false);

      await angleDepositor.setGovernance(angleHolder._address);
      expect(await angleDepositor.governance()).to.be.equal(angleHolder._address);
      await angleDepositor.connect(angleHolder).setGovernance(baseOwner.address);

      await angleDepositor.setRelock(false);
      expect(await angleDepositor.relock()).to.be.equal(false);
      await angleDepositor.setRelock(true);

      await angleDepositor.setFees(20);
      expect(await angleDepositor.lockIncentive()).to.be.equal(20);
      await angleDepositor.setFees(10);
    });

    it("Should lock ANGLE", async function () {
      this.enableTimeouts(false);

      const lockingAmount = parseEther("1");
      await (await angle.connect(angleHolder).transfer(locker.address, lockingAmount)).wait();
      // Lock ANGLE already deposited into the Depositor if there is any
      await angleDepositor.lockToken();
      const angleBalance = await angle.balanceOf(angleDepositor.address);
      expect(angleBalance).to.be.equal(0);
    });

    it("Should deposit and lock ANGLE via AngleDepositor", async function () {
      this.enableTimeouts(false);

      const veANGLELocked = await veANGLE.locked(locker.address);
      const userAngleBalanceBefore = await angle.balanceOf(angleHolder._address);
      console.log({
        veANGLELocked: veANGLELocked.amount.toString() / 1e18,
        userAngleBalanceBefore: userAngleBalanceBefore.toString() / 1e18
      });

      const addedLockingAmount = parseEther("1000");
      await angle.connect(angleHolder).approve(angleDepositor.address, addedLockingAmount);
      await angleDepositor.connect(angleHolder).deposit(addedLockingAmount, true);

      const veANGLELockedAfter = await veANGLE.locked(locker.address);
      const userAngleBalanceAfter = await angle.balanceOf(angleHolder._address);
      console.log({
        veANGLELockedAfter: veANGLELockedAfter.amount.toString() / 1e18,
        userAngleBalanceAfter: userAngleBalanceAfter.toString() / 1e18
      });

      expect(veANGLELockedAfter.amount).to.be.equal(veANGLELocked.amount.add(addedLockingAmount));
      expect(userAngleBalanceAfter).to.be.equal(userAngleBalanceBefore.sub(addedLockingAmount));
    });

    it("Should deposit but not lock directly ANGLE via AngleDepositor", async function () {
      this.enableTimeouts(false);

      const veANGLELocked = await veANGLE.locked(locker.address);
      const userAngleBalanceBefore = await angle.balanceOf(angleHolder2._address);

      const angleBalance = parseEther("1000");
      await angle.connect(angleHolder2).approve(angleDepositor.address, angleBalance);
      await angleDepositor.connect(angleHolder2).deposit(angleBalance, false);

      const veANGLELockedAfter = await veANGLE.locked(locker.address);
      const userAngleBalanceAfter = await angle.balanceOf(angleHolder2._address);
      const userSdAngleBalanceAfter = await sdANGLEToken.balanceOf(angleHolder2._address);

      expect(userAngleBalanceAfter).to.be.equal(userAngleBalanceBefore.sub(angleBalance));
      // less than, coz incentive amount of sdANGLE is deducted for this user as he's not locking
      expect(userSdAngleBalanceAfter).to.be.lt(angleBalance);
    });

    it("Should depositAll and lock ANGLE via AngleDepositor", async function () {
      this.enableTimeouts(false);

      const veANGLELocked = await veANGLE.locked(locker.address);
      const userAngleBalanceBefore = await angle.balanceOf(angleHolder2._address);
      console.log({
        veANGLELocked: veANGLELocked.amount.toString() / 1e18,
        userAngleBalanceBefore: userAngleBalanceBefore.toString() / 1e18
      });

      const angleBalance = await angle.balanceOf(angleHolder2._address);
      await angle.connect(angleHolder2).approve(angleDepositor.address, angleBalance);
      await angleDepositor.connect(angleHolder2).depositAll(true);

      const veANGLELockedAfter = await veANGLE.locked(locker.address);
      const userAngleBalanceAfter = await angle.balanceOf(angleHolder2._address);
      console.log({
        veANGLELockedAfter: veANGLELockedAfter.amount.toString() / 1e18,
        userAngleBalanceAfter: userAngleBalanceAfter.toString() / 1e18
      });

      //expect(veANGLELockedAfter.amount).to.be.equal(veANGLELocked.amount.add(angleBalance));
      expect(userAngleBalanceAfter).to.be.equal(userAngleBalanceBefore.sub(angleBalance));
    });

    it("Should lock ANGLE", async function () {
      this.enableTimeouts(false);

      // Lock ANGLE already deposited into the Depositor if there is any
      const addedLockingAmount = parseEther("100");
      await angle.connect(angleHolder).approve(angleDepositor.address, addedLockingAmount.mul(2));
      await angleDepositor.connect(angleHolder).deposit(addedLockingAmount, false);
      await angleDepositor.lockToken();
      await angleDepositor.connect(angleHolder).deposit(addedLockingAmount, true);
      await angleDepositor.lockToken();
      const angleBalance = await angle.balanceOf(angleDepositor.address);
      expect(angleBalance).to.be.equal(0);
    });
  });

  describe("Lock Final Actions", function () {
    it("Should vote for a gauge via locker", async function () {
      this.enableTimeouts(0);
      await locker.voteGaugeWeight(GAUGE, 10000); // 100% vote for this gauge
    });

    it("Should claim rewards", async function () {
      this.enableTimeouts(false);
      await sanUsdcEur.connect(sanLPHolder).transfer(FEE_DISTRIBUTOR, parseUnits("1", "6"));
      await feeDistributor.connect(feeDAdmin).checkpoint_token();
      await network.provider.send("evm_increaseTime", [604800]); // 1 week
      await network.provider.send("evm_mine", []);

      // const sanLPBalanceBefore = await sanUsdcEur.balanceOf(locker.address);
      // expect(sanLPBalanceBefore).to.be.equal(0);
      // await locker.claimRewards(sanUsdcEur.address, locker.governance());
      // const sanLPBalanceAfter = await sanUsdcEur.balanceOf(locker.address);
      // expect(sanLPBalanceAfter).to.be.equal(0);
      // //const feeDB = await sanUsdcEur.balanceOf(locker.address);
      // const sanLPBalanceGovernance = await sanUsdcEur.balanceOf(locker.governance());
      // expect(sanLPBalanceGovernance).to.be.gt(0);
    });

    // it("Should release locked ANGLE", async function () {
    //   this.enableTimeouts(false);
    //   /* random release*/
    //   await network.provider.send("evm_increaseTime", [ONE_YEAR_IN_SECONDS * 1.6]);
    //   await network.provider.send("evm_mine", []);
    //   await randomLocker1.release(deployer.address);
    //   await network.provider.send("evm_increaseTime", [ONE_YEAR_IN_SECONDS * 1.5]);
    //   await network.provider.send("evm_mine", []);
    //   await randomLocker2.release(deployer.address);
    //   /* end random release*/
    //   await network.provider.send("evm_increaseTime", [ONE_YEAR_IN_SECONDS * 1]);
    //   await network.provider.send("evm_mine", []);
    //   await (await locker.release(deployer.address, { gasLimit: "25000000" })).wait();
    //   const angleBalance = await angle.balanceOf(locker.address);
    //   expect(angleBalance).to.be.equal(0);
    // });

    it("Should execute any function", async function () {
      this.enableTimeouts(false);
      const data = "0x" // empty
      const response = await locker.execute(
        angleDepositor.address,
        0,
        data 
      );
    });
  });
});