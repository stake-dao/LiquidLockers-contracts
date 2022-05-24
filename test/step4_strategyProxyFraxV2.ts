import { ethers, network } from "hardhat";
import { expect } from "chai";

import { BigNumber } from "@ethersproject/bignumber";
import { parseEther, parseUnits } from "@ethersproject/units";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "@ethersproject/contracts";
import { JsonRpcSigner } from "@ethersproject/providers";

import FxsLockerABI from "./fixtures/FXSLocker.json";
import FxsTempleGaugeFraxABI from "./fixtures/fxsTempleGauge.json"
import MASTERCHEFABI from "./fixtures/Masterchef.json";
import ERC20ABI from "./fixtures/ERC20.json";
import FXSABI from "./fixtures/FXS.json";
import { info } from "console";
import exp from "constants";
import { type } from "os";
import { poll } from "ethers/lib/utils";
import { any } from "hardhat/internal/core/params/argumentTypes";
import { access } from "fs";

/* ==== Time ==== */
const DAY = 60 * 60 * 24;
const WEEK = 60 * 60 * 24 * 7;
const YEAR = 60 * 60 * 24 * 364;
const MAXLOCK = 3 * 60 * 60 * 24 * 364;


/* ==== Address ==== */
const NULL = "0x0000000000000000000000000000000000000000"
const STDDEPLOYER = "0xb36a0671b3d49587236d7833b01e79798175875f";
const SDT = "0x73968b9a57c6e53d41345fd57a6e6ae27d6cdb2f";
const VE_SDT = "0x0C30476f66034E11782938DF8e4384970B6c9e8a";
const VESDT_HOLDER = "0xdceb0bb3311342e3ce9e49f57affce9deac40ba1";
const MASTERCHEF = "0xfEA5E213bbD81A8a94D0E1eDB09dBD7CEab61e1c";

const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const TEMPLE = "0x470EBf5f030Ed85Fc1ed4C2d36B9DD02e77CF1b7";

const FRAX = "0x853d955aCEf822Db058eb8505911ED77F175b99e";
const FXS = "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0";
const GOVFRAX = "0xB1748C79709f4Ba2Dd82834B8c82D4a505003f27";
const FXS_TEMPLE = "0x6021444f1706f15465bEe85463BCc7d7cC17Fc03";
const FXS_TEMPLE_GAUGE = "0x10460d02226d6ef7B2419aE150E6377BdbB7Ef16";
const FXS_TEMPLE_HOLDER = "0xa5f74ae4b22a792f18c42ec49a85cf560f16559f"

const TIMELOCK = "0xD3cFc4E65a73BB6C482383EB38f5C3E1d1411616";
const FXSACCUMULATOR = "0x1CC16bEdaaCD15848bcA5eB80188e0931bC59fB2"
const FXSLOCKER = "0xCd3a267DE09196C48bbB1d9e842D7D7645cE448f";

const CVXFEEREGISTRY = "0xC9aCB83ADa68413a6Aa57007BC720EE2E2b3C46D"

const ETH_100 = BigNumber.from(10).mul(BigNumber.from(10).pow(18)).toHexString();

