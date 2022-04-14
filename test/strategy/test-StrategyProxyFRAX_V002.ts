import { expect } from "chai";
import { Address } from "cluster";
import { Contract } from "ethers";
import { ethers, network } from "hardhat";
import { JsonRpcSigner } from "@ethersproject/providers";
import { parseEther, parseUnits } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

/* ==== Get ABIS ==== */
const ERC20_ABI = require("../../abis/ERC20.json");
const LIQUIDLOCKER_ABI = require("../../abis/FXSLocker.json");
const LPLOCKER_ABI = require("../../abis/MultiGaugeReward.json");

/* ==== Addresses ==== */
const LIQUIDLOCKER_ADDRESS = "0xCd3a267DE09196C48bbB1d9e842D7D7645cE448f"; // Liquid Locker Address
const LIQUIDLOCKER_GOVERNANCE = "0xb36a0671B3D49587236d7833B01E79798175875f";
const FXS_SUSHI_ADDRESS = "0xe06F8d30AC334c857Fc8c380C85969C150f38A6A"; // LP token
const LPLOCKER_ADDRESS = "0xb4Ab0dE6581FBD3A02cF8f9f265138691c3A7d5D"; // LP Locker on FRAX
const WHALE = "0x6388928be5db41efe0ffd013b9244ae939811d35"; // LP Whale
const FXS_ADDRESS = "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0"; // Token FXS Address
const SUSHI_ADDRESS = "0x6B3595068778DD592e39A122f4f5a5cF09C90fE2"; // Token Sushi Address

/* ==== Time ==== */
const DAY = 60 * 60 * 24;
const WEEK = 60 * 60 * 24 * 7;
const YEAR = 60 * 60 * 24 * 365;
const MAXLOCK = 3 * 60 * 60 * 24 * 365;

describe("Testing the Strategy Proxy for FRAX", function () {
  /* ==== JsonRpcSigner ==== */
  let deployer: JsonRpcSigner;
  let account_1: JsonRpcSigner;
  let account_2: JsonRpcSigner;
  let whale: JsonRpcSigner;
  let governance: JsonRpcSigner;

  /* ==== Contract ==== */
  let StrategyProxyFRAX;
  let strategyProxyFRAX: Contract;
  let lpToken: Contract;
  let liquidLocker: Contract;
  let lpLocker: Contract;
  let fxs: Contract;
  let sushi: Contract;

  before(async function () {
    /* ==== Get Signers With Address ==== */
    const [user_0, user_1, user_2] = await ethers.getSigners();
    deployer = ethers.provider.getSigner(user_0.address);
    account_1 = ethers.provider.getSigner(user_1.address);
    account_2 = ethers.provider.getSigner(user_2.address);

    /* ==== Deploye Strategy Proxy FRAX ==== */
    StrategyProxyFRAX = await ethers.getContractFactory("StrategyProxyFRAX");
    strategyProxyFRAX = await StrategyProxyFRAX.connect(deployer).deploy();
    await strategyProxyFRAX.deployed();

    /* ==== Other Contract ==== */
    lpToken = await ethers.getContractAt(ERC20_ABI, FXS_SUSHI_ADDRESS);
    liquidLocker = await ethers.getContractAt(LIQUIDLOCKER_ABI, LIQUIDLOCKER_ADDRESS);
    lpLocker = await ethers.getContractAt(LPLOCKER_ABI, LPLOCKER_ADDRESS);
    fxs = await ethers.getContractAt(ERC20_ABI, FXS_ADDRESS);
    sushi = await ethers.getContractAt(ERC20_ABI, SUSHI_ADDRESS);

    /* ==== Impersonate Account ==== */
    await ethers.provider.send("hardhat_impersonateAccount", [WHALE]);
    await ethers.provider.send("hardhat_impersonateAccount", [LIQUIDLOCKER_GOVERNANCE]);
    whale = ethers.provider.getSigner(WHALE);
    governance = ethers.provider.getSigner(LIQUIDLOCKER_GOVERNANCE);

    /* ==== Give Ether for Transactions ==== */
    await network.provider.send("hardhat_setBalance", [WHALE, parseEther("10").toHexString()]);

    await lpToken.connect(whale).transfer(user_1.address, ethers.utils.parseEther("100.0"));
    await liquidLocker.connect(governance).setGovernance(strategyProxyFRAX.address);
  });

  /* ========================================== */
  /* ********** Begining of the test ********** */
  /* ========================================== */

  /* ==== Without StakeDAO Liquid Lockers ==== */
  describe("Should interact with FRAX, directly", function () {
    it("Should deposit LP on FRAX Locker for 1 week", async function () {
      const bal = lpToken.balanceOf(account_1._address);
      await lpToken.connect(account_1).approve(LPLOCKER_ADDRESS, bal);
      await lpLocker.connect(account_1).stakeLocked(bal, WEEK);
    });
    it("Should withdraw 100% after locked period ended", async function () {
      await network.provider.send("evm_increaseTime", [WEEK]);
      const KEK_ID = await lpLocker.lockedStakesOf(account_1._address);
      await lpLocker.connect(account_1).withdrawLocked(KEK_ID[0].kek_id);

      const BAL_FXS = await fxs.balanceOf(account_1._address);
      const BAL_SUSHI = await sushi.balanceOf(account_1._address);

      console.log("Balance FXS: \t", (BAL_FXS / 10 ** 18).toString());
      console.log("Balance SUSHI: \t", (BAL_SUSHI / 10 ** 18).toString());
    });
  });

  /* ==== With StakeDAO Liquid Lockers ==== */
  describe("Should interact with FRAX, through Liquid Locker", function () {
    it("Should add a new LP token on LP Informations", async function () {
      await strategyProxyFRAX
        .connect(deployer)
        .setLPInfos(FXS_SUSHI_ADDRESS, LPLOCKER_ADDRESS, [FXS_ADDRESS, SUSHI_ADDRESS], 0, 0, 0);
      const INFOS = await strategyProxyFRAX.lpInfos(FXS_SUSHI_ADDRESS);
      //console.log(INFOS);
    });

    it("Should deposit LP on FRAX locker for 1 week", async function () {
      const bal = lpToken.balanceOf(account_1._address);
      await lpToken.connect(account_1).approve(strategyProxyFRAX.address, bal);
      await strategyProxyFRAX.connect(account_1).deposit(FXS_SUSHI_ADDRESS, bal, WEEK);
      const LL_KEKIDLIST = await lpLocker.lockedStakesOf(LIQUIDLOCKER_ADDRESS);
      const USER_KEKIDLIST = await strategyProxyFRAX.getKekID(account_1._address);
      //console.log("LL_KEKIDLIST: ", LL_KEKIDLIST);
      //console.log("USER_KEKIDLIST: ", USER_KEKIDLIST);
      expect(LL_KEKIDLIST[0].kek_id == USER_KEKIDLIST[0]);
    });
    /*
    it("Should withdraw 100% after locked period ended", async function () {
      await network.provider.send("evm_increaseTime", [WEEK]);
      const KEK_ID = await lpLocker.lockedStakesOf(liquidLocker.address);

      await strategyProxyFRAX.connect(account_1).withdraw(lpLocker.address, KEK_ID[0].kek_id);

      const BAL_FXS = await fxs.balanceOf(liquidLocker.address);
      const BAL_SUSHI = await sushi.balanceOf(liquidLocker.address);

      console.log("Balance FXS: \t", (BAL_FXS / 10 ** 18).toString());
      console.log("Balance SUSHI: \t", (BAL_SUSHI / 10 ** 18).toString());
    });*/
  });
});
