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
    let VeSdtProxy: Contract;
    let masterchef: Contract;
    let sdtDistributor: Contract;
    let gc: Contract;
    let sdtDProxy: Contract;
    let strategy: Contract;
    let poolRegistry: Contract;
    let poolRegistryContract: Contract;
    let booster: Contract;
    let fxsTempleVault: Contract;
    let fxsTempleMultiGauge: Contract;
    let fxsTempleLiqudityGauge: Contract;
    let fxsTempleGauge: Contract;
    let vaultV1Template: Contract;
    let personalVault1: Contract;
    let mutliRewards: Contract

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
        const FraxStrategy = await ethers.getContractFactory("FraxStrategy");
        const SdtDistributor = await ethers.getContractFactory("SdtDistributorV2");
        const GaugeController = await ethers.getContractFactory("GaugeController");
        const Proxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
        const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
        const veSdtAngleProxyFactory = await ethers.getContractFactory("veSDTFeeFraxProxy");
        const liquidityGaugeFactory = await ethers.getContractFactory("LiquidityGaugeV4Strat");
        const poolRegistry = await ethers.getContractFactory("PoolRegistry");
        const boosterContract = await ethers.getContractFactory("Booster");
        const VaultV1Contract = await ethers.getContractFactory("VaultV1");
        const MultiRewardContract = await ethers.getContractFactory("MultiRewards")

        /* ==== Get Contract At ==== */
        locker = await ethers.getContractAt(FxsLockerABI, FXSLOCKER);
        fxsTempleGauge = await ethers.getContractAt(FxsTempleGaugeFraxABI, FXS_TEMPLE_GAUGE);
        fxsTemple = await ethers.getContractAt(ERC20ABI, FXS_TEMPLE)
        frax = await ethers.getContractAt(ERC20ABI, FRAX);
        fxs = await ethers.getContractAt(FXSABI, FXS)
        sdt = await ethers.getContractAt(ERC20ABI, SDT);
        masterchef = await ethers.getContractAt(MASTERCHEFABI, MASTERCHEF);

        /* ==== Deploy ==== */
        VeSdtProxy = await veSdtAngleProxyFactory.deploy([FXS, WETH, FRAX]);
        const proxyAdmin = await ProxyAdmin.deploy();
        sdtDistributor = await SdtDistributor.deploy();
        const liquidityGaugeStratImp = await liquidityGaugeFactory.deploy();


        /* Deployed quick and dirty */
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

        // add fxsTemple gauge to gaugecontroller
        /*await gc.connect(deployer)["add_gauge(address,int128,uint256)"](fxsTempleMultiGauge.address, 0, 0); // gauge - type - weight

        /* ==== Masterchef <> SdtDistributor setup ==== */
        const masterToken = await sdtDProxy.masterchefToken();
        await masterchef.connect(timelock).add(1000, masterToken, false);
        const poolsLength = await masterchef.poolLength();

        const pidSdtD = poolsLength - 1;
        await sdtDProxy.connect(deployer).initializeMasterchef(pidSdtD);
        await sdtDProxy.connect(deployer).setDistribution(true);




        /* ==== Deploy Pool Registry ==== */
        poolRegistryContract = await poolRegistry.connect(deployer).deploy(sdtDistributor.address);

        /* ==== Deploy MutliReward ==== */
        mutliRewards = await MultiRewardContract.connect(deployer).deploy(poolRegistryContract.address)

        /* ==== Deploy VaultV1 ==== */
        vaultV1Template = await VaultV1Contract.connect(deployer).deploy();

        ///* ==== Deploy Booster ==== */
        booster = await boosterContract.connect(deployer).deploy(locker.address, poolRegistryContract.address, SDT)
        //// Set Booster as Operator for Pool registry
        await poolRegistryContract.connect(deployer).setOperator(booster.address)
        //// Set LGStratImp as a pool reference
        await booster.connect(deployer).setPoolRewardImplementation(mutliRewards.address)
        //// LL give governance right to the Booster
        await locker.connect(deployer).setGovernance(booster.address);

        ///* ==== Create a new pool ==== */
        await booster.addPool(vaultV1Template.address, FXS_TEMPLE_GAUGE, FXS_TEMPLE)
        //// Set LL as a valide veFXS Proxy
        await fxsTempleGauge.connect(govFrax).toggleValidVeFXSProxy(locker.address)
        //
        ///* ==== Create a Personal Vault ==== */
        await booster.connect(LPHolder).createVault(0)
        //// Get address of created vault
        const vaultAddress = await poolRegistryContract.vaultMap(0, LPHolder._address)
        //// Get contract of created vault 
        personalVault1 = await VaultV1Contract.attach(vaultAddress);



    });
    describe("Frax Strategy tests", function () {
        const LOCKDURATION = 4 * WEEK;
        const DEPOSITEDAMOUNT = parseUnits("100", 18);
        it("Create a deposit LP into Frax Gauge", async function () {
            await fxsTemple.connect(LPHolder).approve(personalVault1.address, DEPOSITEDAMOUNT)
            await personalVault1.connect(LPHolder).stakeLocked(DEPOSITEDAMOUNT, LOCKDURATION)
        })
        it("Should withdraw after time increase", async function () {
            await network.provider.send("evm_increaseTime", [LOCKDURATION]);
            await network.provider.send("evm_mine", []);
            const lockedStakesOf = await fxsTempleGauge.lockedStakesOf(personalVault1.address)
            const kekId = lockedStakesOf[0]["kek_id"]
            const earned = await personalVault1.earned()
            await personalVault1.connect(LPHolder).withdrawLocked(kekId)
            console.log(earned)
        })
        it("Should see the reward", async function () {
            const VV = await personalVault1.getReward()
        })
    })
})