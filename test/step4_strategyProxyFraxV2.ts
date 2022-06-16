import { ethers, network } from "hardhat";
import { expect } from "chai";

import { BigNumber } from "@ethersproject/bignumber";
import { parseEther, parseUnits } from "@ethersproject/units";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "@ethersproject/contracts";
import { JsonRpcSigner } from "@ethersproject/providers";

import FxsLockerABI from "./fixtures/FXSLocker.json";
import FxsTempleGaugeFraxABI from "./fixtures/fxsTempleGauge.json";
import MASTERCHEFABI from "./fixtures/Masterchef.json";
import ERC20ABI from "./fixtures/ERC20.json";
import FXSABI from "./fixtures/FXS.json";
import DISTRIBUTORABI from "./fixtures/SDTDistributor.json"
import GAUGECONTROLLERABI from "./fixtures/GaugeControllerABI.json"
import { Console, info } from "console";
import exp from "constants";
import { type } from "os";
import { poll } from "ethers/lib/utils";
import { any } from "hardhat/internal/core/params/argumentTypes";
import { access } from "fs";
import { cpuUsage } from "process";

/* ==== Time ==== */
const DAY = 60 * 60 * 24;
const WEEK = 60 * 60 * 24 * 7;
const YEAR = 60 * 60 * 24 * 364;
const MAXLOCK = 3 * 60 * 60 * 24 * 364;

/* ==== Address ==== */
const NULL = "0x0000000000000000000000000000000000000000";
const RAND1= "0x0000000000000000000000000000000000000001";
const RAND2= "0x0000000000000000000000000000000000000002";
const RAND3= "0x0000000000000000000000000000000000000003";
const STDDEPLOYER = "0xb36a0671b3d49587236d7833b01e79798175875f";
const SDT = "0x73968b9a57c6e53d41345fd57a6e6ae27d6cdb2f";
const SDT_HOLDER = "0x957fFde35b2d84F01d9BCaEb7528A2BCC268b9C1";
const VE_SDT = "0x0C30476f66034E11782938DF8e4384970B6c9e8a";
const VESDT_HOLDER = "0xdceb0bb3311342e3ce9e49f57affce9deac40ba1";
const MASTERCHEF = "0xfEA5E213bbD81A8a94D0E1eDB09dBD7CEab61e1c";
const SDTDPROXY = "0x9C99dffC1De1AfF7E7C1F36fCdD49063A281e18C";
const DEPLOYER_NEW = "0x0dE5199779b43E13B3Bec21e91117E18736BC1A8";
const DISTRIBUTOR = "0x9C99dffC1De1AfF7E7C1F36fCdD49063A281e18C"
const GAUGECONTROLLER = "0x3F3F0776D411eb97Cfa4E3eb25F33c01ca4e7Ca8";
const GCADMIN = "0x0dE5199779b43E13B3Bec21e91117E18736BC1A8";
const MULTISIG = "0xF930EBBd05eF8b25B1797b9b2109DDC9B0d43063";

const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const TEMPLE = "0x470EBf5f030Ed85Fc1ed4C2d36B9DD02e77CF1b7";

const FRAX = "0x853d955aCEf822Db058eb8505911ED77F175b99e";
const FXS = "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0";
const GOVFRAX = "0xB1748C79709f4Ba2Dd82834B8c82D4a505003f27";
const FXS_TEMPLE = "0x6021444f1706f15465bEe85463BCc7d7cC17Fc03";
const FXS_TEMPLE_GAUGE = "0x10460d02226d6ef7B2419aE150E6377BdbB7Ef16";
const FXS_TEMPLE_HOLDER = "0xc00674553a6E3Bf232E09852510F5feC90A519f9";

const TIMELOCK = "0xD3cFc4E65a73BB6C482383EB38f5C3E1d1411616";
const FXSACCUMULATOR = "0x1CC16bEdaaCD15848bcA5eB80188e0931bC59fB2";
const FXSLOCKER = "0xCd3a267DE09196C48bbB1d9e842D7D7645cE448f";

