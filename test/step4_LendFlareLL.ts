import { expect } from "chai";
import { ethers, network } from "hardhat";

import { parseEther, parseUnits } from "@ethersproject/units";
import { Contract } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";
import { JsonRpcSigner } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { writeBalance } from "./utils";

import ERC20ABI from "./fixtures/ERC20.json";
import VELFTABI from "./fixtures/veLFT.json";
import BASEREWARDABI from "./fixtures/BaseReward.json";
import BalancerFeeDistributorABI from "./fixtures/BalancerFeeDistributor.json";

import {
    LFT,
    LFT_HOLDER, 
    LENDFLARE_FEE_DISTRIBUTOR,
    VE_LFT,
    RANDOM,
    SDT,
    DAI,
    WBTC,
    VE_SDT,
    VE_SDT_BOOST_PROXY,
    WETH,
    USDC,
    SD_LFT,
    LFT_LOCKER,
    LFT_DEPOSITOR,
    PROXY_ADMIN,
    SD_LFT_GAUGE_IMPL,
    SDTNEWDEPLOYER
} from "./constant";
import { skip } from "./utils";

const ONE_YEAR_IN_SECONDS = 86_400 * 365;
const ETH_100 = BigNumber.from(10).mul(BigNumber.from(10).pow(18)).toHexString();

const USDC_HOLDER = "0x4f1a5a5d258522254933a6DA9648c57Fe230D17e";
const WBTC_HOLDER = "0x3D2FB958376EE1cA22322B2c226666E414c3CFdd";
const LENDFLARE_OWNER = "0x77Be80a3c5706973a925C468Bdc8eAcCD187D1Ba";
const USDC_BASE_REWARD = "0xC5f11E8B5475FF47ba855ca459Ee817b343dD6E4";
const ETH_BASE_REWARD = "0x37dd2f9b2FEF9Cc123C5a97CDDC76ea332B6E382";
const DAI_BASE_REWARD = "0x59DFE3641993Eadbc42f16FC05b306DCEbCd7CE0";
const WBTC_BASE_REWARD = "0x3cB2164E43c77A6De18ABcB955d1F1f66973C9C0";

const getNow = async function () {
    let blockNum = await ethers.provider.getBlockNumber();
    let block = await ethers.provider.getBlock(blockNum);
    var time = block.timestamp;
    return time;
};