describe("FRAX <> StakeDAO", function () {
    let localDeployer: SignerWithAddress;
    let dummyMs: SignerWithAddress;

    let deployer: JsonRpcSigner;
    let LPHolder: JsonRpcSigner;
    let timelock: JsonRpcSigner;
    let veSdtHolder: JsonRpcSigner;
    let govFrax: JsonRpcSigner;

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
    let mutliRewards: Contract;
    let rewardsPID0: Contract;
    let feeRegistry: Contract;

    let VaultV1Contract: any;
    let MultiRewardContract: any;

    before(async function () {

        /* ==== Get Signer ====*/
        [localDeployer, dummyMs] = await ethers.getSigners();
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
        deployer = ethers.provider.getSigner(STDDEPLOYER);
        LPHolder = ethers.provider.getSigner(FXS_TEMPLE_HOLDER);
        timelock = ethers.provider.getSigner(TIMELOCK);
        veSdtHolder = ethers.provider.getSigner(VESDT_HOLDER);
        govFrax = ethers.provider.getSigner(GOVFRAX);

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
        const feeRegistryContract = await ethers.getContractFactory("FeeRegistry")
        VaultV1Contract = await ethers.getContractFactory("VaultV1");
        MultiRewardContract = await ethers.getContractFactory("MultiRewards")

        /* ==== Get Contract At ==== */
        locker = await ethers.getContractAt(FxsLockerABI, FXSLOCKER);
        fxsTempleGauge = await ethers.getContractAt(FxsTempleGaugeFraxABI, FXS_TEMPLE_GAUGE);
        fxsTemple = await ethers.getContractAt(ERC20ABI, FXS_TEMPLE)
        frax = await ethers.getContractAt(ERC20ABI, FRAX);
        fxs = await ethers.getContractAt(FXSABI, FXS)
        sdt = await ethers.getContractAt(ERC20ABI, SDT);
        temple = await ethers.getContractAt(ERC20ABI, TEMPLE)
        masterchef = await ethers.getContractAt(MASTERCHEFABI, MASTERCHEF);

        /* ==== Deploy ==== */
        veSDTProxy = await veSdtFxsProxyFactory.deploy([FXS, WETH, FRAX]);
        const proxyAdmin = await ProxyAdmin.deploy();
        sdtDistributor = await SdtDistributor.deploy();


        /* Copy-pasted from test on angle strategy */
        let ABI_SDTD = [
            "function initialize(address _rewardToken, address _controller, address _masterchef, address governor, address guardian, address _delegate_gauge)"
        ];
        let iface = new ethers.utils.Interface(ABI_SDTD);
        gc = await GaugeController.connect(deployer).deploy(SDT, VE_SDT, deployer._address);
        const dataSdtD = iface.encodeFunctionData("initialize", [
            SDT,
            gc.address,
            masterchef.address,
            deployer._address,
            deployer._address,
            deployer._address
        ]);
        sdtDProxy = await Proxy.connect(deployer).deploy(sdtDistributor.address, proxyAdmin.address, dataSdtD);
        sdtDProxy = await ethers.getContractAt("SdtDistributor", sdtDProxy.address);
        /* Deployed quick and dirty */


        /* ==== Add gauge types ==== */
        const typesWeight = parseEther("1");
        await gc.connect(deployer)["add_type(string,uint256)"]("Mainnet staking", typesWeight); // 0
        await gc.connect(deployer)["add_type(string,uint256)"]("External", typesWeight); // 1
        await gc.connect(deployer)["add_type(string,uint256)"]("Cross Chain", typesWeight) // 2

        /* ==== Masterchef <> SdtDistributor setup ==== */
        const masterToken = await sdtDProxy.masterchefToken();
        await masterchef.connect(timelock).add(1000, masterToken, false);
        const poolsLength = await masterchef.poolLength();

        const pidSdtD = poolsLength - 1;
        await sdtDProxy.connect(deployer).initializeMasterchef(pidSdtD);
        await sdtDProxy.connect(deployer).setDistribution(true);


        /* ==== set LL as a valid veFXS Proxy ==== */
        await fxsTempleGauge.connect(govFrax).toggleValidVeFXSProxy(locker.address)

        /* ==== Deploy Fee Registry ==== */
        feeRegistry = await feeRegistryContract.connect(deployer).deploy(veSDTProxy.address)

        /* ==== Deploy Pool Registry ==== */
        poolRegistry = await poolRegistryContract.connect(deployer).deploy();

        /* ==== Deploy MutliReward ==== */
        mutliRewards = await MultiRewardContract.connect(deployer).deploy(poolRegistry.address)

        /* ==== Deploy VaultV1 ==== */
        vaultV1Template = await VaultV1Contract.connect(deployer).deploy();
        //await vaultV1Template.connect(deployer).setFeeRegistry(feeRegistry.address)

        /* ==== Deploy Booster ==== */
        booster = await boosterContract.connect(deployer).deploy(locker.address, poolRegistry.address, CVXFEEREGISTRY)
        //// Set Booster as Operator for Pool registry
        await poolRegistry.connect(deployer).setOperator(booster.address)
        //// Set LGStratImp as a pool reference
        await booster.connect(deployer).setPoolRewardImplementation(mutliRewards.address)
        //// LL give governance right to the Booster
        await locker.connect(deployer).setGovernance(booster.address);



    });
    describe("Frax Strategy tests", function () {
        const LOCKDURATION = 4 * WEEK;
        const DEPOSITEDAMOUNT = parseUnits("100", 18);

        describe("Pool testing", function () {
            it("Should create a new pool on Pool registry", async function () {
                await booster.connect(deployer).addPool(vaultV1Template.address, FXS_TEMPLE_GAUGE, FXS_TEMPLE);
                const NbrsOfPool = await poolRegistry.poolLength()
                const PoolInfo0 = await poolRegistry.poolInfo(0)
                rewardsPID0 = MultiRewardContract.attach(PoolInfo0.rewardsAddress);
                //console.log(PoolInfo0)

                expect(NbrsOfPool).eq(1);
                expect(PoolInfo0.implementation).eq(vaultV1Template.address)
                expect(PoolInfo0.stakingAddress).eq(FXS_TEMPLE_GAUGE);
                expect(PoolInfo0.stakingToken).eq(FXS_TEMPLE);
                expect(PoolInfo0.rewardsAddress).not.eq(NULL)
            })
            it("Should activate the multiRewards from PID0", async function () {
                const isActiveBefore = await rewardsPID0.active()
                await rewardsPID0.connect(deployer).setActive()
                const isActiveAfter = await rewardsPID0.active()
                expect(isActiveBefore).eq(false)
                expect(isActiveAfter).eq(true)
            })
            it("Should add SDT as reward", async function () {
                // For now the distributor is the StakeDAO Deployer
                // Need to setup the sdtDistributorV2 as the distributor
                await rewardsPID0.connect(deployer).addReward(SDT, deployer._address)

                await sdt.connect(deployer).approve(rewardsPID0.address, DEPOSITEDAMOUNT)
                await rewardsPID0.connect(deployer).notifyRewardAmount(SDT, DEPOSITEDAMOUNT)
                const rewardData = await rewardsPID0.rewardData(SDT)
                //console.log(rewardData)
            })

        })

        describe("Personal Vault testing", function () {
            it("Should create a personal vautl", async function () {
                await booster.connect(LPHolder).createVault(0)
                const vaultAddress = await poolRegistry.vaultMap(0, LPHolder._address)
                personalVault1 = VaultV1Contract.attach(vaultAddress);
                await personalVault1.connect(deployer).setFeeRegistry(feeRegistry.address)
            })

            it("Create a deposit LP into Frax Gauge", async function () {
                await fxsTemple.connect(LPHolder).approve(personalVault1.address, DEPOSITEDAMOUNT)
                await personalVault1.connect(LPHolder).stakeLocked(DEPOSITEDAMOUNT, LOCKDURATION)
            })
            it("Should withdraw after time increase", async function () {
                const beforeBalanceLP = await fxsTemple.balanceOf(LPHolder._address)
                const beforeBalanceFxs = await fxs.balanceOf(LPHolder._address)
                const beforeBalanceTemple = await temple.balanceOf(LPHolder._address)
                await network.provider.send("evm_increaseTime", [LOCKDURATION]);
                await network.provider.send("evm_mine", []);
                const lockedStakesOf = await fxsTempleGauge.lockedStakesOf(personalVault1.address)
                const kekId = lockedStakesOf[0]["kek_id"]
                await personalVault1.connect(LPHolder).withdrawLocked(kekId)
                const lockedStakesOfAfter = await fxsTempleGauge.lockedStakesOf(personalVault1.address)
                const afterBalanceLP = await fxsTemple.balanceOf(LPHolder._address)
                const afterBalanceFxs = await fxs.balanceOf(LPHolder._address)
                const afterBalanceTemple = await temple.balanceOf(LPHolder._address)
                
                //console.log("LP : ", (beforeBalanceLP/10**18).toString())
                //console.log("Fxs: ", (beforeBalanceFxs/10**18).toString())
                //console.log("Temple: ", (beforeBalanceTemple/10**18).toString())
                //console.log("LP : ", (afterBalanceLP/10**18).toString())
                //console.log("Fxs: ", (afterBalanceFxs/10**18).toString())
                //console.log("Temple: ", (afterBalanceTemple/10**18).toString())
                
                expect(afterBalanceLP).gt(beforeBalanceLP)
                expect(afterBalanceFxs).gt(beforeBalanceFxs)
                expect(afterBalanceTemple).gt(beforeBalanceTemple)

            })
            
            it("Should send the reward to the user", async function () {
                const beforeBalanceSdt = await sdt.balanceOf(LPHolder._address)
                const earned = await personalVault1.earned()
                await personalVault1.connect(LPHolder)["getReward()"]()
                const afterBalanceSdt = await sdt.balanceOf(LPHolder._address)
                
                //console.log("earned: ",earned)
                //console.log("Sdt: ",(beforeBalanceSdt/10**18).toString())
                //console.log("Sdt: ",(afterBalanceSdt/10**18).toString())
                
                expect(afterBalanceSdt).gt(beforeBalanceSdt)

            })
            

        })


    })
})