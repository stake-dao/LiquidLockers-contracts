import { expect } from "chai";
import { Address } from "cluster";
import { Contract } from "ethers";
import { ethers, network } from "hardhat";
import { JsonRpcSigner } from "@ethersproject/providers";
import { parseEther, parseUnits } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

/* ==== Get ABIS ==== */
const ERC20_ABI = require("./fixtures/ERC20.json");
const LIQUIDLOCKER_ABI = require("./fixtures/FXSLocker.json");
const FXS_SUSHI_LOCKER_ABI = require("./fixtures/StakingRewardsMultiGauge_FRAX_SUSHI.json");
const FXS_TEMPLE_LOCKER_ABI = require("./fixtures/FraxUnifiedFarm_ERC20_Temple_FRAX_TEMPLE.json");

/* ===================================================== */
/* ********************* Addresses ********************* */
/* ===================================================== */

/* ==== Liquid Locker ====*/
const LIQUIDLOCKER_ADDRESS = "0xCd3a267DE09196C48bbB1d9e842D7D7645cE448f"; // Liquid Locker Address
const LIQUIDLOCKER_GOVERNANCE = "0xb36a0671B3D49587236d7833B01E79798175875f";

const FXS_ADDRESS = "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0"; // Token FXS Address
/* ==== FXS/SUSHI ==== */
const SUSHI_ADDRESS = "0x6B3595068778DD592e39A122f4f5a5cF09C90fE2"; // Token Sushi Address
const FXS_SUSHI_ADDRESS = "0xe06F8d30AC334c857Fc8c380C85969C150f38A6A"; // LP token FXS/SUSHI
const FXS_SUSHI_LOCKER_ADDRESS = "0xb4Ab0dE6581FBD3A02cF8f9f265138691c3A7d5D"; // LP Locker for FXS/SUSHI on FRAX
const FXS_SUSHI_WHALE = "0x6388928be5db41efe0ffd013b9244ae939811d35"; // LP token FXS/SUSHI Whale

