import { expect } from "chai";
import { Address } from "cluster";
import { Contract } from "ethers";
import { ethers, network } from "hardhat";
import { JsonRpcSigner } from "@ethersproject/providers";
import { parseEther, parseUnits } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

/* ==== Get ABIS ==== */
const ERC20_ABI = require("../abis/ERC20.json");
const FXSLOCKER_ABI = require("../abis/FXSLocker.json");
const MULTIGAUGEREWARD_ABI = require("../abis/MultiGaugeReward.json");

/* ==== Addresses ==== */
const FXS_SUSHI_ADDRESS = "0xe06F8d30AC334c857Fc8c380C85969C150f38A6A";
const FXS_LL_ADDRESS = "0xCd3a267DE09196C48bbB1d9e842D7D7645cE448f";
const WHALE = "0x6388928be5db41efe0ffd013b9244ae939811d35";
const LL_GOVERNANCE = "0xb36a0671B3D49587236d7833B01E79798175875f";
const MULTIGAUGE_ADDRESS = "0xb4Ab0dE6581FBD3A02cF8f9f265138691c3A7d5D";
const FXS_ADDRESS = "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0";
const SUSHI_ADDRESS = "0x6B3595068778DD592e39A122f4f5a5cF09C90fE2";

/* ==== Time ==== */
const DAY = 60 * 60 * 24;
const YEARS = 60 * 60 * 24 * 365;
const MAXLOCK = 3 * YEARS;

