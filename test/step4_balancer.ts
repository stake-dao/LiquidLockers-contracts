import { expect } from "chai";
import { ethers, network } from "hardhat";

import { parseEther } from "@ethersproject/units";
import { Contract } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";
import { JsonRpcSigner } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import ERC20ABI from "./fixtures/ERC20.json";
import VETOKENABI from "./fixtures/veCRV.json";
import GaugeControllerABI from "./fixtures/GaugeController.json";
import BalancerFeeDistributorABI from "./fixtures/BalancerFeeDistributor.json";
import BalancerSmartWalletCheckerABI from "./fixtures/BalancerSmartWalletChecker.json";

import {
    BAL,
    BALANCER_FEE_DISTRIBUTOR,
    BALANCER_GAUGE_CONTROLLER,
    BALANCER_MULTISIG,
    BALANCER_POOL_TOKEN,
    BPT_HOLDER,
    EXAMPLE_GAUGE,
    HOLDER,
    REWARD,
    RANDOM,
    SDT,
    SMART_WALLET_CHECKER,
    SMAT_WALLET_CHECKER_AUTHORIZER,
    STAKE_DAO_MULTISIG,
    VE_BAL,
    VE_SDT,
    VE_SDT_BOOST_PROXY,
    SDT_DISTRIBUTOR,
} from "./constant";
import { skip } from "./utils";

const ONE_YEAR_IN_SECONDS = 86_400 * 365;
const ETH_100 = BigNumber.from(10).mul(BigNumber.from(10).pow(18)).toHexString();

const getNow = async function () {
    let blockNum = await ethers.provider.getBlockNumber();
    let block = await ethers.provider.getBlock(blockNum);
    var time = block.timestamp;
    return time;
};

