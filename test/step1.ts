import { ethers, network } from "hardhat";
import { expect } from "chai";

import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { JsonRpcSigner } from "@ethersproject/providers";

import ERC20ABI from "./fixtures/ERC20.json";
import WalletCheckerABI from "./fixtures/WalletChecker.json";
import VeFXSABI from "./fixtures/veFXS.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "@ethersproject/units";

const ONE_YEAR_IN_SECONDS = 24 * 3600 * 365;

const ETH_100 = BigNumber.from(10).mul(BigNumber.from(10).pow(18)).toHexString();

const FXS_HOLDER = "0xF977814e90dA44bFA03b6295A0616a897441aceC";
const FXS_HOLDER_2 = "0x5028D77B91a3754fb38B2FBB726AF02d1FE44Db6";

const FXS = "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0";
const VE_FXS = "0xc8418aF6358FFddA74e09Ca9CC3Fe03Ca6aDC5b0";

const WALLET_CHECKER = "0x53c13BA8834a1567474b19822aAD85c6F90D9f9F";
const WALLET_CHECKER_OWNER = "0xb1748c79709f4ba2dd82834b8c82d4a505003f27";

const YIELD_DISTRIBUTOR = "0xc6764e58b36e26b08Fd1d2AeD4538c02171fA872";
const FRAX_GAUGE_CONTROLLER = "0x44ade9AA409B0C29463fF7fcf07c9d3c939166ce";

const GAUGE = "0xEB81b86248d3C2b618CcB071ADB122109DA96Da2"; // sdFRAX3CRV LP gauge

const ACC = "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0"; // StakeDAO multisig

const getNow = async function() {
  let blockNum = await ethers.provider.getBlockNumber();
  let block = await ethers.provider.getBlock(blockNum);
  var time = block.timestamp;
  return time;
};