describe("LendFlare Depositor", function () {
    // Signers
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let deployer: SignerWithAddress;
    // Contract
    let locker: Contract;
    let sdLftToken: Contract;
    let lendFlareDepositor: Contract;
    let liquidityGaugeProxy: Contract;
    let liquidityGaugeImpl: Contract;
    let accumulator: Contract;
    // LendFlare Contract
    let veLFT: Contract;
    let lftToken: Contract;
    let feeDistributor: Contract;
    let usdc: Contract;
    let dai: Contract;
    let weth: Contract;
    let wbtc: Contract;
    let usdcBaseReward: Contract;
    let ethBaseReward: Contract;
    let daiBaseReward: Contract;
    let wbtcBaseReward: Contract;

    // Helper Signers
    let lftTokenHolder: JsonRpcSigner;
    let sdtDeployer: JsonRpcSigner;
    let lendFlareOwner: JsonRpcSigner;
    let usdcHolder: JsonRpcSigner;
    let wbtcHolder: JsonRpcSigner;

    before(async function () {
        [deployer, alice, bob] = await ethers.getSigners();

        // Tokens
        lftToken = await ethers.getContractAt(ERC20ABI, LFT);
        usdc = await ethers.getContractAt(ERC20ABI, USDC);
        dai = await ethers.getContractAt(ERC20ABI, DAI);
        weth = await ethers.getContractAt(ERC20ABI, WETH);
        wbtc = await ethers.getContractAt(ERC20ABI, WBTC);

        // base reward pool
        usdcBaseReward = await ethers.getContractAt(BASEREWARDABI, USDC_BASE_REWARD);
        ethBaseReward = await ethers.getContractAt(BASEREWARDABI, ETH_BASE_REWARD);
        daiBaseReward = await ethers.getContractAt(BASEREWARDABI, DAI_BASE_REWARD);
        wbtcBaseReward = await ethers.getContractAt(BASEREWARDABI, WBTC_BASE_REWARD);

        // veBAL
        veLFT = await ethers.getContractAt(VELFTABI, VE_LFT);

        //Impersonate accounts and fill with ETH
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [SDTNEWDEPLOYER]
        });
        await network.provider.send("hardhat_setBalance", [SDTNEWDEPLOYER, ETH_100]);
        sdtDeployer = ethers.provider.getSigner(SDTNEWDEPLOYER);

        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [LFT_HOLDER]
        });
        await network.provider.send("hardhat_setBalance", [LFT_HOLDER, ETH_100]);
        lftTokenHolder = ethers.provider.getSigner(LFT_HOLDER);

        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [LENDFLARE_OWNER]
        });
        await network.provider.send("hardhat_setBalance", [LENDFLARE_OWNER, ETH_100]);
        lendFlareOwner = ethers.provider.getSigner(LENDFLARE_OWNER);

        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [USDC_HOLDER]
        });
        await network.provider.send("hardhat_setBalance", [USDC_HOLDER, ETH_100]);
        usdcHolder = ethers.provider.getSigner(USDC_HOLDER);

        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [WBTC_HOLDER]
        });
        await network.provider.send("hardhat_setBalance", [WBTC_HOLDER, ETH_100]);
        wbtcHolder = ethers.provider.getSigner(WBTC_HOLDER);

        await usdc.connect(usdcHolder).transfer(lendFlareOwner._address, parseUnits("100", "6"));
        await wbtc.connect(wbtcHolder).transfer(lendFlareOwner._address, parseUnits("1", "8"));
        await writeBalance(DAI, "500", lendFlareOwner._address);

        // LendFlare Fee Distributor
        feeDistributor = await ethers.getContractAt(BalancerFeeDistributorABI, LENDFLARE_FEE_DISTRIBUTOR);
        sdLftToken = await ethers.getContractAt("sdToken", SD_LFT);
        locker = await ethers.getContractAt("LftLocker", LFT_LOCKER);
        lendFlareDepositor = await ethers.getContractAt("Depositor", LFT_DEPOSITOR);
        liquidityGaugeImpl = await ethers.getContractAt("LiquidityGaugeV4", SD_LFT_GAUGE_IMPL);
        const proxyAdmin = await ethers.getContractAt("ProxyAdmin", PROXY_ADMIN);

        // Get Contract Artifacts
        const accumulatorContract = await ethers.getContractFactory("LftAccumulator");
        const Proxy = await ethers.getContractFactory("TransparentUpgradeableProxy");

        // Deployment
        accumulator = await accumulatorContract.deploy(sdLftToken.address);

        let ABI_SDTD = [
            "function initialize(address _staking_token, address _admin, address _SDT, address _voting_escrow, address _veBoost_proxy, address _distributor)"
          ];
        let liquidityGaugeInterface = new ethers.utils.Interface(ABI_SDTD);

        const data = liquidityGaugeInterface.encodeFunctionData("initialize", [
            sdLftToken.address,
            deployer.address,
            SDT,
            VE_SDT,
            VE_SDT_BOOST_PROXY, 
            RANDOM
        ]);
      
        liquidityGaugeProxy = await Proxy.connect(deployer).deploy(liquidityGaugeImpl.address, proxyAdmin.address, data);
        liquidityGaugeProxy = await ethers.getContractAt("LiquidityGaugeV4", liquidityGaugeProxy.address);

        // INITIALIZATION
        // Set Depositor in Locker 
        //await locker.setDepositor(lendFlareDepositor.address);
        // Set Depositor as Operator of sdToken
        //await sdLftToken.setOperator(lendFlareDepositor.address);
        // Initialize Liquidity Gauge & set to Depositor
        await lendFlareDepositor.connect(sdtDeployer).setGauge(liquidityGaugeProxy.address);
        // Initialize accumulator
        await accumulator.setLocker(locker.address);
        await accumulator.setGauge(liquidityGaugeProxy.address);
        // set swap path (All tokens claimed will be swapped for WETH)
        await accumulator.setPidSwapPath(0, [USDC, WETH]);
        await accumulator.setPidSwapPath(1, [DAI, WETH]);
        await accumulator.setPidSwapPath(2, [WBTC, WETH]);

        // set accumulator via the locker
        await locker.connect(sdtDeployer).setAccumulator(accumulator.address);
        
        await liquidityGaugeProxy.add_reward(WETH, accumulator.address);
    });

    describe("sdBAL", function () {
        it("should be setup correctly", async function () {
            const name = await sdLftToken.name();
            const symbol = await sdLftToken.symbol();
            const operator = await sdLftToken.operator();
            const depositor = await locker.depositor();

            expect(name).eq("Stake DAO LendFlare");
            expect(symbol).eq("sdLFT");
            expect(operator).eq(lendFlareDepositor.address);
            expect(depositor).eq(lendFlareDepositor.address);

        });
        it("should change sdLFT operator via LendFlareDepositor", async function () {
            await lendFlareDepositor.connect(sdtDeployer).setSdTokenOperator(alice.address);
            const operator = await sdLftToken.operator();
            expect(operator).eq(alice.address);
        });

        it("should mint sdLFT tokens", async function () {
            const amount = parseEther("1");

            let before = await sdLftToken.totalSupply();
            const balanceBefore = await sdLftToken.balanceOf(alice.address);

            await sdLftToken.connect(alice).mint(alice.address, amount);

            const after = await sdLftToken.totalSupply();
            const balanceAfter = await sdLftToken.balanceOf(alice.address);

            expect(before).eq(0);
            expect(after).eq(amount);

            expect(balanceBefore).eq(0);
            expect(balanceAfter).eq(amount);
        });

        it("should burn sdLFT tokens", async function () {
            const amount = parseEther("1");

            let before = await sdLftToken.totalSupply();
            await sdLftToken.connect(alice).burn(alice.address, amount);
            const after = await sdLftToken.totalSupply();

            expect(before).eq(amount);
            expect(after).eq(0);

            // Reset
            await sdLftToken.connect(alice).setOperator(lendFlareDepositor.address);
        });
    });

    describe("Lock Initial Actions", function () {
        it("Should create a lock", async function () {
            const lockingAmount = parseEther("1");
            const lockEnd = (await getNow()) + ONE_YEAR_IN_SECONDS * 4;

            await lftToken.connect(lftTokenHolder).transfer(locker.address, lockingAmount);
            await locker.connect(sdtDeployer).createLock(lockingAmount, lockEnd);

            const locked = await veLFT.lockedBalances(locker.address);

            // Rounded down to week
            //const expectedEnd = lockEnd - (lockEnd % (86_400 * 7))
            const balance = await veLFT["balanceOf(address)"](locker.address);

            //expect(locked.end).to.be.equal(expectedEnd);
            expect(locked.amount).eq(lockingAmount);

            expect(balance).gt(lockingAmount.mul(95).div(100));
            expect(balance).lt(lockingAmount);
        });

        it("should check if all setters work correctly", async function () {
            await locker.connect(sdtDeployer).setGovernance(alice.address);
            await locker.connect(alice).setDepositor(alice.address);
            await locker.connect(alice).setAccumulator(alice.address);

            expect(await locker.governance()).eq(alice.address);
            expect(await locker.depositor()).eq(alice.address);
            expect(await locker.accumulator()).eq(alice.address);

            await locker.connect(alice).setGovernance(sdtDeployer._address);
            await locker.connect(sdtDeployer).setAccumulator(accumulator.address);
            await locker.connect(sdtDeployer).setDepositor(lendFlareDepositor.address);
        });
    });

    describe("Userflow: LendFlare Depositor -> LGV4 -> Rewards", function () {
        it("Initial LFT Lock", async function () {
            const amount = parseEther("1");
            // Already locked to max / Need to just increase amount
            await lendFlareDepositor.connect(sdtDeployer).setRelock(false);
            // Transfer to Locker
            await lftToken.connect(lftTokenHolder).transfer(locker.address, amount);
            // Lock through Depositor Function
            await lendFlareDepositor.lockToken();

            const balance = await lftToken.balanceOf(lendFlareDepositor.address);
            expect(balance).eq(0);
        });
        it("Should lock LFT with Depositor", async function () {
            const currentVeBALBalance = await veLFT.lockedBalances(locker.address);
            const beforeBalance = await lftToken.balanceOf(lftTokenHolder._address);

            const amount = parseEther("1");
            // Approve LendFlare Depositor
            await lftToken.connect(lftTokenHolder).approve(lendFlareDepositor.address, amount);
            await lendFlareDepositor.connect(lftTokenHolder).deposit(amount, true, false, lftTokenHolder._address);

            const afterVeBALBalance = await veLFT.lockedBalances(locker.address);
            const afterBalance = await lftToken.balanceOf(lftTokenHolder._address);
            const sdBalBalance = await sdLftToken.balanceOf(lftTokenHolder._address);
            const gaugeBalance = await sdLftToken.balanceOf(liquidityGaugeProxy.address);

            expect(afterVeBALBalance.amount).to.be.equal(currentVeBALBalance.amount.add(amount));
            expect(afterBalance).eq(beforeBalance.sub(amount));
            expect(sdBalBalance).eq(amount);
            expect(gaugeBalance).eq(0);
        });

        it("Should lock LFT and Stake to LGV4", async function () {
            const currentVeBALBalance = await veLFT.lockedBalances(locker.address);
            const beforeBalance = await lftToken.balanceOf(lftTokenHolder._address);

            const amount = parseEther("1");
            // Approve LendFlare Depositor
            await lftToken.connect(lftTokenHolder).approve(lendFlareDepositor.address, amount);
            await lendFlareDepositor.connect(lftTokenHolder).deposit(amount, true, true, lftTokenHolder._address);

            const afterVeBALBalance = await veLFT.lockedBalances(locker.address);
            const afterBalance = await lftToken.balanceOf(lftTokenHolder._address);
            const sdBalBalance = await sdLftToken.balanceOf(lftTokenHolder._address);
            const staked = await liquidityGaugeProxy.balanceOf(lftTokenHolder._address);
            const gaugeBalance = await sdLftToken.balanceOf(liquidityGaugeProxy.address);

            expect(afterVeBALBalance.amount).eq(currentVeBALBalance.amount.add(amount));
            expect(afterBalance).eq(beforeBalance.sub(amount));
            expect(sdBalBalance).eq(amount);
            expect(staked).eq(amount);
            expect(gaugeBalance).eq(amount);
        });
        it("Should claim rewards via Accumulator and notify them", async function () {
            // pids
            // 0 - USDC
            // 1 - DAI
            // 2 - WBTC
            // 3 - ETH
            // 4 - UNI V2 token
            // 5 - agEUR
            // simulate a notify amount
            const usdcToNotify = parseUnits("100", "6");
            const wbtcToNotify = parseUnits("1", "8");
            const daiToNotify = parseEther("100");
            const ethToNotify = parseEther("1");
            await usdc.connect(lendFlareOwner).approve(usdcBaseReward.address, usdcToNotify);
            await dai.connect(lendFlareOwner).approve(daiBaseReward.address, daiToNotify);
            await usdcBaseReward.connect(lendFlareOwner).notifyRewardAmount(usdcToNotify);
            await ethBaseReward.connect(lendFlareOwner).notifyRewardAmount(ethToNotify);
            await daiBaseReward.connect(lendFlareOwner).notifyRewardAmount(daiToNotify);
            await wbtcBaseReward.connect(lendFlareOwner).notifyRewardAmount(wbtcToNotify);
            skip(86_400 * 3) // 3 days later

            const usdcBefore = await usdc.balanceOf(accumulator.address);
            const daiBefore = await dai.balanceOf(accumulator.address);
            const wethBefore = await weth.balanceOf(accumulator.address);
            const wbtcBefore = await wbtc.balanceOf(accumulator.address);

            // claim rewards via the accumulator without notifying it because the token reward is empty
            //await locker.connect(sdtDeployer).claimRewards([0, 1, 2, 3], accumulator.address);
            await accumulator.claimAndNotify([0, 1, 2, 3]);

            const usdcAfter = await usdc.balanceOf(accumulator.address);
            const daiAfter = await dai.balanceOf(accumulator.address);
            const wethAfter = await weth.balanceOf(accumulator.address);
            const wbtcAfter = await wbtc.balanceOf(accumulator.address);

            expect(usdcAfter).eq(0);
            //expect(daiAfter).eq(0);
            expect(wbtcAfter).eq(0);
            expect(wethAfter).gt(wethBefore);

            const lockerUsdcBalance = await usdc.balanceOf(locker.address);
            const lockerDaiBalance = await dai.balanceOf(locker.address);
            const lockerWethBalance = await weth.balanceOf(locker.address);
            const lockerWbtcBalance = await wbtc.balanceOf(locker.address);

            expect(lockerUsdcBalance).eq(0);
            expect(lockerDaiBalance).eq(0);
            expect(lockerWethBalance).eq(0);
            expect(lockerWbtcBalance).eq(0);

            skip(86_400 * 3) // 3 days later
            //set the token reward
            await accumulator.setTokensToNotify([WETH]);
            await accumulator.claimAndNotify([0, 1, 2, 3]);

            const accumulatorWethBalance = await weth.balanceOf(accumulator.address);
            expect(accumulatorWethBalance).eq(0);
        });
    });
});
