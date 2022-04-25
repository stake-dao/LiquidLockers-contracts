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
const FXS_ACCUMULATOR = "0x1CC16bEdaaCD15848bcA5eB80188e0931bC59fB2";

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
const MAXLOCK = 3 * 60 * 60 * 24 * 364;

describe("Testing the Strategy Proxy for FRAX", function () {
  let dummyMs: SignerWithAddress;

  /* ==== JsonRpcSigner ==== */
  let deployer: JsonRpcSigner;
  let account_1: JsonRpcSigner;
  let account_2: JsonRpcSigner;
  let whale_fxs_sushi: JsonRpcSigner;
  let whale_fxs_temple: JsonRpcSigner;
  let governance: JsonRpcSigner;

  /* ==== Contract ==== */
  let StrategyProxyFRAX;
  let strategy: Contract;
  let fxs_templeVault: Contract;
  let fraxVaultFactoryContract: Contract;
  let fxs_templeMultiGauge: Contract;
  let fxs_templeLiquidityGauge: Contract;
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
    const [user_0, user_1, user_2, dummyMs] = await ethers.getSigners();
    deployer = ethers.provider.getSigner(user_0.address);
    account_1 = ethers.provider.getSigner(user_1.address);
    account_2 = ethers.provider.getSigner(user_2.address);

    /* ==== Impersonate Account ==== */
    await ethers.provider.send("hardhat_impersonateAccount", [FXS_TEMPLE_WHALE]);
    await ethers.provider.send("hardhat_impersonateAccount", [LIQUIDLOCKER_GOVERNANCE]);
    whale_fxs_temple = ethers.provider.getSigner(FXS_TEMPLE_WHALE);
    governance = ethers.provider.getSigner(LIQUIDLOCKER_GOVERNANCE);

    /* ==== Give Ether for Transactions ==== */
    await account_1.sendTransaction({
      to: FXS_TEMPLE_WHALE,
      value: ethers.utils.parseEther("10.0")
    });

    /* ==== Other Contract ==== */
    fxs = await ethers.getContractAt(ERC20_ABI, FXS_ADDRESS);
    liquidLocker = await ethers.getContractAt(LIQUIDLOCKER_ABI, LIQUIDLOCKER_ADDRESS);
    fxs_temple_LP = await ethers.getContractAt(ERC20_ABI, FXS_TEMPLE_ADDRESS);

    /* ==== Deploye Strategy ==== */
    StrategyProxyFRAX = await ethers.getContractFactory("FraxStrategy");
    strategy = await StrategyProxyFRAX.connect(deployer).deploy(
      liquidLocker.address,
      deployer._address,
      dummyMs.address,
      FXS_ACCUMULATOR
    );
    await liquidLocker.connect(governance).setGovernance(strategy.address);

    /* ==== Deploye Vault Facory ==== */
    const fraxVaultFactory = await ethers.getContractFactory("FraxVaultFactory");
    fraxVaultFactoryContract = await fraxVaultFactory.deploy();

    /* ==== Deploye Vault ==== */
    const cloneTx = await (
      await fraxVaultFactoryContract.cloneAndInit(
        FXS_TEMPLE_ADDRESS,
        deployer._address,
        "Stake Dao FXSTEMPLE",
        "sdFXSTEMPLE",
        strategy.address,
        deployer._address,
        "Stake Dao FXSTEMPLE gauge",
        "sdFXSTEMPLE-gauge"
      )
    ).wait();
    fxs_templeVault = await ethers.getContractAt("FraxVault", cloneTx.events[0].args[0]);
    fxs_templeMultiGauge = await ethers.getContractAt("GaugeMultiRewards", cloneTx.events[1].args[0]);
    fxs_templeLiquidityGauge = await ethers.getContractAt("LiquidityGaugeV4", FXS_TEMPLE_LOCKER_ADDRESS);
    await strategy.connect(deployer).setMultiGauge(FXS_TEMPLE_LOCKER_ADDRESS, fxs_templeMultiGauge.address);
    //console.log(cloneTx);

    /* ==== Give LP ==== */
    await fxs_temple_LP.connect(whale_fxs_temple).transfer(account_1._address, ethers.utils.parseEther("100.0"));
  });

  /* ========================================== */
  /* ********** Begining of the test ********** */
  /* ========================================== */
  it("Should try to deposit through LiquidLocker", async function () {
    const BAL = await fxs_temple_LP.connect(account_1).balanceOf(account_1._address);
    await strategy.connect(deployer).toggleVault(fxs_templeVault.address);
    await strategy.connect(deployer).setGauge(FXS_TEMPLE_ADDRESS, FXS_TEMPLE_LOCKER_ADDRESS);
    await fxs_temple_LP.connect(account_1).approve(fxs_templeVault.address, BAL);
    await fxs_templeVault.connect(account_1).deposit(BAL, 4 * WEEK);
    const LIST = await fxs_templeVault.getKekIdUser(account_1._address);
    const gauge = await strategy.gauges(FXS_TEMPLE_ADDRESS);
    //console.log("Amount deposited: ", (BAL / 10 ** 18).toString());
    //console.log("gauge: ", gauge);
    //console.log(LIST);
  });
  it("Should test to claim", async function () {
    //this.enableTimeouts(false);
    await network.provider.send("evm_increaseTime", [5 * WEEK]);
    await network.provider.send("evm_mine", []);
    await strategy.connect(account_1).claim(FXS_TEMPLE_ADDRESS);
  });
  it("Should withdraw lp", async function () {
    const BEFORE = await fxs_temple_LP.balanceOf(account_1._address);
    const LIST = await fxs_templeVault.getKekIdUser(account_1._address);
    await fxs_templeVault.connect(account_1).withdraw(LIST[0]);
    const AFTER = await fxs_temple_LP.balanceOf(account_1._address);
    console.log(BEFORE.toString());
    console.log(AFTER.toString());
  });
});