describe("FXS Depositor", function () {
  let locker: Contract;
  let fxs: Contract;
  let veFXS: Contract;
  let walletChecker: Contract;
  let fxsDepositor: Contract;
  let sdFXSToken: Contract;
  let fxsHolder: JsonRpcSigner;
  let fxsHolder2: JsonRpcSigner;
  let walletCheckerOwner: JsonRpcSigner;
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

    const FraxLocker = await ethers.getContractFactory("FraxLocker");
    const FxsDepositor = await ethers.getContractFactory("FxsDepositor");
    const SdFXSToken = await ethers.getContractFactory("sdFXSToken");

    fxsHolder = ethers.provider.getSigner(FXS_HOLDER);
    fxsHolder2 = ethers.provider.getSigner(FXS_HOLDER_2);
    walletCheckerOwner = ethers.provider.getSigner(WALLET_CHECKER_OWNER);

    fxs = await ethers.getContractAt(ERC20ABI, FXS);
    veFXS = await ethers.getContractAt(VeFXSABI, VE_FXS);
    walletChecker = await ethers.getContractAt(WalletCheckerABI, WALLET_CHECKER);

    await network.provider.send("hardhat_setBalance", [FXS_HOLDER, ETH_100]);

    /**DEPLOYMENTS GLOBAL */
    sdFXSToken = await SdFXSToken.deploy();

    locker = await FraxLocker.deploy(ACC);
    //random locker used to simulate other locks
    randomLocker1 = await FraxLocker.deploy(ACC);
    randomLocker2 = await FraxLocker.deploy(ACC);

    fxsDepositor = await FxsDepositor.deploy(locker.address, sdFXSToken.address);
    
    // Set FxsDepositor on lockers
    await locker.setFxsDepositor(fxsDepositor.address);
    await randomLocker1.setFxsDepositor(fxsDepositor.address);
    await randomLocker2.setFxsDepositor(fxsDepositor.address);
    // Set the sdFxsToken minter operator to the depositor 
    await sdFXSToken.setOperator(fxsDepositor.address);

    //Should be done by FRAX team (whitelist the stakeDAO locker contract for locking FXS)
    await walletChecker.connect(walletCheckerOwner).approveWallet(locker.address);
    // Use only for simulating other locks
    await walletChecker.connect(walletCheckerOwner).approveWallet(randomLocker1.address);
    await walletChecker.connect(walletCheckerOwner).approveWallet(randomLocker2.address);

    const fxsTolock = parseEther("1"); // 1 FXS
    await fxs.connect(fxsHolder).transfer(randomLocker1.address, fxsTolock);
    await fxs.connect(fxsHolder).transfer(randomLocker2.address, fxsTolock);

    // Create Lock
    await randomLocker1.createLock(fxsTolock, await getNow() + ONE_YEAR_IN_SECONDS * 1.5);
    await randomLocker2.createLock(fxsTolock, await getNow() + ONE_YEAR_IN_SECONDS * 3);
  });

  describe("sdFXS", function () {
    it("should change sdFXS operator via FxsDepositor", async function () {
      this.enableTimeouts(false);

      await fxsDepositor.setSdFXSOperator(fxsHolder._address);
      const operator = await sdFXSToken.operator();

      expect(operator).to.be.equal(fxsHolder._address);
    });

    it("should mint some sdFXS tokens", async function () {
      this.enableTimeouts(false);
      const amount = parseEther("500"); // 500 sdFXS

      const sdFXSSuppyBefore = await sdFXSToken.totalSupply();
      const sdFXSBalanceBefore = await sdFXSToken.balanceOf(fxsHolder._address);

      await sdFXSToken.connect(fxsHolder).mint(fxsHolder._address, amount);

      const sdFXSBalanceAfter = await sdFXSToken.balanceOf(fxsHolder._address);
      const sdFXSSuppyAfter = await sdFXSToken.totalSupply();

      expect(sdFXSSuppyAfter).to.be.equal(sdFXSSuppyBefore.add(amount));
      expect(sdFXSBalanceAfter).to.be.equal(sdFXSBalanceBefore.add(amount));
    });

    it("should burn some sdFXS tokens", async function () {
      this.enableTimeouts(false);
      // 500 sdFXS
      const amount = BigNumber.from("500000000000000000000");

      const sdFXSSuppyBefore = await sdFXSToken.totalSupply();
      const sdFXSBalanceBefore = await sdFXSToken.balanceOf(fxsHolder._address);

      await sdFXSToken.connect(fxsHolder).burn(fxsHolder._address, amount);

      const sdFXSBalanceAfter = await sdFXSToken.balanceOf(fxsHolder._address);
      const sdFXSSuppyAfter = await sdFXSToken.totalSupply();

      expect(sdFXSSuppyBefore).to.be.equal(sdFXSSuppyAfter.add(amount));
      expect(sdFXSBalanceBefore).to.be.equal(sdFXSBalanceAfter.add(amount));

      // chainging sdFXS operator back to FxsDepoitor
      await sdFXSToken.connect(fxsHolder).setOperator(fxsDepositor.address);
    });
  });

  describe("Lock Initial Action", function () {
    it("Should create a lock", async function () {
      this.enableTimeouts(false);
      const lockingAmount = parseEther("1");
      const lockEnd = await getNow() + ONE_YEAR_IN_SECONDS * 3;

      await fxs.connect(fxsHolder).transfer(locker.address, lockingAmount);
      await locker.createLock(lockingAmount, lockEnd);

      const veFXSLocked = await veFXS.locked(locker.address);
      const veFXSBalance = await veFXS["balanceOf(address)"](locker.address);

      expect(veFXSLocked.amount).to.be.equal(lockingAmount);

      // as curve doing modulo on thursday for locked end
      expect(veFXSBalance).to.be.gt(lockingAmount.mul(323).div(100));
      expect(veFXSBalance).to.be.lt(lockingAmount.mul(363).div(100));
    });

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
      await (await locker.setAccumulator(ACC)).wait();
    });
  });

  describe("FxsDepositor", function () {
    it("should check if all setters work correctly", async function () {
      this.enableTimeouts(false);

      await fxsDepositor.setGovernance(fxsHolder._address);
      expect(await fxsDepositor.governance()).to.be.equal(fxsHolder._address);
      await fxsDepositor.connect(fxsHolder).setGovernance(baseOwner.address);

      await fxsDepositor.setRelock(false);
      expect(await fxsDepositor.relock()).to.be.equal(false);
      await fxsDepositor.setRelock(true);

      await fxsDepositor.setFees(20);
      expect(await fxsDepositor.lockIncentive()).to.be.equal(20);
      await fxsDepositor.setFees(10);
    });

    it("Should lock FXS", async function () {
      this.enableTimeouts(false);

      const lockingAmount = parseEther("1");
      await (await fxs.connect(fxsHolder).transfer(locker.address, lockingAmount)).wait();
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

      const addedLockingAmount = parseEther("1000");
      await fxs.connect(fxsHolder).approve(fxsDepositor.address, addedLockingAmount);
      await fxsDepositor.connect(fxsHolder).deposit(addedLockingAmount, true);

      const veFXSLockedAfter = await veFXS.locked(locker.address);
      const userFxsBalanceAfter = await fxs.balanceOf(fxsHolder._address);
      console.log({
        veFXSLockedAfter: veFXSLockedAfter.amount.toString() / 1e18,
        userFxsBalanceAfter: userFxsBalanceAfter.toString() / 1e18
      });

      expect(veFXSLockedAfter.amount).to.be.equal(veFXSLocked.amount.add(addedLockingAmount));
      expect(userFxsBalanceAfter).to.be.equal(userFxsBalanceBefore.sub(addedLockingAmount));
    });

    it("Should deposit but not lock directly FXS via FxsDepositor", async function () {
      this.enableTimeouts(false);

      const veFXSLocked = await veFXS.locked(locker.address);
      const userFxsBalanceBefore = await fxs.balanceOf(fxsHolder2._address);

      const fxsBalance = parseEther("1000");
      await fxs.connect(fxsHolder2).approve(fxsDepositor.address, fxsBalance);
      await fxsDepositor.connect(fxsHolder2).deposit(fxsBalance, false);

      const veFXSLockedAfter = await veFXS.locked(locker.address);
      const userFxsBalanceAfter = await fxs.balanceOf(fxsHolder2._address);
      const userSdFxsBalanceAfter = await sdFXSToken.balanceOf(fxsHolder2._address);

      expect(userFxsBalanceAfter).to.be.equal(userFxsBalanceBefore.sub(fxsBalance));
      // less than, coz incentive amount of sdFXS is deducted for this user as he's not locking
      expect(userSdFxsBalanceAfter).to.be.lt(fxsBalance);
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
      await fxs.connect(fxsHolder2).approve(fxsDepositor.address, fxsBalance);
      await fxsDepositor.connect(fxsHolder2).depositAll(true);

      const veFXSLockedAfter = await veFXS.locked(locker.address);
      const userFxsBalanceAfter = await fxs.balanceOf(fxsHolder2._address);
      console.log({
        veFXSLockedAfter: veFXSLockedAfter.amount.toString() / 1e18,
        userFxsBalanceAfter: userFxsBalanceAfter.toString() / 1e18
      });

      //expect(veFXSLockedAfter.amount).to.be.equal(veFXSLocked.amount.add(fxsBalance));
      expect(userFxsBalanceAfter).to.be.equal(userFxsBalanceBefore.sub(fxsBalance));
    });

    it("Should lock FXS", async function () {
      this.enableTimeouts(false);

      // Lock FXS already deposited into the Depositor if there is any
      const addedLockingAmount = parseEther("100");
      await fxs.connect(fxsHolder).approve(fxsDepositor.address, addedLockingAmount.mul(2));
      await fxsDepositor.connect(fxsHolder).deposit(addedLockingAmount, false);
      await fxsDepositor.lockFXS();
      await fxsDepositor.connect(fxsHolder).deposit(addedLockingAmount, true);
      await fxsDepositor.lockFXS();
      const fxsBalance = await fxs.balanceOf(fxsDepositor.address);
      expect(fxsBalance).to.be.equal(0);
    });
  });

  describe("Lock Final Actions", function () {
    it("Should vote for a gauge via locker", async function () {
      this.enableTimeouts(0);
      await locker.voteGaugeWeight(GAUGE, 10000); // 100% vote for this gauge
    });

    it("Should claim rewards", async function () {
      this.enableTimeouts(false);
      await network.provider.send("evm_increaseTime", [604800]); // 1 week
      await network.provider.send("evm_mine", []);

      const fxsBalanceBefore = await fxs.balanceOf(deployer.address);
      expect(fxsBalanceBefore).to.be.equal(0);
      await locker.claimFXSRewards(locker.governance());
      const fxsBalanceAfter = await fxs.balanceOf(deployer.address);
      expect(fxsBalanceAfter).to.be.gt(0);
    });

    it("Should release locked FXS", async function () {
      this.enableTimeouts(false);
      /* random release*/
      await network.provider.send("evm_increaseTime", [ONE_YEAR_IN_SECONDS * 1.6]);
      await network.provider.send("evm_mine", []);
      await randomLocker1.release(deployer.address);
      await network.provider.send("evm_increaseTime", [ONE_YEAR_IN_SECONDS * 1.5]);
      await network.provider.send("evm_mine", []);
      await randomLocker2.release(deployer.address);
      /* end random release*/
      await network.provider.send("evm_increaseTime", [ONE_YEAR_IN_SECONDS * 1]);
      await network.provider.send("evm_mine", []);
      await (await locker.release(deployer.address, { gasLimit: "25000000" })).wait();
      const fxsBalance = await fxs.balanceOf(locker.address);
      expect(fxsBalance).to.be.equal(0);
    });

    it("Should execute any function", async function () {
      this.enableTimeouts(false);
      const data = "0x" // empty
      const response = await locker.execute(
        fxsDepositor.address,
        0,
        data 
      );
    });
  });
});