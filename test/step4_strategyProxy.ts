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
import AngleLockerABI from "./fixtures/AngleLocker.json";
const ONE_YEAR_IN_SECONDS = 24 * 3600 * 365;

const ETH_100 = BigNumber.from(10).mul(BigNumber.from(10).pow(18)).toHexString();

const ANGLE_HOLDER = "0x7bB909d58E54aba5596DFCaA873df0d50bC5d760";
const ANGLE_HOLDER_2 = "0x9843C8a8263308A309BfC3C2d1c308126D8E754D";

const SDT = "0x73968b9a57c6e53d41345fd57a6e6ae27d6cdb2f";

const ANGLE = "0x31429d1856aD1377A8A0079410B297e1a9e214c2";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const FRAX = "0x853d955aCEf822Db058eb8505911ED77F175b99e";
const VE_ANGLE = "0x0C462Dbb9EC8cD1630f1728B2CFD2769d09f0dd5";
const SDFRAX3CRV = "0x5af15DA84A4a6EDf2d9FA6720De921E1026E37b7";
const SDANGLEGAUGE = "0xE55843a90672f7d8218285e51EE8fF8E233F35d5";
const WALLET_CHECKER = "0xAa241Ccd398feC742f463c534a610529dCC5888E";
const WALLET_CHECKER_OWNER = "0xdC4e6DFe07EFCa50a197DF15D9200883eF4Eb1c8";

const FEE_DISTRIBUTOR = "0x7F82ff050128e29Fd89D85d01b93246F744E62A0";
const ANGLE_GAUGE_CONTROLLER = "0x9aD7e7b0877582E14c17702EecF49018DD6f2367";
const STAKEDAO_FEE_DISTRIBUTOR = "0x29f3dd38dB24d3935CF1bf841e6b2B461A3E5D92";
const GAUGE = "0x3785Ce82be62a342052b9E5431e9D3a839cfB581"; // G-UNI LP gauge

const ACC = "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0"; // StakeDAO multisig

const ANGLEACCUMULATOR = "0x943671e6c3a98e28abdbc60a7ac703b3c0c6aa51";

const SAN_USDC_EUR = "0x9C215206Da4bf108aE5aEEf9dA7caD3352A36Dad"; // sanUSDC_EUR
const SAN_DAI_EUR = "0x7b8e89b0ce7bac2cfec92a371da899ea8cbdb450"; // sanDAI_EUR

const SAN_USDC_EUR_HOLDER = "0x411ce0be9f5e595e19dc05be8551e951778b439f";
const SAN_DAI_EUR_HOLDER = "0x5edcf547ece0ea1765d6c02e9e5bae53b52e09d4";

const FEE_D_ADMIN = "0xdC4e6DFe07EFCa50a197DF15D9200883eF4Eb1c8";
const STDDEPLOYER = "0xb36a0671b3d49587236d7833b01e79798175875f";

const sanUSDC_EUR_GAUGE = "0x51fE22abAF4a26631b2913E417c0560D547797a7";
const sanDAI_EUR_GAUGE = "0x8E2c0CbDa6bA7B65dbcA333798A3949B07638026";

const getNow = async function () {
  let blockNum = await ethers.provider.getBlockNumber();
  let block = await ethers.provider.getBlock(blockNum);
  var time = block.timestamp;
  return time;
};

