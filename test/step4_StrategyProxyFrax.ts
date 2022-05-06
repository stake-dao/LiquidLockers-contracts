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

/* ==== StakeDAO ==== */
const STDDEPLOYER = "0xb36a0671b3d49587236d7833b01e79798175875f";
const SDFXSGAUGE = "0xF3C6e8fbB946260e8c2a55d48a5e01C82fD63106";

const ANGLE = "0x31429d1856aD1377A8A0079410B297e1a9e214c2";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const FRAX = "0x853d955aCEf822Db058eb8505911ED77F175b99e";
const TEMPLE = "0x470EBf5f030Ed85Fc1ed4C2d36B9DD02e77CF1b7";

/* ==== Liquid Locker ====*/
const LIQUIDLOCKER_ADDRESS = "0xCd3a267DE09196C48bbB1d9e842D7D7645cE448f"; // Liquid Locker Address
const LIQUIDLOCKER_GOVERNANCE = "0xb36a0671B3D49587236d7833B01E79798175875f";
const FXS_ACCUMULATOR = "0x1CC16bEdaaCD15848bcA5eB80188e0931bC59fB2";

const FXS = "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0"; // Token FXS Address
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
  let VeSdtFraxProxyFactory
  let strategy: Contract;
  let veSdtProxy: Contract;
  let fxs_templeVault: Contract;
  let fraxVaultFactoryContract: Contract;
  let fxs_templeMultiGauge: Contract;
  let fxs_templeLiquidityGauge: Contract;
  let sdFxsGauge: Contract
  let fxs_accumulator: Contract;
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
    account_1 = ethers.provider.getSigner(user_1.address);
    account_2 = ethers.provider.getSigner(user_2.address);

    /* ==== Impersonate Account ==== */
    await ethers.provider.send("hardhat_impersonateAccount", [FXS_TEMPLE_WHALE]);
    await ethers.provider.send("hardhat_impersonateAccount", [LIQUIDLOCKER_GOVERNANCE]);
    await ethers.provider.send("hardhat_impersonateAccount", [STDDEPLOYER])
    whale_fxs_temple = ethers.provider.getSigner(FXS_TEMPLE_WHALE);
    governance = ethers.provider.getSigner(LIQUIDLOCKER_GOVERNANCE);
    deployer = ethers.provider.getSigner(STDDEPLOYER)

    /* ==== Give Ether for Transactions ==== */
    await account_1.sendTransaction({
      to: FXS_TEMPLE_WHALE,
      value: ethers.utils.parseEther("10.0")
    });

    /* ==== Other Contract ==== */
    fxs = await ethers.getContractAt(ERC20_ABI, FXS);
    liquidLocker = await ethers.getContractAt(LIQUIDLOCKER_ABI, LIQUIDLOCKER_ADDRESS);
    fxs_temple_LP = await ethers.getContractAt(ERC20_ABI, FXS_TEMPLE_ADDRESS);
    fxs_temple_locker = await ethers.getContractAt(FXS_TEMPLE_LOCKER_ABI, FXS_TEMPLE_LOCKER_ADDRESS);
    sdFxsGauge = await ethers.getContractAt("LiquidityGaugeV4", SDFXSGAUGE)
    fxs_accumulator = await ethers.getContractAt("FxsAccumulator", FXS_ACCUMULATOR)

    /* ==== Deploye Strategy ==== */
    StrategyProxyFRAX = await ethers.getContractFactory("FraxStrategy");
    strategy = await StrategyProxyFRAX.connect(deployer).deploy(
      liquidLocker.address,
      deployer._address,
      dummyMs.address,
      FXS_ACCUMULATOR
    );
    await liquidLocker.connect(governance).setGovernance(strategy.address);

    // Create veSDTFRAXProxyFactory
    VeSdtFraxProxyFactory = await ethers.getContractFactory("veSDTFeeFraxProxy");
    veSdtProxy = await VeSdtFraxProxyFactory.deploy([ANGLE, WETH, FRAX]); // Deployed in fast and dirty

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
        "stakeLocked(uint256,uint256)", // Here is the feature :)
        "withdrawLocked(bytes32,address)", // Here is the feature :) 
        deployer._address,
        "Stake Dao FXSTEMPLE gauge",
        "sdFXSTEMPLE-gauge"
      )
    ).wait();
    fxs_templeVault = await ethers.getContractAt("FraxVault", cloneTx.events[0].args[0]);
    fxs_templeMultiGauge = await ethers.getContractAt("GaugeMultiRewards", cloneTx.events[1].args[0]);
    //console.log(cloneTx.events)
    fxs_templeLiquidityGauge = await ethers.getContractAt("LiquidityGaugeV4", FXS_TEMPLE_LOCKER_ADDRESS);
    await strategy.connect(deployer).setMultiGauge(FXS_TEMPLE_LOCKER_ADDRESS, fxs_templeMultiGauge.address);
    await strategy.connect(deployer).setVeSDTProxy(veSdtProxy.address);
    await strategy.connect(deployer).manageFee(0, fxs_templeLiquidityGauge.address, 200); // %2
    await fxs_templeMultiGauge.connect(deployer).addReward(FXS, strategy.address, 60 * 60 * 24 * 7)
    await fxs_templeMultiGauge.connect(deployer).addReward(TEMPLE, strategy.address, 60 * 60 * 24 * 7)

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
    const LockedStacked = await fxs_temple_locker.lockedStakesOf(LIQUIDLOCKER_ADDRESS);
    //console.log(BAL.toString());
    //console.log(LockedStacked);
  });
  it("Should test to claim", async function () {
    await network.provider.send("evm_increaseTime", [5 * WEEK]);
    await network.provider.send("evm_mine", []);
    await strategy.connect(account_1).claim(FXS_TEMPLE_ADDRESS);
  });
  it("Should withdraw lp", async function () {
    const BEFORE = await fxs_temple_LP.balanceOf(account_1._address);
    const LIST = await fxs_templeVault.getKekIdUser(account_1._address);
    await fxs_templeVault.connect(account_1).withdraw(LIST[0]);
    const AFTER = await fxs_temple_LP.balanceOf(account_1._address);
    const LISTAfter = await fxs_templeVault.getKekIdUser(account_1._address);
    console.log(AFTER.toString());
  });
});
