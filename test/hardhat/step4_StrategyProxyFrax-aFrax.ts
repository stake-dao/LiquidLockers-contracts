import { ethers, network } from "hardhat";
import { expect } from "chai";

import { BigNumber } from "@ethersproject/bignumber";
import { parseEther, parseUnits } from "@ethersproject/units";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "@ethersproject/contracts";
import { JsonRpcSigner } from "@ethersproject/providers";

import FxsLockerABI from "./fixtures/FXSLocker.json";
import FxsTempleGaugeFraxABI from "./fixtures/fxsTempleGauge.json";
import AFraxGaugeFRAXABI from "./fixtures/AFraxGaugeFrax.json"
import ERC20ABI from "./fixtures/ERC20.json";
import FXSABI from "./fixtures/FXS.json";
import DISTRIBUTORABI from "./fixtures/SDTDistributor.json";
import GAUGECONTROLLERABI from "./fixtures/GaugeControllerABI.json";
import SDFRAX3CRVABI from "./fixtures/sdFrax3CRV.json";

/* ======================== Time ======================= */
const DAY = 60 * 60 * 24;
const WEEK = 60 * 60 * 24 * 7;
const YEAR = 60 * 60 * 24 * 364;
const MAXLOCK = 3 * 60 * 60 * 24 * 364;

/* ====================== Address ====================== */
// ---- Address null ---- //
const NULL = "0x0000000000000000000000000000000000000000";
const RAND1 = "0x0000000000000000000000000000000000000001";
const RAND2 = "0x0000000000000000000000000000000000000002";
const RAND3 = "0x0000000000000000000000000000000000000003";

// ---- DAO Management ---- //
const MULTISIG = "0xF930EBBd05eF8b25B1797b9b2109DDC9B0d43063";
const STDDEPLOYER = "0x0dE5199779b43E13B3Bec21e91117E18736BC1A8";
const DEPLOYER_NEW = "0x0dE5199779b43E13B3Bec21e91117E18736BC1A8";
const MASTERCHEF = "0xfEA5E213bbD81A8a94D0E1eDB09dBD7CEab61e1c";
const TIMELOCK = "0xD3cFc4E65a73BB6C482383EB38f5C3E1d1411616";
const FEED = "0x29f3dd38dB24d3935CF1bf841e6b2B461A3E5D92";

// ---- Liquid Locker ---- //
const FXSACCUMULATOR = "0xF980B8A714Ce0cCB049f2890494b068CeC715c3f";
const FXSLOCKER = "0xCd3a267DE09196C48bbB1d9e842D7D7645cE448f";
const VE_SDT_FEE_FRAX_PROXY = "0x86Ebcd1bC876782670FE0B9ea23d8504569B9ffc";
const FEE_REGISTRY = "0x0f1dc3Bd5fE8a3034d6Df0A411Efc7916830d19c"
const POOL_REGISTRY = "0xd4525E29111edD74eAA425AB4c0Bc507bE3aC69F";
const LGV4_MODEL = "0x6aDb68d8C15954aD673d8f129857b34dc2F08bf2";
const VAULTV1 = "0xb787120Bc5C9e062Bf806F74837284CAa0A5740b";
const FRAX_STRATEGY = "0xf285Dec3217E779353350443fC276c07D05917c3";
const BOOSTER = "0x3f7c5021f5Bc634fae82cf9F67F19C5f05562bD3";

// ---- SDT ---- //
const SDT = "0x73968b9a57c6E53d41345FD57a6E6ae27d6CDB2F";
const VE_SDT = "0x0C30476f66034E11782938DF8e4384970B6c9e8a";
const VEBOOST = "0xD67bdBefF01Fc492f1864E61756E5FBB3f173506";
const SDT_HOLDER = "0x957fFde35b2d84F01d9BCaEb7528A2BCC268b9C1";
const VESDT_HOLDER = "0xdceb0bb3311342e3ce9e49f57affce9deac40ba1";
const VESDT_HOLDER2 = "0x9f5e6af744a137c9fefeedfb6b706b0640a57673";
const VESDT_HOLDER3 = "0x7132b5edc9ee267c58d3562d3e621384b18da7f3"; 
const SDFRAX3CRV = "0x5af15DA84A4a6EDf2d9FA6720De921E1026E37b7";

// ---- DAO Gauge ---- //
const DISTRIBUTOR = "0x9C99dffC1De1AfF7E7C1F36fCdD49063A281e18C";
const DISTRIBUTOR_OLD = "0x8Dc551B4f5203b51b5366578F42060666D42AB5E";
const GAUGECONTROLLER = "0x3F3F0776D411eb97Cfa4E3eb25F33c01ca4e7Ca8";
const GCADMIN_OLD = "0x0dE5199779b43E13B3Bec21e91117E18736BC1A8";
const GCADMIN = "0x30f9fFF0f55d21D666E28E650d0Eb989cA44e339";

const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const TEMPLE = "0x470EBf5f030Ed85Fc1ed4C2d36B9DD02e77CF1b7";
const TEMPLE_HOLDER = "0x758e83c114E36a28CA1f31C4d2ADB5Ec7c04C578";