describe("Balancer Depositor", function () {
    // Signers
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let deployer: SignerWithAddress;
    // Contract
    let locker: Contract;
    let sdBalToken: Contract;
    let balancerDepositor: Contract;
    let liquidityGaugeProxy: Contract;
    let liquidityGaugeImpl: Contract;
    let accumulator: Contract;
    // Balancer Contract
    let veBAL: Contract;
    let bptToken: Contract;
    let feeDistributor: Contract;
    let gaugeController: Contract;
    let smartWalletChecker: Contract;

    // Helper Signers
    let holder: JsonRpcSigner;
    let bptTokenHolder: JsonRpcSigner;
    let balancerMultisig: JsonRpcSigner;

    before(async function () {
        [deployer, bob] = await ethers.getSigners();
        const accounts = await ethers.getSigners();
        alice = accounts[0]

        // BPT
        bptToken = await ethers.getContractAt(ERC20ABI, BALANCER_POOL_TOKEN);

        // veBAL
        veBAL = await ethers.getContractAt(VETOKENABI, VE_BAL);

        // Impersonate accounts and fill with ETH
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [HOLDER]
        });
        await network.provider.send("hardhat_setBalance", [HOLDER, ETH_100]);
        holder = ethers.provider.getSigner(HOLDER);

        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [BPT_HOLDER]
        });
        await network.provider.send("hardhat_setBalance", [BPT_HOLDER, ETH_100]);
        bptTokenHolder = ethers.provider.getSigner(BPT_HOLDER);

        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [SMAT_WALLET_CHECKER_AUTHORIZER]
        });
        await network.provider.send("hardhat_setBalance", [SMAT_WALLET_CHECKER_AUTHORIZER, ETH_100]);

        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [BALANCER_MULTISIG]
        });
        await network.provider.send("hardhat_setBalance", [BALANCER_MULTISIG, ETH_100]);
        balancerMultisig = ethers.provider.getSigner(BALANCER_MULTISIG);


        // Smart Wallet Checker
        smartWalletChecker = await ethers.getContractAt(BalancerSmartWalletCheckerABI, SMART_WALLET_CHECKER);

        // Balancer Gauge Controller
        gaugeController = await ethers.getContractAt(GaugeControllerABI, BALANCER_GAUGE_CONTROLLER);

        // Balancer Fee Distributor
        feeDistributor = await ethers.getContractAt(BalancerFeeDistributorABI, BALANCER_FEE_DISTRIBUTOR);

        // Get Contract Artifacts
        const sdBalTokenContract = await ethers.getContractFactory("sdToken");
        const balancerLockerContract = await ethers.getContractFactory("BalancerLocker");
        const balancerDepositorContract = await ethers.getContractFactory("BalancerDepositor");
        const liquidityGaugeContract = await ethers.getContractFactory("LiquidityGaugeV4");
        const accumulatorContract = await ethers.getContractFactory("BalancerAccumulator");
        const Proxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
        const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");

        // Deployment
        sdBalToken = await sdBalTokenContract.deploy("Stake DAO Balancer", "sdBAL");
        locker = await balancerLockerContract.deploy(STAKE_DAO_MULTISIG);
        balancerDepositor = await balancerDepositorContract.deploy(bptToken.address, locker.address, sdBalToken.address);
        accumulator = await accumulatorContract.deploy(BAL);

        // Liquidity Gauge with Proxy
        liquidityGaugeImpl = await liquidityGaugeContract.deploy();

        const proxyAdmin = await ProxyAdmin.deploy();

        let ABI_SDTD = [
            "function initialize(address _staking_token, address _admin, address _SDT, address _voting_escrow, address _veBoost_proxy, address _distributor)"
          ];
        let liquidityGaugeInterface = new ethers.utils.Interface(ABI_SDTD);

        const data = liquidityGaugeInterface.encodeFunctionData("initialize", [
            sdBalToken.address,
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
        await locker.setDepositor(balancerDepositor.address);
        // Set Depositor as Operator of sdToken
        await sdBalToken.setOperator(balancerDepositor.address);
        // Whitelist Locker in the Smart Wallet Checker to be able to lock BPT (Balancer Protocol Actions)
        await smartWalletChecker.connect(balancerMultisig).allowlistAddress(locker.address);
        // Initialize Liquidity Gauge & set to Depositor
        await balancerDepositor.setGauge(liquidityGaugeProxy.address);
        // Initialize accumulator
        await accumulator.setLocker(locker.address);
        await accumulator.setGauge(liquidityGaugeProxy.address);
    });

    describe("sdBAL", function () {
        it("should be setup correctly", async function () {
            const name = await sdBalToken.name();
            const symbol = await sdBalToken.symbol();
            const operator = await sdBalToken.operator();
            const depositor = await locker.depositor();

            expect(name).to.be.equal("Stake DAO Balancer");
            expect(symbol).to.be.equal("sdBAL");
            expect(operator).to.be.equal(balancerDepositor.address);
            expect(depositor).to.be.equal(balancerDepositor.address);

            const allowed = await smartWalletChecker.check(locker.address);
            expect(allowed).to.be.true;
        });
        it("should change sdBAL operator via BalancerDepositor", async function () {
            // Only Depositor can call
            await expect(
                sdBalToken.setOperator(balancerDepositor.address)
            ).to.be.revertedWith("!authorized");

            await balancerDepositor.setSdTokenOperator(alice.address);
            const operator = await sdBalToken.operator();
            expect(operator).to.be.equal(alice.address);

        });

        it("should mint sdBAL tokens", async function () {
            const amount = parseEther("1");

            let before = await sdBalToken.totalSupply();
            const balanceBefore = await sdBalToken.balanceOf(alice.address);

            await sdBalToken.connect(alice).mint(alice.address, amount);

            const after = await sdBalToken.totalSupply();
            const balanceAfter = await sdBalToken.balanceOf(alice.address);

            expect(before).to.be.equal(0);
            expect(after).to.be.equal(amount);

            expect(balanceBefore).to.be.equal(0);
            expect(balanceAfter).to.be.equal(amount);
        });

        it("should burn sdBAL tokens", async function () {
            const amount = parseEther("1");

            let before = await sdBalToken.totalSupply();
            await sdBalToken.connect(alice).burn(alice.address, amount);
            const after = await sdBalToken.totalSupply();

            expect(before).to.be.equal(amount);
            expect(after).to.be.equal(0);

            // Reset
            await sdBalToken.connect(alice).setOperator(balancerDepositor.address);
        });
    });

    describe("Lock Initial Actions", function () {
        it("Should create a lock", async function () {
            const lockingAmount = parseEther("1");
            const lockEnd = (await getNow()) + ONE_YEAR_IN_SECONDS;

            await bptToken.connect(bptTokenHolder).transfer(locker.address, lockingAmount);
            await locker.createLock(lockingAmount, lockEnd);

            const locked = await veBAL.locked(locker.address);

            // Rounded down to week
            const expectedEnd = lockEnd - (lockEnd % (86_400 * 7))
            const balance = await veBAL["balanceOf(address)"](locker.address);

            expect(locked.end).to.be.equal(expectedEnd);
            expect(locked.amount).to.be.equal(lockingAmount);

            expect(balance).to.be.gt(lockingAmount.mul(95).div(100));
            expect(balance).to.be.lt(lockingAmount);
        });

        it("should check if all setters work correctly", async function () {
            await locker.setGovernance(alice.address);
            await locker.setFeeDistributor(alice.address);
            await locker.setDepositor(alice.address);
            await locker.setGaugeController(alice.address);
            await locker.setAccumulator(alice.address);

            expect(await locker.governance()).to.be.equal(alice.address);
            expect(await locker.feeDistributor()).to.be.equal(alice.address);
            expect(await locker.depositor()).to.be.equal(alice.address);
            expect(await locker.gaugeController()).to.be.equal(alice.address);
            expect(await locker.accumulator()).to.be.equal(alice.address);

            await locker.connect(alice).setGovernance(deployer.address);
            await locker.setFeeDistributor(BALANCER_FEE_DISTRIBUTOR);
            await locker.setAccumulator(STAKE_DAO_MULTISIG);
            await locker.setDepositor(balancerDepositor.address);
            await locker.setGaugeController(BALANCER_GAUGE_CONTROLLER);
        });
    });

    describe("Userflow: Balancer Depositor -> LGV4 -> Rewards", function () {
        it("Initial BPT Lock", async function () {
            const amount = parseEther("1");
            // Already locked to max / Need to just increase amount
            await balancerDepositor.setRelock(false);
            // Transfer to Locker
            await bptToken.connect(bptTokenHolder).transfer(locker.address, amount)
            // Lock through Depositor Function
            await balancerDepositor.lockToken();

            const balance = await bptToken.balanceOf(balancerDepositor.address);
            expect(balance).to.be.equal(0);
        });
        it("Should lock BPT with Depositor", async function () {
            const currentVeBALBalance = await veBAL.locked(locker.address);
            const beforeBalance = await bptToken.balanceOf(bptTokenHolder._address);

            const amount = parseEther("1");
            // Approve Balancer Depositor
            await bptToken.connect(bptTokenHolder).approve(balancerDepositor.address, amount);
            await balancerDepositor.connect(bptTokenHolder).deposit(amount, true, false, bptTokenHolder._address);

            const afterVeBALBalance = await veBAL.locked(locker.address);
            const afterBalance = await bptToken.balanceOf(bptTokenHolder._address);
            const sdBalBalance = await sdBalToken.balanceOf(bptTokenHolder._address);

            expect(afterVeBALBalance.amount).to.be.equal(currentVeBALBalance.amount.add(amount));
            expect(afterBalance).to.be.equal(beforeBalance.sub(amount));
            expect(sdBalBalance).to.be.equal(amount);
        });

        it("Should lock BPT and Stake to LGV4", async function () {
            const currentVeBALBalance = await veBAL.locked(locker.address);
            const beforeBalance = await bptToken.balanceOf(bptTokenHolder._address);

            const amount = parseEther("1");
            // Approve Balancer Depositor
            await bptToken.connect(bptTokenHolder).approve(balancerDepositor.address, amount);
            await balancerDepositor.connect(bptTokenHolder).deposit(amount, true, true, bptTokenHolder._address);

            const afterVeBALBalance = await veBAL.locked(locker.address);
            const afterBalance = await bptToken.balanceOf(bptTokenHolder._address);
            const sdBalBalance = await sdBalToken.balanceOf(bptTokenHolder._address);
            const staked = await liquidityGaugeProxy.balanceOf(bptTokenHolder._address);

            expect(afterVeBALBalance.amount).to.be.equal(currentVeBALBalance.amount.add(amount));
            expect(afterBalance).to.be.equal(beforeBalance.sub(amount));
            expect(sdBalBalance).to.be.equal(amount);
            expect(staked).to.be.equal(amount);
        });
        it("Should add rewards to Accumulator & Distribute to LGV4", async function () {
            let rewardToken = await ethers.getContractAt(ERC20ABI, BAL);
            let bonusToken = await ethers.getContractAt(ERC20ABI, REWARD);
            // Add Reward
            await liquidityGaugeProxy.add_reward(rewardToken.address, accumulator.address);
            await liquidityGaugeProxy.add_reward(bonusToken.address, accumulator.address);
            // Set Accumulator
            await locker.setAccumulator(accumulator.address);
            await accumulator.setTokenRewards([rewardToken.address, bonusToken.address]);

            rewardToken.connect(holder).transfer(BALANCER_FEE_DISTRIBUTOR, parseEther("10"));
            bonusToken.connect(holder).transfer(BALANCER_FEE_DISTRIBUTOR, parseEther("10"));

            await feeDistributor.checkpoint();
            await feeDistributor.checkpointUser(locker.address);
            skip(86_401 * 7)
            await feeDistributor.checkpoint();
            await feeDistributor.checkpointUser(locker.address);
            skip(86_401 * 7)
            await feeDistributor.checkpoint();
            await feeDistributor.checkpointUser(locker.address);

            // Claim Token Rewards
            await accumulator.claimAllRewardsAndNotify();

            let lgBalance = await rewardToken.balanceOf(liquidityGaugeProxy.address);
            let lgBonusBalance = await bonusToken.balanceOf(liquidityGaugeProxy.address);

            expect(lgBalance).to.be.gt(0);
            expect(lgBonusBalance).to.be.gt(0);
        });
    });

    describe("Governance Actions", function () {
        it("Should vote for a gauge via locker", async function () {
            let result = await gaugeController.vote_user_slopes(locker.address, EXAMPLE_GAUGE);
            expect(result[1]).to.be.equal(0);
            await locker.voteGaugeWeight(EXAMPLE_GAUGE, 10_000); // 100% vote for this gauge

            result = await gaugeController.vote_user_slopes(locker.address, EXAMPLE_GAUGE);
            expect(result[1]).to.be.equal(10_000);
        });

        it("Should claim rewards", async function () {
            let rewardToken = await ethers.getContractAt(ERC20ABI, BAL);
            let bonusToken = await ethers.getContractAt(ERC20ABI, REWARD);

            rewardToken.connect(holder).transfer(BALANCER_FEE_DISTRIBUTOR, parseEther("10"));
            bonusToken.connect(holder).transfer(BALANCER_FEE_DISTRIBUTOR, parseEther("10"));

            await feeDistributor.checkpoint();
            await feeDistributor.checkpointUser(locker.address);
            skip(86_401 * 7)
            await feeDistributor.checkpoint();
            await feeDistributor.checkpointUser(locker.address);
            skip(86_401 * 7)
            await feeDistributor.checkpoint();
            await feeDistributor.checkpointUser(locker.address);

            let govBonusTokenBalance = await bonusToken.balanceOf(locker.governance());
            let govRewardTokenBalance = await rewardToken.balanceOf(locker.governance());

            expect(govBonusTokenBalance).to.be.equal(0);
            expect(govRewardTokenBalance).to.be.equal(0);

            // Claim All
            await locker.claimAllRewards([bonusToken.address, rewardToken.address], locker.governance());

            const balanceRewardAfter = await rewardToken.balanceOf(locker.address);
            const balanceBonusAfter = await rewardToken.balanceOf(locker.address);

            // Locker should hold nothing
            expect(balanceRewardAfter).to.be.equal(0);
            expect(balanceBonusAfter).to.be.equal(0);

            govBonusTokenBalance = await bonusToken.balanceOf(locker.governance());
            govRewardTokenBalance = await rewardToken.balanceOf(locker.governance());

            expect(govBonusTokenBalance).to.be.gt(0);
            expect(govRewardTokenBalance).to.be.gt(0);
        });

        it("Should release locked BPT", async function () {
            // Move one year from now and release
            skip(ONE_YEAR_IN_SECONDS)
            const toRelease = await veBAL.locked(locker.address);
            await locker.release(deployer.address)

            const balance = await bptToken.balanceOf(locker.address);
            const deployerBalance = await bptToken.balanceOf(deployer.address);

            expect(balance).to.be.equal(0);
            expect(deployerBalance).to.be.equal(toRelease.amount);
        });

        it("Should execute any function", async function () {
            const data = "0x"; // empty
            await locker.execute(balancerDepositor.address, 0, data);

            // Only Gov can call
            await expect(
                locker.connect(bob).execute(balancerDepositor.address, 0, data)
            ).to.be.revertedWith("!gov");
        });
    });
});