const CVXFEEREGISTRY = "0xC9aCB83ADa68413a6Aa57007BC720EE2E2b3C46D";

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
  let govFrax: JsonRpcSigner;
  let sdtHolder: JsonRpcSigner;
  let deployer_new: JsonRpcSigner;
  let gcAdmin: JsonRpcSigner;

  let locker: Contract;
  let fxsTemple: Contract;
  let frax: Contract;
  let fxs: Contract;
  let sdt: Contract;
  let temple: Contract;
  let veSDTProxy: Contract;
  let masterchef: Contract;
  let sdtDistributor: Contract;
  let gc: Contract;
  let sdtDProxy: Contract;
  let poolRegistry: Contract;
  let booster: Contract;
  let fxsTempleGauge: Contract;
  let vaultV1Template: Contract;
  let personalVault1: Contract;
  let rewardsPID0: Contract;
  let rewardsPID1: Contract;
  let rewardsPID0_2: Contract;
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
      params: [FXS_TEMPLE_HOLDER]
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
    deployer = ethers.provider.getSigner(STDDEPLOYER);
    lpHolder = ethers.provider.getSigner(FXS_TEMPLE_HOLDER);
    noob = ethers.provider.getSigner(nooby.address);
    timelock = ethers.provider.getSigner(TIMELOCK);
    veSdtHolder = ethers.provider.getSigner(VESDT_HOLDER);
    govFrax = ethers.provider.getSigner(GOVFRAX);
    sdtHolder = ethers.provider.getSigner(SDT_HOLDER)
    deployer_new = ethers.provider.getSigner(DEPLOYER_NEW);
    gcAdmin = ethers.provider.getSigner(GCADMIN)

    /* ==== Set Balance Address ====  */
    await network.provider.send("hardhat_setBalance", [STDDEPLOYER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [FXS_TEMPLE_HOLDER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [VESDT_HOLDER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [TIMELOCK, ETH_100]);

    /* ==== Get Contract Factory ==== */
    const SdtDistributor = await ethers.getContractFactory("SdtDistributorV2");
    const GaugeController = await ethers.getContractFactory("GaugeController");
    const Proxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    const veSdtFxsProxyFactory = await ethers.getContractFactory("veSDTFeeFraxProxy");
    const poolRegistryContract = await ethers.getContractFactory("PoolRegistry");
    const boosterContract = await ethers.getContractFactory("Booster");
    const feeRegistryContract = await ethers.getContractFactory("FeeRegistry");
    LiquidityGaugeV4FraxContract = await ethers.getContractFactory("LiquidityGaugeV4StratFrax");
    LiquidityGaugeV4FraxContract2 = await ethers.getContractFactory("LiquidityGaugeV4StratFrax");
    VaultV1Contract = await ethers.getContractFactory("VaultV1");

    /* ==== Get Contract At ==== */
    locker = await ethers.getContractAt(FxsLockerABI, FXSLOCKER);
    fxsTempleGauge = await ethers.getContractAt(FxsTempleGaugeFraxABI, FXS_TEMPLE_GAUGE);
    fxsTemple = await ethers.getContractAt(ERC20ABI, FXS_TEMPLE);
    frax = await ethers.getContractAt(ERC20ABI, FRAX);
    fxs = await ethers.getContractAt(FXSABI, FXS);
    sdt = await ethers.getContractAt(ERC20ABI, SDT);
    temple = await ethers.getContractAt(ERC20ABI, TEMPLE);
    masterchef = await ethers.getContractAt(MASTERCHEFABI, MASTERCHEF);
    distributor = await ethers.getContractAt(DISTRIBUTORABI, DISTRIBUTOR)
    gaugeController = await ethers.getContractAt(GAUGECONTROLLERABI, GAUGECONTROLLER)


    /* ==== Deployement Section ==== */
    veSDTProxy = await veSdtFxsProxyFactory.deploy([FXS, WETH, FRAX]);
    feeRegistry = await feeRegistryContract.connect(deployer).deploy(veSDTProxy.address);
    poolRegistry = await poolRegistryContract.connect(deployer).deploy();
    liquidityGauge = await LiquidityGaugeV4FraxContract.connect(deployer).deploy();
    liquidityGauge2 = await LiquidityGaugeV4FraxContract2.connect(deployer).deploy(); // deploy second fake gauge for test
    vaultV1Template = await VaultV1Contract.connect(deployer).deploy();
    // To be removed when we deploy feeRegistry
    //await vaultV1Template.connect(deployer).setFeeRegistry(feeRegistry.address)
    booster = await boosterContract.connect(deployer).deploy(locker.address, poolRegistry.address);//, CVXFEEREGISTRY);

    // LL give governance right to the Booster
    await locker.connect(deployer).setGovernance(booster.address);
    // Set LL as a valid veFXS Proxy
    await fxsTempleGauge.connect(govFrax).toggleValidVeFXSProxy(locker.address);

  });

  // Contract Todo  : - Creat the veSDTFeeFraxProxy
  //  Testing Todo  : - Reverting case for personal vault section
  //                  - Add more tests for Liquidity gauge section 
  //                      - function _update_liquidity_limit : voting total
  //                      - function kick
  //                  - Reverting case for Liquidity gauge section

  describe("## Testing booster contract ###", function () {
    const LOCKDURATION = 2 * WEEK;
    const LOCKEDAMOUNT = parseUnits("150", 18);
    const LOCKEDAMOUNTx2 = parseUnits("300", 18);

    describe("Pool registry section : ", function () {

      describe("Testing all the functions", function () {
        it("Should set booster contract as operator on poolRegistry", async function () {
          const opBefore = await poolRegistry.operator();
          await poolRegistry.connect(deployer).setOperator(booster.address);
          const opAfter = await poolRegistry.operator();

          expect(opBefore).eq(NULL);
          expect(opAfter).eq(booster.address);
        });

        it("Should set pool reward implementation to the liquidity gauge contract", async function () {
          const rewardImpBefore = await poolRegistry.rewardImplementation();
          await booster.connect(deployer).setPoolRewardImplementation(liquidityGauge.address);
          const rewardImpAfter = await poolRegistry.rewardImplementation();

          //console.log(rewardImpBefore,rewardImpAfter)
          expect(rewardImpBefore).eq(NULL);
          expect(rewardImpAfter).eq(liquidityGauge.address);
        });

        it("Should set distributor", async function () {
          await booster.connect(deployer).setDistributor(distributor.address);
        });

        it("Should set reward active on creation to true", async function () {
          const before = await poolRegistry.rewardsStartActive();
          await booster.connect(deployer).setRewardActiveOnCreation(true);
          const after = await poolRegistry.rewardsStartActive();

          //console.log(before, after)

          expect(before).eq(false);
          expect(after).eq(true);
        });

        it("Should create a new pool on poolRegistry", async function () {
          await booster.connect(deployer).addPool(vaultV1Template.address, FXS_TEMPLE_GAUGE, FXS_TEMPLE);
          const NbrsOfPool = await poolRegistry.poolLength();
          const PoolInfo0 = await poolRegistry.poolInfo(0);
          rewardsPID0 = LiquidityGaugeV4FraxContract.attach(PoolInfo0.rewardsAddress);

          //console.log(PoolInfo0)

          expect(NbrsOfPool).eq(1);
          expect(PoolInfo0.implementation).eq(vaultV1Template.address);
          expect(PoolInfo0.stakingAddress).eq(FXS_TEMPLE_GAUGE);
          expect(PoolInfo0.stakingToken).eq(FXS_TEMPLE);
          expect(PoolInfo0.rewardsAddress).eq(rewardsPID0.address);
          expect(PoolInfo0.active).eq(1);
        });

        it("Should create a personal vault", async function () {
          const poolVaultLengthBefore = await poolRegistry.poolVaultLength(0);

          await booster.connect(lpHolder).createVault(0);

          const vaultAddress = await poolRegistry.vaultMap(0, lpHolder._address);
          personalVault1 = VaultV1Contract.attach(vaultAddress);
          const vaultMap = await poolRegistry.vaultMap(0, lpHolder._address);
          const poolVaultLengthAfter = await poolRegistry.poolVaultLength(0);
          const veFXSMulti = await fxsTempleGauge.veFXSMultiplier(vaultAddress);
          const owner = await personalVault1.owner();
          const proxy = await personalVault1.usingProxy()

          //console.log((veFXSMulti/10**18).toString());
          //console.log(poolVaultLengthBefore)

          expect(vaultMap).eq(vaultAddress);
          expect(poolVaultLengthBefore).eq(0);
          expect(poolVaultLengthAfter).eq(1);
          expect(veFXSMulti).gt(0);
          expect(owner).eq(lpHolder._address);
          expect(proxy).eq(FXSLOCKER)

          // To be used after, do not delete it!!
          //await personalVault1.connect(deployer).setFeeRegistry(feeRegistry.address)
        });

        it("Should create a new pool reward for an existing pool", async function () {
          await booster.connect(deployer).setPoolRewardImplementation(liquidityGauge2.address);
          await booster.connect(deployer).createNewPoolRewards(0);
          const NbrsOfPool = await poolRegistry.poolLength();
          const PoolInfo0 = await poolRegistry.poolInfo(0);
          rewardsPID0_2 = LiquidityGaugeV4FraxContract.attach(PoolInfo0.rewardsAddress);

          expect(NbrsOfPool).eq(1);
          expect(PoolInfo0.implementation).eq(vaultV1Template.address);
          expect(PoolInfo0.stakingAddress).eq(FXS_TEMPLE_GAUGE);
          expect(PoolInfo0.stakingToken).eq(FXS_TEMPLE);
          expect(PoolInfo0.rewardsAddress).eq(rewardsPID0_2.address);
          expect(PoolInfo0.active).eq(1);
        });
        
        it("Should desactivate a pool", async function () {
          const PoolInfo0Before = await poolRegistry.poolInfo(0);
          await booster.connect(deployer).deactivatePool(0);
          const PoolInfo0After = await poolRegistry.poolInfo(0);

          //console.log(PoolInfo0Before,PoolInfo0After)

          expect(PoolInfo0Before.active).eq(1);
          expect(PoolInfo0After.active).eq(0);
        });
      });

      describe("Testing all the reverting cases", function () {
        it("Should failed on setting operator", async function () {
          await expect(poolRegistry.connect(noob).setOperator(booster.address)).to.be.revertedWith("!auth");
        });

        it("Should failed on set pool reward implementation", async function () {
          await expect(booster.connect(noob).setPoolRewardImplementation(liquidityGauge.address)).to.be.revertedWith(
            "!auth"
          );
        });

        it("Should failed on setting reward active on creattion", async function () {
          await expect(booster.connect(noob).setRewardActiveOnCreation(true)).to.be.revertedWith("!auth");
        });

        it("Should failed on adding pool", async function () {
          await expect(
            booster.connect(noob).addPool(vaultV1Template.address, FXS_TEMPLE_GAUGE, FXS_TEMPLE)
          ).to.be.revertedWith("!auth");
          await expect(booster.connect(deployer).addPool(NULL, FXS_TEMPLE_GAUGE, FXS_TEMPLE)).to.be.revertedWith(
            "!imp"
          );
          await expect(booster.connect(deployer).addPool(vaultV1Template.address, NULL, FXS_TEMPLE)).to.be.revertedWith(
            "!stkAdd"
          );
          await expect(
            booster.connect(deployer).addPool(vaultV1Template.address, FXS_TEMPLE_GAUGE, NULL)
          ).to.be.revertedWith("!stkTok");
        });

        it("Should failed on creating a user vault", async function () {
          await expect(poolRegistry.connect(lpHolder).addUserVault(0, lpHolder._address)).to.be.revertedWith(
            "!op auth"
          );
          await expect(booster.connect(lpHolder).createVault(0)).to.be.revertedWith("already exists");
          await expect(booster.connect(noob).createVault(0)).to.be.revertedWith("!active");
        });
      });

    });

    describe("Liquidity gauge strat frax section : ", function() {
      it("Should add gauge to gauge controller and send reward to it", async function () {
        // Setup all for creating a new pool, previous has been killed for testing
        await booster.connect(deployer).setPoolRewardImplementation(liquidityGauge.address);
        await booster.connect(deployer).setDistributor(distributor.address);
        await booster.connect(deployer).setRewardActiveOnCreation(false);
        await booster.connect(deployer).addPool(vaultV1Template.address, FXS_TEMPLE_GAUGE, FXS_TEMPLE);

        const NbrsOfPool = await poolRegistry.poolLength();
        const PoolInfo1 = await poolRegistry.poolInfo(NbrsOfPool - 1);
        
        rewardsPID1 = LiquidityGaugeV4FraxContract.attach(PoolInfo1.rewardsAddress);

        let lastBlock = await ethers.provider.getBlock("latest")
        let currentTimestamp = lastBlock.timestamp - (lastBlock.timestamp % 86_400)

        await gaugeController.connect(gcAdmin)["add_gauge(address,int128,uint256)"](rewardsPID1.address, 0, 0); // gauge - type - weight
        await gaugeController.connect(veSdtHolder)["vote_for_gauge_weights(address,uint256)"](rewardsPID1.address, 10000);
        await distributor.connect(deployer_new)["approveGauge(address)"](rewardsPID1.address);
        
        // increase the timestamp by 8 days
        await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 8]);
        await network.provider.send("evm_mine", []);

        // Rounded down to day
        lastBlock = await ethers.provider.getBlock("latest")
        currentTimestamp = lastBlock.timestamp - (lastBlock.timestamp % 86_400)
        const before_LGV4 = await sdt.balanceOf(rewardsPID1.address)

        const distribute = await distributor.connect(deployer_new).distribute(rewardsPID1.address);
        const RECEIPT = await distribute.wait();
        //console.log("Distribe events: ",RECEIPT.events)
        
        const after_LGV4 = await sdt.balanceOf(rewardsPID1.address)
        const get_gauge_weight = await gaugeController.connect(deployer)["get_gauge_weight(address)"](rewardsPID1.address)
        const gauge_relative_weight = await gaugeController.connect(deployer)["gauge_relative_weight(address,uint256)"](rewardsPID1.address,currentTimestamp)

        //console.log("get_gauge_weight: \t",get_gauge_weight.toString())
        //console.log("gauge_relative_weight: \t",gauge_relative_weight.toString())
        //console.log("Balance LGV4: \t\t", (before_LGV4/10**18).toString())
        //console.log("Balance LGV4: \t\t", (after_LGV4/10**18).toString())

        expect(get_gauge_weight).gt(0)
        expect(gauge_relative_weight).gt(0)
        expect(Number(after_LGV4)-Number(before_LGV4)).gt(0)
      })

    })

    describe("Personal vault section : ", function () {
      it("Should stake locked lp token", async function () {
        const NbrsOfPool = await poolRegistry.poolLength();
        const PoolInfo1 = await poolRegistry.poolInfo(NbrsOfPool - 1);

        //console.log(NbrsOfPool,PoolInfo1)

        // Create a vault for the user on the new pool
        await booster.connect(lpHolder).createVault(NbrsOfPool - 1);
        const vaultAddress = await poolRegistry.vaultMap(NbrsOfPool - 1, lpHolder._address);
        personalVault1 = VaultV1Contract.attach(vaultAddress);

        // Temporary solution, waiting to deploy feeRegistry
        await personalVault1.connect(deployer).setFeeRegistry(feeRegistry.address);

        const balanceOfBefore = await rewardsPID1.balanceOf(personalVault1.address);
        const totalSupplyBefore = await rewardsPID1.totalSupply();

        await fxsTemple.connect(lpHolder).approve(personalVault1.address, LOCKEDAMOUNT);
        await personalVault1.connect(lpHolder).stakeLocked(LOCKEDAMOUNT, LOCKDURATION);

        const balanceOfAfter = await rewardsPID1.balanceOf(personalVault1.address);
        const totalSupplyAfter = await rewardsPID1.totalSupply();
        const lockedStakesOfLength = await fxsTempleGauge.lockedStakesOfLength(vaultAddress);
        const lockedStakesOf = await fxsTempleGauge.lockedStakesOf(personalVault1.address);

        expect(balanceOfBefore).eq(0);
        expect(balanceOfAfter).eq(LOCKEDAMOUNT);
        expect(totalSupplyBefore).eq(0);
        expect(totalSupplyAfter).eq(LOCKEDAMOUNT);
        expect(lockedStakesOfLength).eq(1);
        expect(lockedStakesOf[lockedStakesOfLength - 1]["kek_id"]).not.eq(0);
        expect(lockedStakesOf[lockedStakesOfLength - 1]["liquidity"]).eq(LOCKEDAMOUNT);
      });

      it("Should add liquidity to a previous deposit", async function () {
        const lockedStakesOfBefore = await fxsTempleGauge.lockedStakesOf(personalVault1.address);

        await fxsTemple.connect(lpHolder).approve(personalVault1.address, LOCKEDAMOUNT);
        await personalVault1.connect(lpHolder).lockAdditional(lockedStakesOfBefore[0]["kek_id"], LOCKEDAMOUNT);

        const lockedStakesOfLength = await fxsTempleGauge.lockedStakesOfLength(personalVault1.address);
        const lockedStakesOfAfter = await fxsTempleGauge.lockedStakesOf(personalVault1.address);
        const balanceOf = await rewardsPID1.balanceOf(personalVault1.address);
        const totalSupply = await rewardsPID1.totalSupply();

        expect(lockedStakesOfAfter[lockedStakesOfLength - 1]["liquidity"]).eq(LOCKEDAMOUNTx2);
        expect(balanceOf).eq(LOCKEDAMOUNTx2);
        expect(totalSupply).eq(LOCKEDAMOUNTx2);
      });

      it("Should get reward", async function () {
        const before_Temple = await temple.balanceOf(lpHolder._address);
        const before_Fxs = await fxs.balanceOf(lpHolder._address);
        const before_Fxs_multi = await fxs.balanceOf(MULTISIG)
        const before_Fxs_accum = await fxs.balanceOf(FXSACCUMULATOR)
        const before_Fxs_veSDT = await fxs.balanceOf(veSDTProxy.address)
        const before_Sdt = await sdt.balanceOf(lpHolder._address);
        

        //await personalVault1.connect(lpHolder)["setFeeRegistry(address)"](feeRegistry.address)
        await network.provider.send("evm_increaseTime", [DAY]);
        await network.provider.send("evm_mine", []);
        await personalVault1.connect(lpHolder)["getReward()"]()

        const after_Temple = await temple.balanceOf(lpHolder._address);
        const after_Fxs = await fxs.balanceOf(lpHolder._address);
        const after_Fxs_multi = await fxs.balanceOf(MULTISIG)
        const after_Fxs_accum = await fxs.balanceOf(FXSACCUMULATOR)
        const after_Fxs_veSDT = await fxs.balanceOf(veSDTProxy.address)
        const after_Sdt = await sdt.balanceOf(lpHolder._address);

        //console.log("FXS gain :\t",(after_Fxs - before_Fxs)/10**18)
        //console.log("FXS mult :\t",(after_Fxs_multi - before_Fxs_multi)/10**18)
        //console.log("FXS accu :\t",(after_Fxs_accum - before_Fxs_accum)/10**18)
        //console.log("FXS veSDT :\t",(after_Fxs_veSDT - before_Fxs_veSDT)/10**18)
        //console.log("Temple gain :\t",(after_Temple - before_Temple)/10**18)
        //console.log("SDT gain:\t",(after_Sdt - before_Sdt)/10**18)

        expect((after_Fxs - before_Fxs)).gt(0)
        expect((after_Fxs_multi - before_Fxs_multi)).gt(0)
        expect((after_Fxs_accum - before_Fxs_accum)).gt(0)
        expect((after_Fxs_veSDT - before_Fxs_veSDT)).gt(0)
        expect((after_Temple - before_Temple)).gt(0)
        expect((after_Sdt - before_Sdt)).gt(0)
      })

      it("Should get reward without claiming", async function () {
        const before_Temple = await temple.balanceOf(lpHolder._address);
        const before_Fxs = await fxs.balanceOf(lpHolder._address);
        const before_Fxs_multi = await fxs.balanceOf(MULTISIG)
        const before_Fxs_accum = await fxs.balanceOf(FXSACCUMULATOR)
        const before_Fxs_veSDT = await fxs.balanceOf(veSDTProxy.address)
        const before_Sdt = await sdt.balanceOf(lpHolder._address);
        

        //await personalVault1.connect(lpHolder)["setFeeRegistry(address)"](feeRegistry.address)
        await network.provider.send("evm_increaseTime", [DAY]);
        await network.provider.send("evm_mine", []);
        await personalVault1.connect(lpHolder)["getReward(bool)"](false)

        const after_Temple = await temple.balanceOf(lpHolder._address);
        const after_Fxs = await fxs.balanceOf(lpHolder._address);
        const after_Fxs_multi = await fxs.balanceOf(MULTISIG)
        const after_Fxs_accum = await fxs.balanceOf(FXSACCUMULATOR)
        const after_Fxs_veSDT = await fxs.balanceOf(veSDTProxy.address)
        const after_Sdt = await sdt.balanceOf(lpHolder._address);

        //console.log("FXS gain :\t",(after_Fxs - before_Fxs)/10**18)
        //console.log("FXS mult :\t",(after_Fxs_multi - before_Fxs_multi)/10**18)
        //console.log("FXS accu :\t",(after_Fxs_accum - before_Fxs_accum)/10**18)
        //console.log("FXS veSDT :\t",(after_Fxs_veSDT - before_Fxs_veSDT)/10**18)
        //console.log("Temple gain :\t",(after_Temple - before_Temple)/10**18)
        //console.log("SDT gain:\t",(after_Sdt - before_Sdt)/10**18)

        expect((after_Fxs - before_Fxs)).eq(0)
        expect((after_Fxs_multi - before_Fxs_multi)).eq(0)
        expect((after_Fxs_accum - before_Fxs_accum)).eq(0)
        expect((after_Fxs_veSDT - before_Fxs_veSDT)).eq(0)
        expect((after_Temple - before_Temple)).eq(0)
        expect((after_Sdt - before_Sdt)).gt(0)
      })

      it("Should get reward for just specific token", async function () {
        const before_Temple = await temple.balanceOf(lpHolder._address);
        const before_Fxs = await fxs.balanceOf(lpHolder._address);
        const before_Fxs_multi = await fxs.balanceOf(MULTISIG)
        const before_Fxs_accum = await fxs.balanceOf(FXSACCUMULATOR)
        const before_Fxs_veSDT = await fxs.balanceOf(veSDTProxy.address)
        const before_Sdt = await sdt.balanceOf(lpHolder._address);
        

        //await personalVault1.connect(lpHolder)["setFeeRegistry(address)"](feeRegistry.address)
        await network.provider.send("evm_increaseTime", [DAY]);
        await network.provider.send("evm_mine", []);
        await personalVault1.connect(lpHolder)["getReward(bool,address[])"](true,[])

        const after_Temple = await temple.balanceOf(lpHolder._address);
        const after_Fxs = await fxs.balanceOf(lpHolder._address);
        const after_Fxs_multi = await fxs.balanceOf(MULTISIG)
        const after_Fxs_accum = await fxs.balanceOf(FXSACCUMULATOR)
        const after_Fxs_veSDT = await fxs.balanceOf(veSDTProxy.address)
        const after_Sdt = await sdt.balanceOf(lpHolder._address);

        //console.log("FXS gain :\t",(after_Fxs - before_Fxs)/10**18)
        //console.log("FXS mult :\t",(after_Fxs_multi - before_Fxs_multi)/10**18)
        //console.log("FXS accu :\t",(after_Fxs_accum - before_Fxs_accum)/10**18)
        //console.log("FXS veSDT :\t",(after_Fxs_veSDT - before_Fxs_veSDT)/10**18)
        //console.log("Temple gain :\t",(after_Temple - before_Temple)/10**18)
        //console.log("SDT gain:\t",(after_Sdt - before_Sdt)/10**18)

        expect((after_Fxs - before_Fxs)).gt(0)
        expect((after_Fxs_multi - before_Fxs_multi)).gt(0)
        expect((after_Fxs_accum - before_Fxs_accum)).gt(0)
        expect((after_Fxs_veSDT - before_Fxs_veSDT)).gt(0)
        expect((after_Temple - before_Temple)).eq(0)
        expect((after_Sdt - before_Sdt)).gt(0)
      })
      
      it("Should time jump and withdraw locked", async function () {
        const lockedStakesOfBefore = await fxsTempleGauge.lockedStakesOf(personalVault1.address);
        await network.provider.send("evm_increaseTime", [LOCKDURATION]);
        await network.provider.send("evm_mine", []);

        const before_Temple = await temple.balanceOf(lpHolder._address);
        const before_Fxs = await fxs.balanceOf(lpHolder._address);
        const before_Sdt = await sdt.balanceOf(lpHolder._address);
        //console.log((before_Fxs/10**18).toString())
        //console.log(before_Temple.toString())
        //console.log(before_Sdt.toString())
        const earned = await personalVault1.earned();       

        await personalVault1.connect(lpHolder).withdrawLocked(lockedStakesOfBefore[0]["kek_id"]);
        //await personalVault1.connect(lpHolder)["setFeeRegistry(address)"](feeRegistry.address)
        await personalVault1.connect(lpHolder)["getReward()"]()

        const after_Temple = await temple.balanceOf(lpHolder._address);
        const after_Fxs = await fxs.balanceOf(lpHolder._address);
        const after_Sdt = await sdt.balanceOf(lpHolder._address);

        //console.log("FXS gain :\t",(after_Fxs - before_Fxs)/10**18)
        //console.log("Temple gain :\t",(after_Temple - before_Temple)/10**18)
        //console.log("SDT gain:\t",(after_Sdt - before_Sdt)/10**18)

        //console.log("Earned FXS :\t",(earned[1][0]/10**18).toString());
        //console.log("Earned TEM:\t",(earned[1][1]/10**18).toString());
        //console.log("Earned SDT:\t",(earned[1][2]/10**18).toString());

        expect((after_Fxs - before_Fxs)).gt(0)
        expect((after_Temple - before_Temple)).gt(0)
        expect((after_Sdt - before_Sdt)).gt(0)
      });
           

      
      
    });

  });
  describe("### Testing feeRegistry contract ###", function () {
    it("Should set news fees", async function () {
      await feeRegistry.connect(deployer).setFees(100,200,400)
      const multi = await feeRegistry.multisigPart()
      const accum = await feeRegistry.accumulatorPart()
      const veSDT = await feeRegistry.veSDTPart()
      const total = await feeRegistry.totalFees()

      expect(multi).eq(100)
      expect(accum).eq(200)
      expect(veSDT).eq(400)
      expect(total).eq(100+200+400)
    })

    it("Should set new addresses for multiSig", async function() {
      await feeRegistry.connect(deployer).setMultisig(RAND1)
      const multi = await feeRegistry.multiSig()
      expect(multi).eq(RAND1)
    })
    it("Should set new addresses for accumulator", async function() {
      await feeRegistry.connect(deployer).setAccumulator(RAND2)
      const accum = await feeRegistry.accumulator()
      expect(accum).eq(RAND2)
    })
    it("Should set new addresses for veSDTFeeFraxProxy", async function() {
      await feeRegistry.connect(deployer).setVeSDTFeeProxy(RAND3)
      const proxy = await feeRegistry.veSDTFeeProxy()
      expect(proxy).eq(RAND3)
    })
    it("Should revert because not onwer", async function() {
      await expect(feeRegistry.connect(noob).setFees(100,200,400)).to.be.revertedWith("!auth")
    })
    it("Should revert because not onwer", async function() {
      await expect(feeRegistry.connect(deployer).setFees(1000,600,700)).to.be.revertedWith("fees over")
    })
    it("Should revert because can't use address null", async function() {
      await expect(feeRegistry.connect(deployer).setMultisig(NULL)).to.be.revertedWith("!address(0)")
    })
  })

});

/*
  it("Should change rewards address for a personal vault", async function () {
    const NbrsOfPool = await poolRegistry.poolLength();
    let PoolInfo1 = await poolRegistry.poolInfo(NbrsOfPool-1);
    //console.log(PoolInfo1)


    await booster.connect(deployer).setPoolRewardImplementation(liquidityGauge2.address);
    await booster.connect(deployer).createNewPoolRewards(NbrsOfPool-1);
    PoolInfo1 = await poolRegistry.poolInfo(NbrsOfPool-1);
    //console.log(PoolInfo1)
    let reward = await vaultV1Template.rewards()
    console.log(reward)

    await booster.connect(deployer).changeRewards(vaultV1Template.address,PoolInfo1["rewardsAddress"])
    reward = await vaultV1Template.rewards()
    console.log(reward)
  })
  */