const GOVFRAX = "0xB1748C79709f4Ba2Dd82834B8c82D4a505003f27";
const FRAX = "0x853d955aCEf822Db058eb8505911ED77F175b99e";
const FXS = "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0";
const FXS_HOLDER = "0xd53E50c63B0D549f142A2dCfc454501aaA5B7f3F";
const FRAX_GAUGE_FXS_REWARDS_DISTRIBUTOR = "0x278dC748edA1d8eFEf1aDFB518542612b49Fcd34";

const FXS_TEMPLE = "0x6021444f1706f15465bEe85463BCc7d7cC17Fc03";
const FXS_TEMPLE_GAUGE = "0x10460d02226d6ef7B2419aE150E6377BdbB7Ef16";
const FXS_TEMPLE_HOLDER = "0x8df937afdf1d08c2ba565d636ca1365a42144385";

// Tests for aFrax pool
const A_FRAX = "0xd4937682df3C8aEF4FE912A96A74121C0829E664";
const A_FRAX_GAUGE = "0x02577b426F223A6B4f2351315A19ecD6F357d65c";
const A_FRAX_HOLDER = "0xf7Eab72Ee14daD3DFEf597420F669c25B39f938C";
const A_FRAX_LGV4 = "0xF92E7769a454e377C507c9AcA66d0cC4C4463443"
const STK_AAVE = "0x4da27a545c0c5B758a6BA100e3a049001de870f5";

const ETH_100 = BigNumber.from(10).mul(BigNumber.from(10).pow(18)).toHexString();

