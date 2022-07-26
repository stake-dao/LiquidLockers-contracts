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
    STAKE_DAO_MULTISIG,
    VE_SDT,
    VE_SDT_BOOST_PROXY,
    STDDEPLOYER,
    WETH,
    USDC
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
            params: [STDDEPLOYER]
        });
        await network.provider.send("hardhat_setBalance", [STDDEPLOYER, ETH_100]);
        sdtDeployer = ethers.provider.getSigner(STDDEPLOYER);

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

        // Get Contract Artifacts
        const sdLftTokenContract = await ethers.getContractFactory("sdToken");
        const lendFlareLockerContract = await ethers.getContractFactory("LftLocker");
        const lendFlareDepositorContract = await ethers.getContractFactory("Depositor");
        const liquidityGaugeContract = await ethers.getContractFactory("LiquidityGaugeV4");
        const accumulatorContract = await ethers.getContractFactory("LftAccumulator");
        const Proxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
        const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");

        // Deployment
        sdLftToken = await sdLftTokenContract.deploy("Stake DAO LendFlare", "sdLFT");
        locker = await lendFlareLockerContract.connect(sdtDeployer).deploy(STAKE_DAO_MULTISIG);
        lendFlareDepositor = await lendFlareDepositorContract.deploy(lftToken.address, locker.address, sdLftToken.address);
        accumulator = await accumulatorContract.deploy(sdLftToken.address);

        // Liquidity Gauge with Proxy
        liquidityGaugeImpl = await liquidityGaugeContract.deploy();

        const proxyAdmin = await ProxyAdmin.deploy();

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
        await locker.setDepositor(lendFlareDepositor.address);
        // Set Depositor as Operator of sdToken
        await sdLftToken.setOperator(lendFlareDepositor.address);
        // Initialize Liquidity Gauge & set to Depositor
        await lendFlareDepositor.setGauge(liquidityGaugeProxy.address);
        // Initialize accumulator
        await accumulator.setLocker(locker.address);
        await accumulator.setGauge(liquidityGaugeProxy.address);
    });

    describe("sdBAL", function () {
        it("should be setup correctly", async function () {
            const name = await sdLftToken.name();
            const symbol = await sdLftToken.symbol();
            const operator = await sdLftToken.operator();
            const depositor = await locker.depositor();

            expect(name).to.be.equal("Stake DAO LendFlare");
            expect(symbol).to.be.equal("sdLFT");
            expect(operator).to.be.equal(lendFlareDepositor.address);
            expect(depositor).to.be.equal(lendFlareDepositor.address);

        });
        it("should change sdLFT operator via LendFlareDepositor", async function () {
            // Only Depositor can call
            await expect(
                sdLftToken.setOperator(lendFlareDepositor.address)
            ).to.be.revertedWith("!authorized");

            await lendFlareDepositor.setSdTokenOperator(alice.address);
            const operator = await sdLftToken.operator();
            expect(operator).to.be.equal(alice.address);

        });

        it("should mint sdLFT tokens", async function () {
            const amount = parseEther("1");

            let before = await sdLftToken.totalSupply();
            const balanceBefore = await sdLftToken.balanceOf(alice.address);

            await sdLftToken.connect(alice).mint(alice.address, amount);

            const after = await sdLftToken.totalSupply();
            const balanceAfter = await sdLftToken.balanceOf(alice.address);

            expect(before).to.be.equal(0);
            expect(after).to.be.equal(amount);

            expect(balanceBefore).to.be.equal(0);
            expect(balanceAfter).to.be.equal(amount);
        });

        it("should burn sdLFT tokens", async function () {
            const amount = parseEther("1");

            let before = await sdLftToken.totalSupply();
            await sdLftToken.connect(alice).burn(alice.address, amount);
            const after = await sdLftToken.totalSupply();

            expect(before).to.be.equal(amount);
            expect(after).to.be.equal(0);

            // Reset
            await sdLftToken.connect(alice).setOperator(lendFlareDepositor.address);
        });
    });

    describe("Lock Initial Actions", function () {
        it("Should create a lock", async function () {
            const lockingAmount = parseEther("1");
            const lockEnd = (await getNow()) + ONE_YEAR_IN_SECONDS * 4;

            await lftToken.connect(lftTokenHolder).transfer(locker.address, lockingAmount);
            await locker.createLock(lockingAmount, lockEnd);

            const locked = await veLFT.lockedBalances(locker.address);

            // Rounded down to week
            //const expectedEnd = lockEnd - (lockEnd % (86_400 * 7))
            const balance = await veLFT["balanceOf(address)"](locker.address);

            //expect(locked.end).to.be.equal(expectedEnd);
            expect(locked.amount).to.be.equal(lockingAmount);

            expect(balance).to.be.gt(lockingAmount.mul(95).div(100));
            expect(balance).to.be.lt(lockingAmount);
        });

        it("should check if all setters work correctly", async function () {
            await locker.connect(sdtDeployer).setGovernance(alice.address);
            await locker.connect(alice).setDepositor(alice.address);
            await locker.connect(alice).setAccumulator(alice.address);

            expect(await locker.governance()).to.be.equal(alice.address);
            expect(await locker.depositor()).to.be.equal(alice.address);
            expect(await locker.accumulator()).to.be.equal(alice.address);

            await locker.connect(alice).setGovernance(sdtDeployer._address);
            await locker.connect(sdtDeployer).setAccumulator(STAKE_DAO_MULTISIG);
            await locker.connect(sdtDeployer).setDepositor(lendFlareDepositor.address);
        });
    });

    describe("Userflow: LendFlare Depositor -> LGV4 -> Rewards", function () {
        it("Initial LFT Lock", async function () {
            const amount = parseEther("1");
            // Already locked to max / Need to just increase amount
            await lendFlareDepositor.setRelock(false);
            // Transfer to Locker
            await lftToken.connect(lftTokenHolder).transfer(locker.address, amount);
            // Lock through Depositor Function
            await lendFlareDepositor.lockToken();

            const balance = await lftToken.balanceOf(lendFlareDepositor.address);
            expect(balance).to.be.equal(0);
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

            expect(afterVeBALBalance.amount).to.be.equal(currentVeBALBalance.amount.add(amount));
            expect(afterBalance).to.be.equal(beforeBalance.sub(amount));
            expect(sdBalBalance).to.be.equal(amount);
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

            expect(afterVeBALBalance.amount).to.be.equal(currentVeBALBalance.amount.add(amount));
            expect(afterBalance).to.be.equal(beforeBalance.sub(amount));
            expect(sdBalBalance).to.be.equal(amount);
            expect(staked).to.be.equal(amount);
        });
        it("Should claim rewards and send them to Accumulator", async function () {
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
            skip(86_400 * 7)
            const usdcBefore = await usdc.balanceOf(accumulator.address);
            const daiBefore = await dai.balanceOf(accumulator.address);
            const wethBefore = await weth.balanceOf(accumulator.address);
            const wbtcBefore = await wbtc.balanceOf(accumulator.address);
            await locker.connect(sdtDeployer).claimRewards([0, 1, 2, 3], accumulator.address);
            const usdcAfter = await usdc.balanceOf(accumulator.address);
            const daiAfter = await dai.balanceOf(accumulator.address);
            const wethAfter = await weth.balanceOf(accumulator.address);
            const wbtcAfter = await wbtc.balanceOf(accumulator.address);
            expect(usdcAfter).gt(usdcBefore);
            expect(daiAfter).gt(daiBefore);
            expect(wethAfter).gt(wethBefore);
            expect(wbtcAfter).gt(wbtcBefore);
        });
    });
});