describe("Testing Strategy Proxy for FRAX", function () {
  let StrategyProxyFRAX;
  let strategyProxyFRAX: Contract;
  let FXS_SUSHI: Contract;
  let sushi: Contract;
  let fxs: Contract;
  let FXSLocker: Contract;
  let MulitGaugeReward: Contract;
  let governance: JsonRpcSigner;
  let whale: JsonRpcSigner;
  let baseOwner: SignerWithAddress;
  let account_1: SignerWithAddress;

  before(async function () {
    /* ==== Get Signers ==== */
    const [owner, owner2] = await ethers.getSigners();
    baseOwner = owner;
    account_1 = owner2;

    /* ==== Deploye Strategy Proxy FRAX ==== */
    StrategyProxyFRAX = await ethers.getContractFactory("StrategyProxyFRAX");
    strategyProxyFRAX = await StrategyProxyFRAX.connect(baseOwner).deploy(FXS_SUSHI_ADDRESS, FXS_LL_ADDRESS);
    await strategyProxyFRAX.deployed();
    //console.log("StrategyProxyFRAX deployed at: ", strategyProxyFRAX.address);

    /* ==== Other Contract ==== */
    FXS_SUSHI = await ethers.getContractAt(ERC20_ABI, FXS_SUSHI_ADDRESS);
    FXSLocker = await ethers.getContractAt(FXSLOCKER_ABI, FXS_LL_ADDRESS);
    sushi = await ethers.getContractAt(ERC20_ABI, SUSHI_ADDRESS);
    fxs = await ethers.getContractAt(ERC20_ABI, FXS_ADDRESS);
    MulitGaugeReward = await ethers.getContractAt(MULTIGAUGEREWARD_ABI, MULTIGAUGE_ADDRESS);

    /* ==== Impersonate Account ==== */
    await ethers.provider.send("hardhat_impersonateAccount", [LL_GOVERNANCE]);
    await ethers.provider.send("hardhat_impersonateAccount", [WHALE]);
    governance = ethers.provider.getSigner(LL_GOVERNANCE);
    whale = ethers.provider.getSigner(WHALE);

    /* ==== Give Ether for Transactions ==== */
    await network.provider.send("hardhat_setBalance", [WHALE, parseEther("10").toHexString()]);

    /* ==== Set Governance ==== */
    await FXSLocker.connect(governance).setGovernance(strategyProxyFRAX.address);
  });

  describe("Testing as a user, directly from frax, without veFXS", function () {
    it("Should locks LP from user on FRAX, by user", async function () {
      /* ==== Give LP token from Whale ==== */
      await FXS_SUSHI.connect(whale).transfer(account_1.address, ethers.utils.parseEther("100.0"));

      const BALANCE_USER_BEFORE = await FXS_SUSHI.balanceOf(account_1.address);
      const BALANCE_MULTI_GAUGE_BEFORE = await FXS_SUSHI.balanceOf(MULTIGAUGE_ADDRESS);

      await FXS_SUSHI.connect(account_1).approve(MULTIGAUGE_ADDRESS, BALANCE_USER_BEFORE);
      await MulitGaugeReward.connect(account_1).stakeLocked(BALANCE_USER_BEFORE, DAY * 20);

      const BALANCE_USER_AFTER = await FXS_SUSHI.balanceOf(account_1.address);
      const BALANCE_MULTI_GAUGE_AFTER = await FXS_SUSHI.balanceOf(MULTIGAUGE_ADDRESS);

      console.log("BALANCE_USER_BEFORE: \t\t", (BALANCE_USER_BEFORE / 10 ** 18).toString());
      console.log("BALANCE_USER_AFTER: \t\t", (BALANCE_USER_AFTER / 10 ** 18).toString());
      console.log("BALANCE_MULTI_GAUGE_BEFORE: \t", (BALANCE_MULTI_GAUGE_BEFORE / 10 ** 18).toString());
      console.log("BALANCE_MULTI_GAUGE_AFTER: \t", (BALANCE_MULTI_GAUGE_AFTER / 10 ** 18).toString());
    });

    it("Should time jump", async function () {
      await network.provider.send("evm_increaseTime", [DAY * 20]);
    });

    it("Should withdraw LP from user on FRAX, by user", async function () {
      const BALANCE_USER_BEFORE = await FXS_SUSHI.balanceOf(account_1.address);
      const BALANCE_SUSHI_BEFORE = await sushi.balanceOf(account_1.address);
      const BALANCE_FXS_BEFORE = await fxs.balanceOf(account_1.address);
      const BALANCE_MULTI_GAUGE_BEFORE = await FXS_SUSHI.balanceOf(MULTIGAUGE_ADDRESS);

      const stateUser1 = await MulitGaugeReward.lockedStakesOf(account_1.address);
      await MulitGaugeReward.connect(account_1).withdrawLocked(stateUser1[0].kek_id);

      const BALANCE_USER_AFTER = await FXS_SUSHI.balanceOf(account_1.address);
      const BALANCE_SUSHI_AFTER = await sushi.balanceOf(account_1.address);
      const BALANCE_FXS_AFTER = await fxs.balanceOf(account_1.address);
      const BALANCE_MULTI_GAUGE_AFTER = await FXS_SUSHI.balanceOf(MULTIGAUGE_ADDRESS);
      console.log("BALANCE_USER_BEFORE: \t\t", (BALANCE_USER_BEFORE / 10 ** 18).toString());
      console.log("BALANCE_USER_AFTER: \t\t", (BALANCE_USER_AFTER / 10 ** 18).toString());
      console.log("BALANCE_SUSHI_BEFORE: \t\t", (BALANCE_SUSHI_BEFORE / 10 ** 18).toString());
      console.log("BALANCE_SUSHI_AFTER: \t\t", (BALANCE_SUSHI_AFTER / 10 ** 18).toString());
      console.log("BALANCE_FXS_BEFORE: \t\t", (BALANCE_FXS_BEFORE / 10 ** 18).toString());
      console.log("BALANCE_FXS_AFTER: \t\t", (BALANCE_FXS_AFTER / 10 ** 18).toString());
      console.log("BALANCE_MULTI_GAUGE_BEFORE: \t", (BALANCE_MULTI_GAUGE_BEFORE / 10 ** 18).toString());
      console.log("BALANCE_MULTI_GAUGE_AFTER: \t", (BALANCE_MULTI_GAUGE_AFTER / 10 ** 18).toString());
    });
  });
  // Use Liquid Locker for deposit
  describe("Testing as a user, through StakeDAO, without veFXS", function () {
    it("Should run deposit function", async function () {
      /* ==== Give LP token from Whale ==== */
      const DEPOT = ethers.utils.parseEther("500.0");
      const DEPOT1 = ethers.utils.parseEther("100.0");
      await FXS_SUSHI.connect(whale).transfer(account_1.address, DEPOT);

      const BALANCE_USER_BEFORE = await FXS_SUSHI.balanceOf(account_1.address);
      const BALANCE_STRATEGY_PROXY_BEFORE = await FXS_SUSHI.balanceOf(strategyProxyFRAX.address);
      const BALANCE_LIQUID_LOCKER_BEFORE = await FXS_SUSHI.balanceOf(FXS_LL_ADDRESS);
      const BALANCE_MULTI_GAUGE_BEFORE = await FXS_SUSHI.balanceOf(MULTIGAUGE_ADDRESS);

      await FXS_SUSHI.connect(account_1).approve(strategyProxyFRAX.address, BALANCE_USER_BEFORE);
      const deposit = await strategyProxyFRAX.connect(account_1).deposit(MULTIGAUGE_ADDRESS, DEPOT1, DAY * 20);
      await strategyProxyFRAX.connect(account_1).deposit(MULTIGAUGE_ADDRESS, DEPOT1, DAY * 20);
      const response = await deposit.wait();
      const event = response.events;
      //console.log(event);

      const BALANCE_USER_AFTER = await FXS_SUSHI.balanceOf(account_1.address);
      const BALANCE_STRATEGY_PROXY_AFTER = await FXS_SUSHI.balanceOf(strategyProxyFRAX.address);
      const BALANCE_LIQUID_LOCKER_AFTER = await FXS_SUSHI.balanceOf(FXS_LL_ADDRESS);
      const BALANCE_MULTI_GAUGE_AFTER = await FXS_SUSHI.balanceOf(MULTIGAUGE_ADDRESS);

      console.log("BALANCE_USER_BEFORE: \t\t", (BALANCE_USER_BEFORE / 10 ** 18).toString());
      console.log("BALANCE_USER_AFTER: \t\t", (BALANCE_USER_AFTER / 10 ** 18).toString());
      console.log("BALANCE_STRATEGY_PROXY_BEFORE: \t", (BALANCE_STRATEGY_PROXY_BEFORE / 10 ** 18).toString());
      console.log("BALANCE_STRATEGY_PROXY_AFTER: \t", (BALANCE_STRATEGY_PROXY_AFTER / 10 ** 18).toString());
      console.log("BALANCE_LIQUID_LOCKER_BEFORE: \t", (BALANCE_LIQUID_LOCKER_BEFORE / 10 ** 18).toString());
      console.log("BALANCE_LIQUID_LOCKER_AFTER: \t", (BALANCE_LIQUID_LOCKER_AFTER / 10 ** 18).toString());
      console.log("BALANCE_MULTI_GAUGE_BEFORE: \t", (BALANCE_MULTI_GAUGE_BEFORE / 10 ** 18).toString());
      console.log("BALANCE_MULTI_GAUGE_AFTER: \t", (BALANCE_MULTI_GAUGE_AFTER / 10 ** 18).toString());
    });
    /*
  it("Should return the Kek Id", async function () {
    const stateAccount1 = await MulitGaugeReward.lockedStakesOf(account_1.address);
    const stateLiquidLocker = await MulitGaugeReward.lockedStakesOf(FXS_LL_ADDRESS);
    console.log(stateAccount1);
    console.log(stateLiquidLocker);
  });*/

    it("Should time jump", async function () {
      await network.provider.send("evm_increaseTime", [DAY * 20]);
    });

    it("Should withdraw LP through Liquid Locker", async function () {
      const BALANCE_USER_BEFORE = await FXS_SUSHI.balanceOf(account_1.address);
      const BALANCE_SUSHI_BEFORE = await sushi.balanceOf(FXS_LL_ADDRESS);
      const BALANCE_FXS_BEFORE = await fxs.balanceOf(FXS_LL_ADDRESS);
      const BALANCE_STRATEGY_PROXY_BEFORE = await FXS_SUSHI.balanceOf(strategyProxyFRAX.address);
      const BALANCE_LIQUID_LOCKER_BEFORE = await FXS_SUSHI.balanceOf(FXS_LL_ADDRESS);
      const BALANCE_MULTI_GAUGE_BEFORE = await FXS_SUSHI.balanceOf(MULTIGAUGE_ADDRESS);
      const stateLiquidLocker = await MulitGaugeReward.lockedStakesOf(FXS_LL_ADDRESS);

      const withdraw = await strategyProxyFRAX
        .connect(account_1)
        .withdraw(stateLiquidLocker[0].kek_id, MULTIGAUGE_ADDRESS);
      //const response = await withdraw.wait();
      //const event = response.events;
      //console.log(event);

      const BALANCE_USER_AFTER = await FXS_SUSHI.balanceOf(account_1.address);
      const BALANCE_SUSHI_AFTER = await sushi.balanceOf(FXS_LL_ADDRESS);
      const BALANCE_FXS_AFTER = await fxs.balanceOf(FXS_LL_ADDRESS);
      const BALANCE_STRATEGY_PROXY_AFTER = await FXS_SUSHI.balanceOf(strategyProxyFRAX.address);
      const BALANCE_LIQUID_LOCKER_AFTER = await FXS_SUSHI.balanceOf(FXS_LL_ADDRESS);
      const BALANCE_MULTI_GAUGE_AFTER = await FXS_SUSHI.balanceOf(MULTIGAUGE_ADDRESS);

      console.log("BALANCE_USER_BEFORE: \t\t", (BALANCE_USER_BEFORE / 10 ** 18).toString());
      console.log("BALANCE_USER_AFTER: \t\t", (BALANCE_USER_AFTER / 10 ** 18).toString());
      console.log("BALANCE_SUSHI_BEFORE: \t\t", (BALANCE_SUSHI_BEFORE / 10 ** 18).toString());
      console.log("BALANCE_SUSHI_AFTER: \t\t", (BALANCE_SUSHI_AFTER / 10 ** 18).toString());
      console.log("BALANCE_FXS_BEFORE: \t\t", (BALANCE_FXS_BEFORE / 10 ** 18).toString());
      console.log("BALANCE_FXS_AFTER: \t\t", (BALANCE_FXS_AFTER / 10 ** 18).toString());
      console.log("BALANCE_STRATEGY_PROXY_BEFORE: \t", (BALANCE_STRATEGY_PROXY_BEFORE / 10 ** 18).toString());
      console.log("BALANCE_STRATEGY_PROXY_AFTER: \t", (BALANCE_STRATEGY_PROXY_AFTER / 10 ** 18).toString());
      console.log("BALANCE_LIQUID_LOCKER_BEFORE: \t", (BALANCE_LIQUID_LOCKER_BEFORE / 10 ** 18).toString());
      console.log("BALANCE_LIQUID_LOCKER_AFTER: \t", (BALANCE_LIQUID_LOCKER_AFTER / 10 ** 18).toString());
      console.log("BALANCE_MULTI_GAUGE_BEFORE: \t", (BALANCE_MULTI_GAUGE_BEFORE / 10 ** 18).toString());
      console.log("BALANCE_MULTI_GAUGE_AFTER: \t", (BALANCE_MULTI_GAUGE_AFTER / 10 ** 18).toString());
    });
  });
});