describe("StakeDAO <> FRAX", function () {
  let localDeployer: SignerWithAddress;
  let dummyMs: SignerWithAddress;
  let nooby: SignerWithAddress;

  let deployer: JsonRpcSigner;
  let lpHolder: JsonRpcSigner;
  let noob: JsonRpcSigner;
  let timelock: JsonRpcSigner;
  let veSdtHolder: JsonRpcSigner;
  let veSdtHolder2: JsonRpcSigner;
  let veSdtHolder3: JsonRpcSigner;
  let govFrax: JsonRpcSigner;
  let sdtHolder: JsonRpcSigner;
  let deployer_new: JsonRpcSigner;
  let gcAdmin: JsonRpcSigner;
  let templeHolder: JsonRpcSigner;
  let fxsHolder: JsonRpcSigner;

  let locker: Contract;
  let fxsTemple: Contract;
  let frax: Contract;
  let fxs: Contract;
  let sdt: Contract;
  let veSdt: Contract;
  let veSDTBoost: Contract;
  let temple: Contract;
  let sdFrax3CRV: Contract;
  let veSDTProxy: Contract;
  let poolRegistry: Contract;
  let booster: Contract;
  let fraxStrategy: Contract;
  let fxsTempleGauge: Contract;
  let aFraxGauge: Contract;
  let afrax: Contract;
  let stkAAVE: Contract;
  let vaultV1Template: Contract;
  let personalVault1: Contract;
  let rewardsPID0: Contract;
  let rewardsPID0_2: Contract;
  let rewardsPID1: Contract;
  let rewardsPID1_New: Contract;
  let feeRegistry: Contract;
  let liquidityGauge: Contract;
  let liquidityGauge2: Contract;
  let distributor: Contract;
  let gaugeController: Contract;

  let VaultV1Contract: any;
  let LiquidityGaugeV4FraxContract: any;
  let LiquidityGaugeV4FraxContract2: any;

  before(async function () {
    /* ==== Get Signer ====*/
    [localDeployer, dummyMs, nooby] = await ethers.getSigners();
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [STDDEPLOYER]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [A_FRAX_HOLDER]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [TIMELOCK]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [VESDT_HOLDER]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [VESDT_HOLDER2]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [VESDT_HOLDER3]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [GOVFRAX]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SDT_HOLDER]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [DEPLOYER_NEW]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [GCADMIN]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [TEMPLE_HOLDER]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [FXS_HOLDER]
    });
    deployer = ethers.provider.getSigner(STDDEPLOYER);
    lpHolder = ethers.provider.getSigner(A_FRAX_HOLDER);
    noob = ethers.provider.getSigner(nooby.address);
    timelock = ethers.provider.getSigner(TIMELOCK);
    veSdtHolder = ethers.provider.getSigner(VESDT_HOLDER);
    veSdtHolder2 = ethers.provider.getSigner(VESDT_HOLDER2);
    veSdtHolder3 = ethers.provider.getSigner(VESDT_HOLDER3);
    govFrax = ethers.provider.getSigner(GOVFRAX);
    sdtHolder = ethers.provider.getSigner(SDT_HOLDER);
    deployer_new = ethers.provider.getSigner(DEPLOYER_NEW);
    gcAdmin = ethers.provider.getSigner(GCADMIN);
    templeHolder = ethers.provider.getSigner(TEMPLE_HOLDER);
    fxsHolder = ethers.provider.getSigner(FXS_HOLDER);

    /* ==== Set Balance Address ====  */
    await network.provider.send("hardhat_setBalance", [STDDEPLOYER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [A_FRAX_HOLDER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [VESDT_HOLDER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [TIMELOCK, ETH_100]);
    await network.provider.send("hardhat_setBalance", [GCADMIN, ETH_100]);
    await network.provider.send("hardhat_setBalance", [SDT_HOLDER, ETH_100]);

    /* ==== Get Contract Factory ==== */
    LiquidityGaugeV4FraxContract = await ethers.getContractFactory("LiquidityGaugeV4StratFrax");
    LiquidityGaugeV4FraxContract2 = await ethers.getContractFactory("LiquidityGaugeV4StratFrax");
    VaultV1Contract = await ethers.getContractFactory("VaultV1");

    /* ==== Get Contract At ==== */
    locker = await ethers.getContractAt(FxsLockerABI, FXSLOCKER);
    fxsTempleGauge = await ethers.getContractAt(FxsTempleGaugeFraxABI, FXS_TEMPLE_GAUGE);
    aFraxGauge = await ethers.getContractAt(AFraxGaugeFRAXABI, A_FRAX_GAUGE)
    fxsTemple = await ethers.getContractAt(ERC20ABI, FXS_TEMPLE);
    afrax = await ethers.getContractAt(ERC20ABI, A_FRAX);
    frax = await ethers.getContractAt(ERC20ABI, FRAX);
    fxs = await ethers.getContractAt(FXSABI, FXS);
    sdt = await ethers.getContractAt(ERC20ABI, SDT);
    veSdt = await ethers.getContractAt("veSDT", VE_SDT);
    temple = await ethers.getContractAt(ERC20ABI, TEMPLE);
    stkAAVE = await ethers.getContractAt(ERC20ABI, STK_AAVE);
    sdFrax3CRV = await ethers.getContractAt(SDFRAX3CRVABI, SDFRAX3CRV);
    distributor = await ethers.getContractAt(DISTRIBUTORABI, DISTRIBUTOR);
    gaugeController = await ethers.getContractAt(GAUGECONTROLLERABI, GAUGECONTROLLER);
    veSDTBoost = await ethers.getContractAt("veBoostProxy", VEBOOST);
    veSDTProxy = await ethers.getContractAt("VeSDTFeeFraxProxy", VE_SDT_FEE_FRAX_PROXY);
    feeRegistry = await ethers.getContractAt("FeeRegistry", FEE_REGISTRY);
    poolRegistry = await ethers.getContractAt("PoolRegistry", POOL_REGISTRY);
    liquidityGauge = await ethers.getContractAt("LiquidityGaugeV4StratFrax", LGV4_MODEL)
    liquidityGauge2 = await ethers.getContractAt("LiquidityGaugeV4StratFrax", LGV4_MODEL)
    vaultV1Template = await ethers.getContractAt("VaultV1", VAULTV1);
    fraxStrategy = await ethers.getContractAt("FraxStrategy", FRAX_STRATEGY);
    booster = await ethers.getContractAt("Booster", BOOSTER)

    // Set Liquid Locker as a valid veFXS Proxy
    //await aFraxGauge.connect(govFrax).toggleValidVeFXSProxy(locker.address);

    // lp holder lock SDT for veSDT
    //await sdt.connect(sdtHolder).transfer(lpHolder._address,parseUnits("200000", 18));
    //await sdt.connect(lpHolder).approve(VE_SDT,parseUnits("200000", 18));
    //await veSdt.connect(lpHolder).create_lock(parseUnits("200000", 18),1787603790); //1787603790 = 24 August 2026
    //let lastBlock = await ethers.provider.getBlock("latest");
    //const bal = await veSdt.connect(lpHolder)["balanceOf(address,uint256)"](lpHolder._address, lastBlock.timestamp)
    //const adjustedBal = await veSDTBoost.connect(lpHolder).adjusted_balance_of(lpHolder._address)
  });

  describe("### Testing Frax Strategies, boosted by Stake DAO Liquid Lockers 🐘💧🔒 ###", function () {
    const LOCKDURATION = 1 * DAY;
    const AMOUNT = 5_000;
    const LOCKEDAMOUNT = parseUnits(AMOUNT.toString(), 18);
    const LOCKEDAMOUNTx2 = parseUnits((AMOUNT * 2).toString(), 18);
    const PID = 1; // aFrax pool
    describe("Pool registry contract tests : ", function () {
      it("Should create a personal vault", async function () {
        const poolVaultLengthBefore = await poolRegistry.poolVaultLength(PID);

        await booster.connect(lpHolder).createVault(PID);

        const vaultAddress = await poolRegistry.vaultMap(PID, lpHolder._address);
        personalVault1 = VaultV1Contract.attach(vaultAddress);
        const vaultMap = await poolRegistry.vaultMap(PID, lpHolder._address);
        const poolVaultLengthAfter = await poolRegistry.poolVaultLength(PID);
        const veFXSMulti = await aFraxGauge.veFXSMultiplier(vaultAddress);
        const owner = await personalVault1.owner();
        const proxy = await personalVault1.usingProxy();

        //console.log((veFXSMulti/10**18).toString());
        //console.log(poolVaultLengthBefore)

        expect(vaultMap).eq(vaultAddress);
        //expect(poolVaultLengthBefore).eq(0);
        expect(poolVaultLengthAfter).eq(poolVaultLengthBefore.add(1));
        expect(veFXSMulti).gt(0);
        expect(owner).eq(lpHolder._address);
        expect(proxy).eq(FXSLOCKER);
      });
      it("Should add gauge to gauge controller and send reward to it", async function () { 
        const PoolInfo1 = await poolRegistry.poolInfo(PID);
        rewardsPID1 = LiquidityGaugeV4FraxContract.attach(PoolInfo1.rewardsAddress);

        let lastBlock = await ethers.provider.getBlock("latest");
        let currentTimestamp = lastBlock.timestamp - (lastBlock.timestamp % 86_400);

        await gaugeController.connect(gcAdmin)["add_gauge(address,int128,uint256)"](rewardsPID1.address, 0, 0); // gauge - type - weight
        await gaugeController
          .connect(veSdtHolder)
          ["vote_for_gauge_weights(address,uint256)"](rewardsPID1.address, 10000);
        await distributor.connect(deployer_new)["approveGauge(address)"](rewardsPID1.address);

        // increase the timestamp by 8 days
        await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 8]);
        await network.provider.send("evm_mine", []);

        // Rounded down to day
        lastBlock = await ethers.provider.getBlock("latest");
        currentTimestamp = lastBlock.timestamp - (lastBlock.timestamp % 86_400);
        const before_LGV4 = await sdt.balanceOf(rewardsPID1.address);

        const distribute = await distributor.connect(deployer_new).distribute(rewardsPID1.address);
        const RECEIPT = await distribute.wait();
        //console.log("Distribe events: ",RECEIPT.events)

        const after_LGV4 = await sdt.balanceOf(rewardsPID1.address);
        const get_gauge_weight = await gaugeController
          .connect(deployer)
          ["get_gauge_weight(address)"](rewardsPID1.address);
        const gauge_relative_weight = await gaugeController
          .connect(deployer)
          ["gauge_relative_weight(address,uint256)"](rewardsPID1.address, currentTimestamp);

        //console.log("get_gauge_weight: \t",get_gauge_weight.toString())
        //console.log("gauge_relative_weight: \t",gauge_relative_weight.toString())
        //console.log("Balance LGV4: \t\t", (before_LGV4/10**18).toString())
        //console.log("Balance LGV4: \t\t", (after_LGV4/10**18).toString())

        expect(get_gauge_weight).gt(0);
        expect(gauge_relative_weight).gt(0);
        expect(Number(after_LGV4) - Number(before_LGV4)).gt(0);
      });
      // ---- Reverting cases ---- //
      it("Should revert on creating a user vault", async function () {
        await expect(poolRegistry.connect(lpHolder).addUserVault(PID, lpHolder._address)).to.be.revertedWith("!op auth");
        await expect(booster.connect(lpHolder).createVault(PID)).to.be.revertedWith("already exists");
      });
    });
    describe("Personal Vault contract tests : ", function () {
      it("Should stake locked lp token", async function () {
        const vaultAddress = await poolRegistry.vaultMap(PID, lpHolder._address);
        const balanceOfBefore = await rewardsPID1.balanceOf(lpHolder._address);
        const totalSupplyBefore = await rewardsPID1.totalSupply();

        await afrax.connect(lpHolder).approve(personalVault1.address, LOCKEDAMOUNT);
        await personalVault1.connect(lpHolder).stakeLocked(LOCKEDAMOUNT, LOCKDURATION);

        const balanceOfAfter = await rewardsPID1.balanceOf(lpHolder._address);
        const totalSupplyAfter = await rewardsPID1.totalSupply();
        const lockedStakesOfLength = await aFraxGauge.lockedStakesOfLength(vaultAddress);
        const lockedStakesOf = await aFraxGauge.lockedStakesOf(personalVault1.address);

        expect(balanceOfBefore).eq(0);
        expect(balanceOfAfter).eq(LOCKEDAMOUNT);
        expect(totalSupplyBefore).eq(0);
        expect(totalSupplyAfter).eq(LOCKEDAMOUNT);
        expect(lockedStakesOfLength).eq(1);
        expect(lockedStakesOf[lockedStakesOfLength - 1]["kek_id"]).not.eq(0);
        expect(lockedStakesOf[lockedStakesOfLength - 1]["liquidity"]).eq(LOCKEDAMOUNT);
      });
      it("Should add liquidity to a previous deposit", async function () {
        const lockedStakesOfBefore = await aFraxGauge.lockedStakesOf(personalVault1.address);

        await afrax.connect(lpHolder).approve(personalVault1.address, LOCKEDAMOUNT);
        await personalVault1.connect(lpHolder).lockAdditional(lockedStakesOfBefore[0]["kek_id"], LOCKEDAMOUNT);

        const lockedStakesOfLength = await aFraxGauge.lockedStakesOfLength(personalVault1.address);
        const lockedStakesOfAfter = await aFraxGauge.lockedStakesOf(personalVault1.address);
        const balanceOf = await rewardsPID1.balanceOf(lpHolder._address);
        const totalSupply = await rewardsPID1.totalSupply();

        expect(lockedStakesOfAfter[lockedStakesOfLength - 1]["liquidity"]).gt(LOCKEDAMOUNTx2);
        expect(balanceOf).eq(LOCKEDAMOUNTx2);
        expect(totalSupply).eq(LOCKEDAMOUNTx2);
      });
      it("Should get reward", async function () {
        const before_Rewards1 = await stkAAVE.balanceOf(lpHolder._address);
        const before_Fxs = await fxs.balanceOf(lpHolder._address);
        const before_Fxs_multi = await fxs.balanceOf(MULTISIG);
        const before_Fxs_accum = await fxs.balanceOf(FXSACCUMULATOR);
        const before_Fxs_veSDT = await fxs.balanceOf(VE_SDT_FEE_FRAX_PROXY);
        const before_Sdt = await sdt.balanceOf(lpHolder._address);
        const before_Sdt_vault = await sdt.balanceOf(personalVault1.address);
        const rewardRateReward0 = await aFraxGauge.rewardRates(0)
        const rewardRateReward1 = await aFraxGauge.rewardRates(1)
        //console.log(rewardRateReward0,rewardRateReward1)

        await network.provider.send("evm_increaseTime", [DAY]);
        await network.provider.send("evm_mine", []);

        await aFraxGauge.connect(lpHolder).sync()
        const earned = await personalVault1.connect(lpHolder).earned();
        await personalVault1.connect(lpHolder)["getReward()"]();

        const after_Reward1 = await stkAAVE.balanceOf(lpHolder._address);
        const after_Fxs = await fxs.balanceOf(lpHolder._address);
        const after_Fxs_multi = await fxs.balanceOf(MULTISIG);
        const after_Fxs_accum = await fxs.balanceOf(FXSACCUMULATOR);
        const after_Fxs_veSDT = await fxs.balanceOf(VE_SDT_FEE_FRAX_PROXY);
        const after_Sdt = await sdt.balanceOf(lpHolder._address);
        const after_Sdt_vault = await sdt.balanceOf(personalVault1.address);

        //console.log(" ---- Reward Estimation    ----")
        //console.log("Earned FXS :\t",(earned[1][0]/10**18).toString());
        //console.log("Earned stk:\t",(earned[1][1]/10**18).toString());
        //console.log("Earned SDT:\t",(earned[1][2]/10**18).toString());
        //console.log(" ---- User Reward Received ----")
        //console.log("FXS gain :\t",(after_Fxs - before_Fxs)/10**18)
        //console.log("stk gain :\t",(after_Reward1 - before_Rewards1)/10**18)
        //console.log("SDT gain:\t",(after_Sdt - before_Sdt)/10**18)
        //console.log("SDT gain vault:\t",(after_Sdt_vault - before_Sdt_vault)/10**18)
        //console.log(" ---- DAO Reward Received  ----")
        //console.log("FXS mult :\t",(after_Fxs_multi - before_Fxs_multi)/10**18)
        //console.log("FXS accu :\t",(after_Fxs_accum - before_Fxs_accum)/10**18)
        //console.log("FXS veSDT :\t",(after_Fxs_veSDT - before_Fxs_veSDT)/10**18)

        expect(rewardRateReward0).gt(0);
        expect(after_Fxs - before_Fxs).gt(0);
        expect(after_Fxs_multi - before_Fxs_multi).gt(0);
        expect(after_Fxs_accum - before_Fxs_accum).gt(0);
        expect(after_Fxs_veSDT - before_Fxs_veSDT).gt(0);
        expect(after_Sdt - before_Sdt).gt(0);
        if(rewardRateReward1>0) {
          expect(after_Reward1 - before_Rewards1).gt(0);
        }
      });
      it("Should get reward without claiming", async function () {
        const before_Rewards1 = await stkAAVE.balanceOf(lpHolder._address);
        const before_Fxs = await fxs.balanceOf(lpHolder._address);
        const before_Fxs_multi = await fxs.balanceOf(MULTISIG);
        const before_Fxs_accum = await fxs.balanceOf(FXSACCUMULATOR);
        const before_Fxs_veSDT = await fxs.balanceOf(VE_SDT_FEE_FRAX_PROXY);
        const before_Sdt = await sdt.balanceOf(lpHolder._address);
        const rewardRateReward1 = await aFraxGauge.rewardRates(1)

        await network.provider.send("evm_increaseTime", [2*DAY]);
        await network.provider.send("evm_mine", []);
        const earned = await personalVault1.connect(lpHolder).earned();
        await personalVault1.connect(lpHolder)["getReward(bool)"](false);

        const after_Reward1 = await stkAAVE.balanceOf(lpHolder._address);
        const after_Fxs = await fxs.balanceOf(lpHolder._address);
        const after_Fxs_multi = await fxs.balanceOf(MULTISIG);
        const after_Fxs_accum = await fxs.balanceOf(FXSACCUMULATOR);
        const after_Fxs_veSDT = await fxs.balanceOf(VE_SDT_FEE_FRAX_PROXY);
        const after_Sdt = await sdt.balanceOf(lpHolder._address);

        //console.log(" ---- Reward Estimation    ----")
        //console.log("Earned FXS :\t",(earned[1][0]/10**18).toString());
        //console.log("Earned stk:\t",(earned[1][1]/10**18).toString());
        //console.log("Earned SDT:\t",(earned[1][2]/10**18).toString());
        //console.log(" ---- User Reward Received ----")
        //console.log("stk gain :\t",(after_Reward1 - before_Rewards1)/10**18)
        //console.log("SDT gain:\t",(after_Sdt - before_Sdt)/10**18)
        //console.log(" ---- DAO Reward Received  ----")
        //console.log("FXS gain :\t",(after_Fxs - before_Fxs)/10**18)
        //console.log("FXS mult :\t",(after_Fxs_multi - before_Fxs_multi)/10**18)
        //console.log("FXS accu :\t",(after_Fxs_accum - before_Fxs_accum)/10**18)
        //console.log("FXS veSDT :\t",(after_Fxs_veSDT - before_Fxs_veSDT)/10**18)

        expect(after_Fxs - before_Fxs).eq(0);
        expect(after_Fxs_multi - before_Fxs_multi).eq(0);
        expect(after_Fxs_accum - before_Fxs_accum).eq(0);
        expect(after_Fxs_veSDT - before_Fxs_veSDT).eq(0);
        if(rewardRateReward1>0) {
          expect(after_Reward1 - before_Rewards1).gt(0);
        }
        expect(after_Sdt - before_Sdt).gt(0);
      });
      it("Should get reward for just specific token", async function () {
        const before_Rewards1 = await stkAAVE.balanceOf(lpHolder._address);
        const before_Fxs = await fxs.balanceOf(lpHolder._address);
        const before_Fxs_multi = await fxs.balanceOf(MULTISIG);
        const before_Fxs_accum = await fxs.balanceOf(FXSACCUMULATOR);
        const before_Fxs_veSDT = await fxs.balanceOf(VE_SDT_FEE_FRAX_PROXY);
        const before_Sdt = await sdt.balanceOf(lpHolder._address);
        const rewardRateReward1 = await aFraxGauge.rewardRates(1)

        await network.provider.send("evm_increaseTime", [DAY]);
        await network.provider.send("evm_mine", []);
        const earned = await personalVault1.connect(lpHolder).earned();
        await personalVault1.connect(lpHolder)["getReward(bool,address[])"](true, []);

        const after_Reward1 = await stkAAVE.balanceOf(lpHolder._address);
        const after_Fxs = await fxs.balanceOf(lpHolder._address);
        const after_Fxs_multi = await fxs.balanceOf(MULTISIG);
        const after_Fxs_accum = await fxs.balanceOf(FXSACCUMULATOR);
        const after_Fxs_veSDT = await fxs.balanceOf(VE_SDT_FEE_FRAX_PROXY);
        const after_Sdt = await sdt.balanceOf(lpHolder._address);

        //console.log(" ---- Reward Estimation    ----")
        //console.log("Earned FXS :\t",(earned[1][0]/10**18).toString());
        //console.log("Earned stk:\t",(earned[1][1]/10**18).toString());
        //console.log("Earned SDT:\t",(earned[1][2]/10**18).toString());
        //console.log(" ---- User Reward Received ----")
        //console.log("stk gain :\t",(after_Reward1 - before_Rewards1)/10**18)
        //console.log("SDT gain:\t",(after_Sdt - before_Sdt)/10**18)
        //console.log(" ---- DAO Reward Received  ----")
        //console.log("FXS gain :\t",(after_Fxs - before_Fxs)/10**18)
        //console.log("FXS mult :\t",(after_Fxs_multi - before_Fxs_multi)/10**18)
        //console.log("FXS accu :\t",(after_Fxs_accum - before_Fxs_accum)/10**18)
        //console.log("FXS veSDT :\t",(after_Fxs_veSDT - before_Fxs_veSDT)/10**18)

        expect(after_Fxs - before_Fxs).gt(0);
        expect(after_Fxs_multi - before_Fxs_multi).gt(0);
        expect(after_Fxs_accum - before_Fxs_accum).gt(0);
        expect(after_Fxs_veSDT - before_Fxs_veSDT).gt(0);
        expect(after_Reward1 - before_Rewards1).eq(0);
        expect(after_Sdt - before_Sdt).gt(0);
      });
      it("Should time jump and withdraw locked", async function () {
        const lockedStakesOfBefore = await aFraxGauge.lockedStakesOf(personalVault1.address);
        await network.provider.send("evm_increaseTime", [DAY]);
        await network.provider.send("evm_mine", []);

        const before_Rewards1 = await stkAAVE.balanceOf(lpHolder._address);
        const before_Fxs = await fxs.balanceOf(lpHolder._address);
        const before_Sdt = await sdt.balanceOf(lpHolder._address);
        const before_lp = await afrax.balanceOf(lpHolder._address);
        const before_working_balance = await rewardsPID1.working_balances(lpHolder._address)
        const rewardRateReward1 = await aFraxGauge.rewardRates(1)

        const balanceOfBefore = await rewardsPID1.balanceOf(lpHolder._address);
        const totalSupplyBefore = await rewardsPID1.totalSupply();

        await fxs.connect(fxsHolder).transfer(FRAX_GAUGE_FXS_REWARDS_DISTRIBUTOR, parseUnits((1_000_000).toString(), 18))
        const pf1 = await aFraxGauge.periodFinish()

        await aFraxGauge.connect(lpHolder).sync()
        const earned = await personalVault1.earned();
        await personalVault1.connect(lpHolder).withdrawLocked(lockedStakesOfBefore[0]["kek_id"], true);
        
        const pf2 = await aFraxGauge.periodFinish()
        const after_working_balance = await rewardsPID1.working_balances(lpHolder._address)
        const after_Rewards1 = await stkAAVE.balanceOf(lpHolder._address);
        const after_Fxs = await fxs.balanceOf(lpHolder._address);
        const after_Sdt = await sdt.balanceOf(lpHolder._address);
        const after_lp = await afrax.balanceOf(lpHolder._address);

        const balanceOfAfter = await rewardsPID1.balanceOf(lpHolder._address);
        const totalSupplyAfter = await rewardsPID1.totalSupply();

        //console.log("Working balance Before : ", before_working_balance.toString()/10**18)
        //console.log("Working balance After : ", after_working_balance.toString()/10**18)
        //console.log(" ---- Reward Estimation    ----")
        //console.log("Finish period before sync : ",pf1.toString())
        //console.log("Finish period after sync : ",pf2.toString())
        //console.log("Earned FXS :\t",(earned[1][0]/10**18).toString());
        //console.log("Earned stk:\t",(earned[1][1]/10**18).toString());
        //console.log("Earned SDT:\t",(earned[1][2]/10**18).toString());
        //console.log(" ---- User Reward Received ----")
        //console.log("FXS gain :\t",(after_Fxs - before_Fxs)/10**18)
        //console.log("stk gain :\t",(after_Rewards1 - before_Rewards1)/10**18)
        //console.log("SDT gain:\t",(after_Sdt - before_Sdt)/10**18)

        expect(earned[1][0]).gt(0)
        expect(earned[1][2]).gt(0)
        expect(after_Fxs - before_Fxs).gt(0);
        expect(after_Sdt - before_Sdt).gt(0);
        expect(after_lp - before_lp).gt(AMOUNT * 2 * 10 ** 18);
        if(rewardRateReward1>0) {
          expect(earned[1][1]).gt(0)
          expect(after_Rewards1 - before_Rewards1).gt(0);
        }

        expect(balanceOfBefore).eq(LOCKEDAMOUNTx2);
        expect(balanceOfAfter).eq(0);
        expect(totalSupplyBefore).eq(LOCKEDAMOUNTx2);
        expect(totalSupplyAfter).eq(0);
      });
      it("Should update the pool reward for the user personal vault, after new pool reward creation", async function () {
        // deposit LP into gauge 
        await afrax.connect(lpHolder).approve(personalVault1.address, LOCKEDAMOUNTx2);
        await personalVault1.connect(lpHolder).stakeLocked(LOCKEDAMOUNTx2, LOCKDURATION);

        const before_Sdt = await sdt.balanceOf(lpHolder._address);
        const old_lg = await poolRegistry.poolInfo(PID);
        const old_lg_vault = await personalVault1.rewards()
        //console.log(old_lg)

        // time jump 1 day and distribute SDT reward from actual LGV4
        await network.provider.send("evm_increaseTime", [DAY]);
        await network.provider.send("evm_mine", []);
        await distributor.connect(deployer_new).distribute(rewardsPID1.address);

        // Set a new LGV4 on the poolRegistry
        const NbrsOfPool = await poolRegistry.poolLength();
        await booster.connect(deployer).setPoolRewardImplementation(liquidityGauge2.address);
        //console.log(liquidityGauge2.address)
        // Update pool id with new LGV4 address
        await booster.connect(deployer).createNewPoolRewards(PID);
        const new_lg = await poolRegistry.poolInfo(PID);
        //console.log(new_lg)
        rewardsPID1_New = LiquidityGaugeV4FraxContract.attach(new_lg.rewardsAddress);

        // Add new LGV4 to gauge controller, vote for it, approve it on distributor
        await gaugeController.connect(gcAdmin)["add_gauge(address,int128,uint256)"](rewardsPID1_New.address, 0, 0); // gauge - type - weight
        await gaugeController
        .connect(veSdtHolder3)
        ["vote_for_gauge_weights(address,uint256)"](rewardsPID1_New.address, 10_000);
        await distributor.connect(deployer_new)["approveGauge(address)"](rewardsPID1_New.address);

        // User update the personnal vault with new LGV4 address
        await personalVault1.connect(lpHolder).changeRewards();

        // Time jump 8 days, and distribute SDT reward to the new LGV4
        //await network.provider.send("evm_increaseTime", [8*DAY]);
        //await network.provider.send("evm_mine", []);
        //const distribute = await distributor.connect(deployer_new).distribute(rewardsPID1_New.address);

        const new_lg_vault = await personalVault1.rewards()
        const after_Sdt = await sdt.balanceOf(lpHolder._address);
        const old_lg_balance = await rewardsPID1.balanceOf(lpHolder._address);
        const new_lg_balance = await rewardsPID1_New.balanceOf(lpHolder._address);
        const old_lg_supply = await rewardsPID1.totalSupply();
        const new_lg_supply = await rewardsPID1_New.totalSupply();

        //console.log("SDT gain:\t",(after_Sdt - before_Sdt)/10**18)

        expect(old_lg.rewardsAddress).not.eq(new_lg.rewardsAddress);
        expect(old_lg.rewardsAddress).eq(old_lg_vault)
        expect(new_lg.rewardsAddress).eq(new_lg_vault)
        expect(after_Sdt - before_Sdt).gt(0); // because user get SDT reward from old LGV4 when changeRewards()
        expect(old_lg).not.eq(new_lg);
        expect(old_lg_balance).eq(0);
        expect(new_lg_balance).eq(LOCKEDAMOUNTx2);
        expect(old_lg_supply).eq(0);
        expect(new_lg_supply).eq(LOCKEDAMOUNTx2);
      });
      it("Should time jump and withdraw locked, after new pool reward creation ", async function () {
        const lockedStakesOfBefore = await aFraxGauge.lockedStakesOf(personalVault1.address);
        await network.provider.send("evm_increaseTime", [14*DAY]);
        await network.provider.send("evm_mine", []);
        const distribut = await distributor.connect(deployer_new).distribute(rewardsPID1_New.address);
        //const tx = await distribut.wait()
        //console.log(tx.events)

        const before_Rewards1 = await stkAAVE.balanceOf(lpHolder._address);
        const before_Fxs = await fxs.balanceOf(lpHolder._address);
        const before_Sdt = await sdt.balanceOf(lpHolder._address);
        const before_lp = await afrax.balanceOf(lpHolder._address);
        const balanceOfBefore = await rewardsPID1_New.balanceOf(lpHolder._address);
        const totalSupplyBefore = await rewardsPID1_New.totalSupply();
        const rewardRateReward1 = await aFraxGauge.rewardRates(1)

        await aFraxGauge.connect(lpHolder).sync()
        const earned = await personalVault1.earned();
        await personalVault1
          .connect(lpHolder)
          .withdrawLocked(lockedStakesOfBefore[lockedStakesOfBefore.length - 1]["kek_id"], true);

        const after_Reward1 = await stkAAVE.balanceOf(lpHolder._address);
        const after_Fxs = await fxs.balanceOf(lpHolder._address);
        const after_Sdt = await sdt.balanceOf(lpHolder._address);
        const after_lp = await afrax.balanceOf(lpHolder._address);

        const balanceOfAfter = await rewardsPID1_New.balanceOf(lpHolder._address);
        const totalSupplyAfter = await rewardsPID1_New.totalSupply();

        //console.log(" ---- Reward Estimation    ----")
        //console.log("Earned FXS :\t",(earned[1][0]/10**18).toString());
        //console.log("Earned TEM :\t",(earned[1][1]/10**18).toString());
        //console.log("Earned SDT :\t",(earned[1][2]/10**18).toString());
        //console.log(" ---- User Reward Received ----")
        //console.log("FXS gain :\t",(after_Fxs - before_Fxs)/10**18)
        //console.log("stk gain :\t",(after_Reward1 - before_Rewards1)/10**18)
        //console.log("SDT gain:\t",(after_Sdt - before_Sdt)/10**18)

        expect(earned[1][0]).gt(0)
        expect(earned[1][2]).gt(0)
        expect(after_Fxs - before_Fxs).gt(0);
        expect(after_Sdt - before_Sdt).gt(0);
        expect(after_lp - before_lp).greaterThanOrEqual(AMOUNT * 2 * 10 ** 18)
        if(rewardRateReward1>0) {
          expect(earned[1][1]).gt(0)
          expect(after_Reward1 - before_Rewards1).gt(0);
        }

        expect(balanceOfBefore).eq(LOCKEDAMOUNTx2);
        expect(balanceOfAfter).eq(0);
        expect(totalSupplyBefore).eq(LOCKEDAMOUNTx2);
        expect(totalSupplyAfter).eq(0);
      });
      // ---- Reverting cases ---- //
      it("Should revert on stakeLocked because not owner", async function () {
        await expect(personalVault1.connect(noob).stakeLocked(LOCKDURATION, LOCKDURATION)).to.be.revertedWith("!auth");
        await expect(feeRegistry.connect(deployer).setMultisig(NULL)).to.be.revertedWith("!address(0)");
      });
      it("Should revert on lockAdditional because kekid doesn't match", async function () {
        await afrax.connect(lpHolder).approve(personalVault1.address, LOCKEDAMOUNTx2);
        await personalVault1.connect(lpHolder).stakeLocked(LOCKEDAMOUNT, LOCKDURATION);
        const wrongKekId = "0xc074440c3abd793f5926f435dd2c9323436647588a1c1deb2ab0a93be0406285";
        await expect(personalVault1.connect(lpHolder).lockAdditional(wrongKekId, LOCKEDAMOUNT)).to.be.revertedWith(
          "Stake not found"
        );
      });
      it("Should revert on withdrawLocked because not enough time waited", async function () {
        const lockedStakesOfBefore = await aFraxGauge.lockedStakesOf(personalVault1.address);
        await expect(
          personalVault1
            .connect(lpHolder)
            .withdrawLocked(lockedStakesOfBefore[lockedStakesOfBefore.length - 1]["kek_id"], true)
        ).to.be.revertedWith("Stake is still locked!");
      });
      it("Should revert on changing Reward because no new LGV4", async function() {
        await expect(personalVault1.connect(lpHolder).changeRewards()).to.be.revertedWith("!rewardsAddress")
      })
    });
  }); 
});