/* ==== FXS/TEMPLE ==== */
const TEMPLE_ADDRESS = "0x470EBf5f030Ed85Fc1ed4C2d36B9DD02e77CF1b7"; // Token TEMPLE Address
const FXS_TEMPLE_ADDRESS = "0x6021444f1706f15465bEe85463BCc7d7cC17Fc03"; // LP token FXS/TEMPLE
const FXS_TEMPLE_LOCKER_ADDRESS = "0x10460d02226d6ef7B2419aE150E6377BdbB7Ef16"; // LP Locker for FXS/TEMPS on FRAX
const FXS_TEMPLE_WHALE = "0xa5f74ae4b22a792f18c42ec49a85cf560f16559f"; // LP token FXS/TEMPLE Whale

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
  let whale_fxs_sushi: JsonRpcSigner;
  let whale_fxs_temple: JsonRpcSigner;
  let governance: JsonRpcSigner;

  /* ==== Contract ==== */
  let StrategyProxyFRAX;
  let strategyProxyFRAX: Contract;
  let fxs_sushi_LP: Contract;
  let fxs_temple_LP: Contract;
  let liquidLocker: Contract;
  let fxs_sushi_locker: Contract;
  let fxs_temple_locker: Contract;
  let fxs: Contract;
  let sushi: Contract;
  let temple: Contract;

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
    liquidLocker = await ethers.getContractAt(LIQUIDLOCKER_ABI, LIQUIDLOCKER_ADDRESS);
    fxs = await ethers.getContractAt(ERC20_ABI, FXS_ADDRESS);

    // fxs/sushi
    sushi = await ethers.getContractAt(ERC20_ABI, SUSHI_ADDRESS);
    fxs_sushi_LP = await ethers.getContractAt(ERC20_ABI, FXS_SUSHI_ADDRESS);
    fxs_sushi_locker = await ethers.getContractAt(FXS_SUSHI_LOCKER_ABI, FXS_SUSHI_LOCKER_ADDRESS);

    // fxs/temple
    temple = await ethers.getContractAt(ERC20_ABI, TEMPLE_ADDRESS);
    fxs_temple_LP = await ethers.getContractAt(ERC20_ABI, FXS_TEMPLE_ADDRESS);
    fxs_temple_locker = await ethers.getContractAt(FXS_TEMPLE_LOCKER_ABI, FXS_TEMPLE_LOCKER_ADDRESS);

    /* ==== Impersonate Account ==== */
    await ethers.provider.send("hardhat_impersonateAccount", [FXS_SUSHI_WHALE]);
    await ethers.provider.send("hardhat_impersonateAccount", [FXS_TEMPLE_WHALE]);
    await ethers.provider.send("hardhat_impersonateAccount", [LIQUIDLOCKER_GOVERNANCE]);
    whale_fxs_sushi = ethers.provider.getSigner(FXS_SUSHI_WHALE);
    whale_fxs_temple = ethers.provider.getSigner(FXS_TEMPLE_WHALE);
    governance = ethers.provider.getSigner(LIQUIDLOCKER_GOVERNANCE);

    /* ==== Give Ether for Transactions ==== */
    await account_1.sendTransaction({
      to: FXS_SUSHI_WHALE,
      value: ethers.utils.parseEther("20.0")
    });
    await account_1.sendTransaction({
      to: FXS_TEMPLE_WHALE,
      value: ethers.utils.parseEther("10.0")
    });
    await fxs_sushi_LP.connect(whale_fxs_sushi).transfer(account_1._address, ethers.utils.parseEther("100.0"));
    await fxs_temple_LP.connect(whale_fxs_temple).transfer(account_1._address, ethers.utils.parseEther("100.0"));
    await liquidLocker.connect(governance).setGovernance(strategyProxyFRAX.address);
  });

  /* ========================================== */
  /* ********** Begining of the test ********** */
  /* ========================================== */

  describe("Should interact with FRAX, directly", function () {
    it("Should deposit LP on FRAX Locker for 1 week", async function () {
      const bal = fxs_sushi_LP.balanceOf(account_1._address);
      await fxs_sushi_LP.connect(account_1).approve(FXS_SUSHI_LOCKER_ADDRESS, bal);
      await fxs_sushi_locker.connect(account_1).stakeLocked(bal, WEEK);
    });
    it("Should withdraw 100% after locked period ended", async function () {
      await network.provider.send("evm_increaseTime", [WEEK]);
      const KEK_ID = await fxs_sushi_locker.lockedStakesOf(account_1._address);
      await fxs_sushi_locker.connect(account_1).withdrawLocked(KEK_ID[0].kek_id);

      const BAL_FXS = await fxs.balanceOf(account_1._address);
      const BAL_SUSHI = await sushi.balanceOf(account_1._address);

      //console.log("Balance FXS: \t", (BAL_FXS / 10 ** 18).toString());
      //console.log("Balance SUSHI: \t", (BAL_SUSHI / 10 ** 18).toString());
    });
  });

  /* ==== With StakeDAO Liquid Lockers ==== */

  describe("\u001B[33m" + "\n\nShould interact with FRAX, through Liquid Locker -- FXS/SUSHI\n\n", function () {
    it("Should add a new LP token on LP Informations", async function () {
      await strategyProxyFRAX
        .connect(deployer)
        .setLPInfos(FXS_SUSHI_ADDRESS, FXS_SUSHI_LOCKER_ADDRESS, [FXS_ADDRESS, SUSHI_ADDRESS], 0, 0, 0);
      const INFOS = await strategyProxyFRAX.lpInfos(FXS_SUSHI_ADDRESS);
      //console.log(INFOS);
    });

    it("Should deposit FXS/SUSHI LP on FRAX locker for 1 week", async function () {
      const bal = fxs_sushi_LP.balanceOf(account_1._address);
      await fxs_sushi_LP.connect(account_1).approve(strategyProxyFRAX.address, bal);
      await strategyProxyFRAX.connect(account_1).deposit(FXS_SUSHI_ADDRESS, bal, WEEK);
      const LL_KEKIDLIST = await fxs_sushi_locker.lockedStakesOf(LIQUIDLOCKER_ADDRESS);
      const USER_KEKIDLIST = await strategyProxyFRAX.getKekID(account_1._address, fxs_sushi_LP.address);
      //console.log("LL_KEKIDLIST: ", LL_KEKIDLIST);
      //console.log("USER_KEKIDLIST: ", USER_KEKIDLIST);
      expect(LL_KEKIDLIST[0].kek_id).eq(USER_KEKIDLIST[0]);
    });

    it("Should withdraw 100% after locked period ended", async function () {
      await network.provider.send("evm_increaseTime", [WEEK]);
      const KEK_ID = await strategyProxyFRAX.getKekID(account_1._address, fxs_sushi_LP.address);
      const BAL_FXS_BEFORE = await fxs.balanceOf(account_1._address);
      const BAL_SUSHI_BEFORE = await sushi.balanceOf(account_1._address);

      await strategyProxyFRAX.connect(account_1).withdraw(FXS_SUSHI_ADDRESS, KEK_ID[0], 0);

      const BAL_FXS_AFTER = await fxs.balanceOf(account_1._address);
      const BAL_SUSHI_AFTER = await sushi.balanceOf(account_1._address);

      console.log("Reward FXS: \t", ((BAL_FXS_AFTER - BAL_FXS_BEFORE) / 10 ** 18).toString());
      console.log("Reward SUSHI: \t", ((BAL_SUSHI_AFTER - BAL_SUSHI_BEFORE) / 10 ** 18).toString());
    });
  });

  describe("\u001B[33m" + "\n\n Should interact with FRAX, through Liquid Locker -- FXS/TEMPLE\n\n", function () {
    it("Should add a new LP token on LP Informations", async function () {
      await strategyProxyFRAX
        .connect(deployer)
        .setLPInfos(FXS_TEMPLE_ADDRESS, FXS_TEMPLE_LOCKER_ADDRESS, [FXS_ADDRESS, TEMPLE_ADDRESS], 0, 0, 2);
      const INFOS = await strategyProxyFRAX.lpInfos(FXS_TEMPLE_ADDRESS);
      //console.log(INFOS);
    });
    it("Should deposit FXS/TEMPLE LP on FRAX locker for 1 week", async function () {
      const bal = fxs_temple_LP.balanceOf(account_1._address);
      await fxs_temple_LP.connect(account_1).approve(strategyProxyFRAX.address, bal);
      await strategyProxyFRAX.connect(account_1).deposit(FXS_TEMPLE_ADDRESS, bal, WEEK);
      const LL_KEKIDLIST = await fxs_temple_locker.lockedStakesOf(LIQUIDLOCKER_ADDRESS);
      const USER_KEKIDLIST = await strategyProxyFRAX.getKekID(account_1._address, fxs_temple_LP.address);
      const LP_LISTED = await strategyProxyFRAX.getListedLP();
      //console.log("LL_KEKIDLIST: ", LL_KEKIDLIST);
      //console.log("USER_KEKIDLIST: ", USER_KEKIDLIST);
      //console.log("LP_LISTED: ", LP_LISTED);
      expect(LL_KEKIDLIST[0].kek_id).eq(USER_KEKIDLIST[0]);
    });
    it("Should withdraw 100% after locked period ended", async function () {
      await network.provider.send("evm_increaseTime", [WEEK]);
      const KEK_ID = await strategyProxyFRAX.getKekID(account_1._address, fxs_temple_LP.address);
      const BAL_FXS_BEFORE = await fxs.balanceOf(account_1._address);
      const BAL_TEMPLE_BEFORE = await temple.balanceOf(account_1._address);

      await strategyProxyFRAX.connect(account_1).withdraw(FXS_TEMPLE_ADDRESS, KEK_ID[0], 0);

      const BAL_FXS_AFTER = await fxs.balanceOf(account_1._address);
      const BAL_TEMPLE_AFTER = await temple.balanceOf(account_1._address);

      console.log("Reward FXS: \t", ((BAL_FXS_AFTER - BAL_FXS_BEFORE) / 10 ** 18).toString());
      console.log("Reward TEMPLE:\t", ((BAL_TEMPLE_AFTER - BAL_TEMPLE_BEFORE) / 10 ** 18).toString());
    });
  });
});
