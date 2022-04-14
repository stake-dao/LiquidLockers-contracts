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
const VE_ANGLE = "0x0C462Dbb9EC8cD1630f1728B2CFD2769d09f0dd5";

const WALLET_CHECKER = "0xAa241Ccd398feC742f463c534a610529dCC5888E";
const WALLET_CHECKER_OWNER = "0xdC4e6DFe07EFCa50a197DF15D9200883eF4Eb1c8";

const FEE_DISTRIBUTOR = "0x7F82ff050128e29Fd89D85d01b93246F744E62A0";
const ANGLE_GAUGE_CONTROLLER = "0x9aD7e7b0877582E14c17702EecF49018DD6f2367";

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
  let sanLPHolder: JsonRpcSigner;
  let sanDAILPHolder: JsonRpcSigner;

  let strategy: Contract;
  let sanUSDCEurVault: Contract;
  let sanUSDCEurMultiGauge: Contract;
  let sanUsdcEurLiqudityGauge: Contract;

  before(async function () {
    const [localDeployer] = await ethers.getSigners();
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

    strategy = await AngleStrategy.deploy(locker.address, deployer._address, ANGLEACCUMULATOR);

    await locker.connect(deployer).setGovernance(strategy.address);

    await sanUsdcEur.connect(sanLPHolder).transfer(locker.address, parseUnits("10000", "6"));
    await sanUsdcEur.connect(sanLPHolder).transfer(strategy.address, parseUnits("10000", "6"));
    await sanUsdcEur.connect(sanLPHolder).transfer(deployer._address, parseUnits("10000", "6"));

    await sanDaiEur.connect(sanDAILPHolder).transfer(locker.address, parseUnits("10000", "18"));
    await sanDaiEur.connect(sanDAILPHolder).transfer(strategy.address, parseUnits("10000", "18"));
    await sanDaiEur.connect(sanDAILPHolder).transfer(deployer._address, parseUnits("10000", "18"));
    const angleVaultFactory = await ethers.getContractFactory("AngleVault");
    const multiGaugeRewardsFactory = await ethers.getContractFactory("GaugeMultiRewards");
    sanUSDCEurVault = await angleVaultFactory.deploy(
      SAN_USDC_EUR,
      localDeployer.address,
      "Stake Dao sanUSDCEUR",
      "sdSanUsdcEur"
    );
    sanUSDCEurMultiGauge = await multiGaugeRewardsFactory.deploy(
      sanUSDCEurVault.address,
      sanUSDCEurVault.address,
      localDeployer.address,
      "Stake Dao sanUSDCEUR gauge",
      "sdSanUsdcEur-gauge"
    );
    sanUsdcEurLiqudityGauge = await ethers.getContractAt("LiquidityGaugeV4", sanUSDC_EUR_GAUGE);
    await sanUSDCEurVault.setGaugeMultiRewards(sanUSDCEurMultiGauge.address);
    await sanUSDCEurVault.setAngleStrategy(strategy.address);
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
      await sanUSDCEurVault.earn();
      const sanUsdcEurAngleGaugeStakedAfter = await sanUsdcEurLiqudityGauge.balanceOf(locker.address);
      expect(sanUsdcEurAngleGaugeStakedBefore).to.be.eq(0);
      expect(sanUsdcEurAngleGaugeStakedAfter).to.be.eq(parseUnits("1000", 6));
    });
  });

  describe("san usdc gauge tests", function () {
    it("should be able to deposit", async function () {
      await strategy.connect(deployer).deposit(sanUSDC_EUR_GAUGE, SAN_USDC_EUR, parseUnits("1", "6"));
    });

    it("should be able to claim", async function () {
      const beforeBalance = await angle.balanceOf(ANGLEACCUMULATOR);
      await strategy.claim(sanUSDC_EUR_GAUGE);
      const afterBalance = await angle.balanceOf(ANGLEACCUMULATOR);
      expect(afterBalance.gt(beforeBalance));
    });

    it("should be able to withdraw", async function () {
      const beforeBalance = await sanUsdcEur.balanceOf(deployer._address);
      await strategy.connect(deployer).withdrawAll(sanUSDC_EUR_GAUGE, SAN_USDC_EUR);
      const afterBalance = await sanUsdcEur.balanceOf(deployer._address);
      expect(afterBalance.gt(beforeBalance));
    });

    it("should be able to set rewards receiver", async function () {
      await strategy.connect(deployer).set_rewards_receiver(sanUSDC_EUR_GAUGE, deployer._address);
    });

    it("should be able to boost", async function () {
      await strategy.connect(deployer).boost(sanUSDC_EUR_GAUGE);
    });
  });

  describe("san dai gauge tests", function () {
    it("should be able to deposit", async function () {
      await strategy.connect(deployer).deposit(sanDAI_EUR_GAUGE, SAN_DAI_EUR, parseUnits("1", "6"));
    });

    it("should be able to claim", async function () {
      const beforeBalance = await angle.balanceOf(ANGLEACCUMULATOR);
      await strategy.claim(sanDAI_EUR_GAUGE);
      const afterBalance = await angle.balanceOf(ANGLEACCUMULATOR);
      expect(afterBalance.gt(beforeBalance));
    });

    it("should be able to withdraw", async function () {
      const beforeBalance = await sanDaiEur.balanceOf(deployer._address);
      await strategy.connect(deployer).withdrawAll(sanDAI_EUR_GAUGE, SAN_DAI_EUR);
      const afterBalance = await sanDaiEur.balanceOf(deployer._address);
      expect(afterBalance.gt(beforeBalance));
    });

    it("should be able to set rewards receiver", async function () {
      await strategy.connect(deployer).set_rewards_receiver(sanDAI_EUR_GAUGE, deployer._address);
    });

    it("should be able to boost", async function () {
      await strategy.connect(deployer).boost(sanDAI_EUR_GAUGE);
    });
  });
});