describe("ANGLE Strategy", function () {
  let locker: Contract;
  let angle: Contract;
  let sanUsdcEur: Contract;
  let sanDaiEur: Contract;

  let deployer: JsonRpcSigner;
  let dummyMs: SignerWithAddress;
  let VeSdtProxy: Contract;
  let sanLPHolder: JsonRpcSigner;
  let sanDAILPHolder: JsonRpcSigner;
  let localDeployer: SignerWithAddress;

  let strategy: Contract;
  let sanUSDCEurVault: Contract;
  let sanUSDCEurMultiGauge: Contract;
  let sanUsdcEurLiqudityGauge: Contract;
  let angleVaultFactoryContract: Contract;
  let frax: Contract;
  let sdFrax3Crv: Contract;
  let sdAngleGauge: Contract;
  let angleAccumulator: Contract;
  let sanDaiEurVault: Contract;
  let sanDaiEurMultiGauge: Contract;
  let sanDaiEurLiqudityGauge: Contract;

  before(async function () {
    [localDeployer, dummyMs] = await ethers.getSigners();
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [STDDEPLOYER]
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SAN_USDC_EUR_HOLDER]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SAN_DAI_EUR_HOLDER]
    });

    const AngleStrategy = await ethers.getContractFactory("AngleStrategy");

    deployer = ethers.provider.getSigner(STDDEPLOYER);
    sanLPHolder = ethers.provider.getSigner(SAN_USDC_EUR_HOLDER);
    sanDAILPHolder = ethers.provider.getSigner(SAN_DAI_EUR_HOLDER);

    await network.provider.send("hardhat_setBalance", [SAN_USDC_EUR_HOLDER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [SAN_DAI_EUR_HOLDER, ETH_100]);

    locker = await ethers.getContractAt(AngleLockerABI, "0xd13f8c25cced32cdfa79eb5ed654ce3e484dcaf5");
    sanUsdcEur = await ethers.getContractAt(ERC20ABI, SAN_USDC_EUR);
    sanDaiEur = await ethers.getContractAt(ERC20ABI, SAN_DAI_EUR);
    angle = await ethers.getContractAt(ERC20ABI, ANGLE);
    frax = await ethers.getContractAt(ERC20ABI, FRAX);
    sdFrax3Crv = await ethers.getContractAt(ERC20ABI, SDFRAX3CRV);
    sdAngleGauge = await ethers.getContractAt("LiquidityGaugeV4", SDANGLEGAUGE);
    angleAccumulator = await ethers.getContractAt("AngleAccumulatorV2", ANGLEACCUMULATOR);

    strategy = await AngleStrategy.deploy(locker.address, deployer._address, dummyMs.address, ANGLEACCUMULATOR);
    const veSdtAngleProxyFactory = await ethers.getContractFactory("veSDTFeeAngleProxy");
    VeSdtProxy = await veSdtAngleProxyFactory.deploy([ANGLE, WETH, FRAX]);
    await locker.connect(deployer).setGovernance(strategy.address);

    // await sanUsdcEur.connect(sanLPHolder).transfer(locker.address, parseUnits("10000", "6"));
    // await sanUsdcEur.connect(sanLPHolder).transfer(strategy.address, parseUnits("10000", "6"));
    await sanUsdcEur.connect(sanLPHolder).transfer(deployer._address, parseUnits("10000", "6"));

    // await sanDaiEur.connect(sanDAILPHolder).transfer(locker.address, parseUnits("10000", "18"));
    // await sanDaiEur.connect(sanDAILPHolder).transfer(strategy.address, parseUnits("10000", "18"));
    await sanDaiEur.connect(sanDAILPHolder).transfer(deployer._address, parseUnits("10000", "18"));
    const angleVaultFactory = await ethers.getContractFactory("AngleVaultFactory");
    angleVaultFactoryContract = await angleVaultFactory.deploy();
    const cloneTx = await (
      await angleVaultFactoryContract.cloneAndInit(
        SAN_USDC_EUR,
        localDeployer.address,
        "Stake Dao sanUSDCEUR",
        "sdSanUsdcEur",
        strategy.address,
        localDeployer.address,
        "Stake Dao sanUSDCEUR gauge",
        "sdSanUsdcEur-gauge"
      )
    ).wait();
    sanUSDCEurVault = await ethers.getContractAt("AngleVault", cloneTx.events[0].args[0]);
    sanUSDCEurMultiGauge = await ethers.getContractAt("GaugeMultiRewards", cloneTx.events[1].args[0]);
    sanUsdcEurLiqudityGauge = await ethers.getContractAt("LiquidityGaugeV4", sanUSDC_EUR_GAUGE);
    sanDaiEurLiqudityGauge = await ethers.getContractAt("LiquidityGaugeV4", sanDAI_EUR_GAUGE);
    await strategy.connect(deployer).setMultiGauge(sanUSDC_EUR_GAUGE, sanUSDCEurMultiGauge.address);
    await strategy.connect(deployer).setVeSDTProxy(VeSdtProxy.address);
    await strategy.connect(deployer).manageFee(0, sanUsdcEurLiqudityGauge.address, 200); // %2
    await sanUSDCEurMultiGauge.addReward(ANGLE, strategy.address, 60 * 60 * 24 * 7);
  });

  describe("Angle Vault tests", function () {
    it("Should deposit sanUSDC-EUR to vault and get gauge tokens", async function () {
      const vaultSanUsdcEurBalanceBeforeDeposit = await sanUsdcEur.balanceOf(sanUSDCEurVault.address);
      await sanUsdcEur.connect(sanLPHolder).approve(sanUSDCEurVault.address, parseUnits("1000", 6));
      await sanUSDCEurVault.connect(sanLPHolder).deposit(parseUnits("1000", 6));
      const vaultSanUsdcEurBalanceAfterDeposit = await sanUsdcEur.balanceOf(sanUSDCEurVault.address);
      const gaugeTokenBalanceOfDepositor = await sanUSDCEurMultiGauge.balanceOf(sanLPHolder._address);
      expect(vaultSanUsdcEurBalanceBeforeDeposit).to.be.eq(0);
      expect(vaultSanUsdcEurBalanceAfterDeposit).to.be.equal(parseUnits("1000", 6).toString());
      expect(gaugeTokenBalanceOfDepositor).to.be.equal(parseUnits("1000", 6).toString());
    });
    it("Should be able to withdraw deposited amount and gauge tokens should be burned", async function () {
      const vaultSanUsdcEurBalanceBeforeWithdraw = await sanUsdcEur.balanceOf(sanUSDCEurVault.address);
      await sanUsdcEur.connect(sanLPHolder).approve(sanUSDCEurVault.address, parseUnits("1000", 6));
      await sanUSDCEurVault.connect(sanLPHolder).withdraw(parseUnits("1000", 6));
      const vaultSanUsdcEurBalanceAfterWithdraw = await sanUsdcEur.balanceOf(sanUSDCEurVault.address);
      const gaugeTokenBalanceOfDepositor = await sanUSDCEurMultiGauge.balanceOf(sanLPHolder._address);
      expect(vaultSanUsdcEurBalanceBeforeWithdraw).to.be.gt(0);
      expect(vaultSanUsdcEurBalanceAfterWithdraw).to.be.eq(0);
      expect(gaugeTokenBalanceOfDepositor).to.be.eq(0);
    });
    it("Shouldn't be able to withdraw when there is no enough gauge token", async function () {
      await sanUsdcEur.connect(sanLPHolder).approve(sanUSDCEurVault.address, parseUnits("1000", 6));
      await sanUSDCEurVault.connect(sanLPHolder).deposit(parseUnits("1000", 6));
      await sanUSDCEurMultiGauge.connect(sanLPHolder).transfer(deployer._address, parseUnits("500", 6));
      const tx = await sanUSDCEurVault
        .connect(sanLPHolder)
        .withdraw(parseUnits("1000", 6))
        .catch((e: any) => e);
      expect(tx.message).to.have.string("ERC20: burn amount exceeds balance");
    });
    it("it should not be able withdraw from multigauge if not vault", async () => {
      const stakedBalance = await sanUSDCEurMultiGauge.stakeOf(sanLPHolder._address);
      const tx = await sanUSDCEurMultiGauge
        .connect(sanLPHolder)
        .withdrawFor(sanLPHolder._address, stakedBalance)
        .catch((e: any) => e);

      expect(tx.message).to.have.string("!vault");
    });
    it("Should not be able to approve vault on the strategy when not governance", async function () {
      const tx = await strategy.toggleVault(sanUSDCEurVault.address).catch((e: any) => e);
      expect(tx.message).to.have.string("!governance");
    });
    it("should not be able to add gauge if it's not governance", async function () {
      const tx = await strategy.setGauge(SAN_USDC_EUR, sanUSDC_EUR_GAUGE).catch((e: any) => e);
      expect(tx.message).to.have.string("!governance");
    });
    it("Should be able to call earn and stake the amounts to the Angle gauge", async function () {
      const sanUsdcEurAngleGaugeStakedBefore = await sanUsdcEurLiqudityGauge.balanceOf(locker.address);
      await strategy.connect(deployer).toggleVault(sanUSDCEurVault.address);
      await strategy.connect(deployer).setGauge(SAN_USDC_EUR, sanUSDC_EUR_GAUGE);
      const tx = await (await sanUSDCEurVault.earn()).wait();
      const vaultSanUsdcEurBalanceAfterEarn = await sanUsdcEur.balanceOf(sanUSDCEurVault.address);
      const sanUsdcEurAngleGaugeStakedAfter = await sanUsdcEurLiqudityGauge.balanceOf(locker.address);
      expect(sanUsdcEurAngleGaugeStakedBefore).to.be.eq(0);
      expect(sanUsdcEurAngleGaugeStakedAfter).to.be.eq(parseUnits("1000", 6));
      expect(vaultSanUsdcEurBalanceAfterEarn).to.be.equal(0);
    });
    it("Should pay withdraw fee if withdraw from Angle gauge", async function () {
      const sanUsdcEurBalanceBeforeWithdraw = await sanUsdcEur.balanceOf(sanLPHolder._address);
      const tx = await (await sanUSDCEurVault.connect(sanLPHolder).withdraw(parseUnits("500", 6))).wait();
      const sanUsdcEurBalanceAfterWithdraw = await sanUsdcEur.balanceOf(sanLPHolder._address);
      const sanUsdcEurAngleGaugeStakedAfterWithdraw = await sanUsdcEurLiqudityGauge.balanceOf(locker.address);
      const fee = parseUnits("500", 6).mul(50).div(10000);
      expect(sanUsdcEurBalanceAfterWithdraw.sub(sanUsdcEurBalanceBeforeWithdraw)).to.be.equal(
        parseUnits("500", 6).sub(fee)
      );
      expect(sanUsdcEurAngleGaugeStakedAfterWithdraw).to.be.equal(parseUnits("500", 6));
    });

    it("should be able to claim rewards when some time pass", async () => {
      await sanUsdcEur.connect(sanLPHolder).approve(sanUSDCEurVault.address, parseUnits("100000", 6));
      await sanUSDCEurVault.connect(sanLPHolder).deposit(parseUnits("100000", 6));
      await (await sanUSDCEurVault.earn()).wait();
      // increase the timestamp by 1 month
      await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 30]);
      await network.provider.send("evm_mine", []);
      const multiGaugeRewardRateBefore = await sanUSDCEurMultiGauge.rewardData(angle.address);
      const msAngleBalanceBefore = await angle.balanceOf(dummyMs.address);
      const accumulatorAngleBalanceBefore = await angle.balanceOf(ANGLEACCUMULATOR);
      const claimable = await sanUsdcEurLiqudityGauge.claimable_reward(locker.address, angle.address);
      const tx = await (await strategy.claim(sanUsdcEur.address)).wait();
      const accumulatorAngleBalanceAfter = await angle.balanceOf(ANGLEACCUMULATOR);
      const multiGaugeRewardRateAfter = await sanUSDCEurMultiGauge.rewardData(angle.address);
      const msAngleBalanceAfter = await angle.balanceOf(dummyMs.address);
      const perfFee = claimable.mul(BigNumber.from(200)).div(BigNumber.from(10000));
      const accumulatorPart = claimable.mul(BigNumber.from(800)).div(BigNumber.from(10000));
      const claimed = tx.events.find((e: any) => e.event === "Claimed");
      expect(claimed.args[2]).to.be.equal(claimable);
      expect(multiGaugeRewardRateBefore[3]).to.be.equal(0);
      expect(multiGaugeRewardRateAfter[3]).to.be.gt(0);
      expect(perfFee).to.be.gt(0);
      expect(accumulatorPart).to.be.gt(0);
      expect(msAngleBalanceAfter.sub(msAngleBalanceBefore)).to.be.equal(perfFee);
      expect(accumulatorAngleBalanceAfter.sub(accumulatorAngleBalanceBefore)).to.be.equal(accumulatorPart);
    });
    it("it should be able swap angles and transfer to feeDistributor from veSDTFeeAngleProxy", async () => {
      const fraxBalanceOfClaimer = await frax.balanceOf(localDeployer.address);
      const sd3CrvBalanceOfFeeD = await sdFrax3Crv.balanceOf(STAKEDAO_FEE_DISTRIBUTOR);
      await VeSdtProxy.sendRewards();
      const fraxBalanceOfClaimerAfterClaim = await frax.balanceOf(localDeployer.address);
      const sd3CrvBalanceOfFeeDAfterRewards = await sdFrax3Crv.balanceOf(STAKEDAO_FEE_DISTRIBUTOR);
      expect(fraxBalanceOfClaimerAfterClaim.sub(fraxBalanceOfClaimer)).to.be.gt(0);
      expect(sd3CrvBalanceOfFeeDAfterRewards.sub(sd3CrvBalanceOfFeeD)).to.be.gt(0);
    });
    it("it should accumulated angle rewards to sdAngle liquidity gauge from AngleAccumulator", async () => {
      const gaugeAngleBalanceBefore = await angle.balanceOf(sdAngleGauge.address);
      await sdAngleGauge.connect(deployer).add_reward(angle.address, angleAccumulator.address);
      await angleAccumulator.connect(deployer).notifyAllExtraReward(angle.address);
      const gaugeAngleBalanceAfter = await angle.balanceOf(sdAngleGauge.address);
      const angleAccumulatorBalance = await angle.balanceOf(angleAccumulator.address);
      expect(gaugeAngleBalanceAfter.sub(gaugeAngleBalanceBefore)).to.be.gt(0);
      expect(angleAccumulatorBalance).to.be.equal(0);
    });
    it("it should create new vault and multigauge rewards for different Angle LP token", async () => {
      const cloneTx = await (
        await angleVaultFactoryContract.cloneAndInit(
          SAN_DAI_EUR,
          localDeployer.address,
          "Stake Dao sanDAIEUR",
          "sdSanDaiEur",
          strategy.address,
          localDeployer.address,
          "Stake Dao sanDAIEUR gauge",
          "sdSanDaiEur-gauge"
        )
      ).wait();
      sanDaiEurVault = await ethers.getContractAt("AngleVault", cloneTx.events[0].args[0]);
      sanDaiEurMultiGauge = await ethers.getContractAt("GaugeMultiRewards", cloneTx.events[1].args[0]);
      const tokenOfVault = await sanDaiEurVault.token();
      expect(tokenOfVault.toLowerCase()).to.be.equal(SAN_DAI_EUR.toLowerCase());
    });
    it("it should be able to deposit sanDAIEur to new vault", async () => {
      const gaugeTokenBalanceBeforeDeposit = await sanDaiEurMultiGauge.balanceOf(sanDAILPHolder._address);
      await sanDaiEur.connect(sanDAILPHolder).approve(sanDaiEurVault.address, ethers.constants.MaxUint256);
      await sanDaiEurVault.connect(sanDAILPHolder).deposit(parseEther("10000"));
      const gaugeTokenBalanceAfterDeposit = await sanDaiEurMultiGauge.balanceOf(sanDAILPHolder._address);
      expect(gaugeTokenBalanceBeforeDeposit).to.be.equal(0);
      expect(gaugeTokenBalanceAfterDeposit.sub(gaugeTokenBalanceBeforeDeposit)).to.be.equal(parseEther("10000"));
    });
    it("it should send tokens to angle gauge after call earn for new vault", async () => {
      await strategy.connect(deployer).setMultiGauge(sanDAI_EUR_GAUGE, sanDaiEurMultiGauge.address);
      await strategy.connect(deployer).manageFee(0, sanDAI_EUR_GAUGE, 200); // %2
      await sanDaiEurMultiGauge.addReward(ANGLE, strategy.address, 60 * 60 * 24 * 7);
      await strategy.connect(deployer).toggleVault(sanDaiEurVault.address);
      await strategy.connect(deployer).setGauge(SAN_DAI_EUR, sanDAI_EUR_GAUGE);
      const sanUsdcEurAngleGaugeStakedBefore = await sanDaiEurLiqudityGauge.balanceOf(locker.address);
      await (await sanDaiEurVault.earn()).wait();
      const sanUsdcEurAngleGaugeStakedAfter = await sanDaiEurLiqudityGauge.balanceOf(locker.address);
      expect(sanUsdcEurAngleGaugeStakedBefore).to.be.equal(0);
      expect(sanUsdcEurAngleGaugeStakedAfter).to.be.equal(parseEther("10000"));
    });
  });
});
