// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

// Base Tests
import "./baseTest/Base.t.sol";

import "contracts/tokens/sdCRV.sol";
import "contracts/depositors/CrvDepositor.sol";
import "contracts/accumulators/CurveAccumulator.sol";

import "contracts/dao/SmartWalletWhitelist.sol";
import "contracts/external/ProxyAdmin.sol";
import "contracts/external/TransparentUpgradeableProxy.sol";
import "contracts/sdtDistributor/SdtDistributorV2.sol";

// Interface
import "contracts/interfaces/IVeSDT.sol";
import "contracts/interfaces/ILiquidityGauge.sol";
import "contracts/interfaces/IGaugeController.sol";

interface ICRVStrategyProxy {
    function setSdveCRV(address) external;

    function setAccumulator(address) external;

    function setGovernance(address) external;

    function claim(address) external;

    function governance() external returns (address);
}

interface ICurveDistributor {
    function token_last_balance() external returns (uint256);
}

interface ICurveYCRVVoter {
    function governance() external returns (address);

    function setStrategy(address) external;

    function setGovernance(address) external;
}

interface IVeSdCRV {
    function governance() external returns (address);

    function setProxy(address) external;

    function setFeeDistribution(address) external;

    function setGovernance(address) external;

    function acceptGovernance() external;

    function deposit(uint256) external;

    function claim() external;
}

contract CrvMigrationTest is BaseTest {
    address internal constant LOCAL_DEPLOYER = address(0xDE);
    address internal constant ALICE = address(0xAA);
    address internal constant BOB = address(0xB0B);
    address internal constant CRV_STRATEGY_PROXY = 0xF34Ae3C7515511E29d8Afe321E67Bdf97a274f1A;
    address internal constant CRV_STRATEGY = 0x20F1d4Fed24073a9b9d388AfA2735Ac91f079ED6;
    address internal token = Constants.CRV;
    address internal vesdcrv = Constants.VESDCRV;
    address internal rewards = Constants.CRV3;

    uint256 internal constant INITIAL_AMOUNT_TO_LOCK = 1_000e18;

    sdCRV internal _sdCRV;
    CrvDepositor internal depositor;
    CurveAccumulator internal accumulator;
    SdtDistributorV2 internal sdtDistributor;
    SdtDistributorV2 internal sdtDistributorImpl;

    ProxyAdmin internal proxyAdmin;
    SmartWalletWhitelist internal smartWalletWhitelist;
    TransparentUpgradeableProxy internal proxy;

    IVeSDT internal veSDT;
    IVeSDT internal veSDTImpl;
    ICurveYCRVVoter internal oldLocker;
    ILiquidityGauge internal liquidityGauge;
    ILiquidityGauge internal liquidityGaugeImpl;
    IGaugeController internal gaugeController;

    function setUp() public {
        uint256 forkId = vm.createFork(vm.rpcUrl("mainnet"));
        vm.selectFork(forkId);

        // Set governance from vesdCRV to local deployer
        vm.prank(IVeSdCRV(vesdcrv).governance());
        IVeSdCRV(vesdcrv).setGovernance(LOCAL_DEPLOYER);
        ////////////////////////////////////////////////////////////////
        /// --- START DEPLOYEMENT
        ///////////////////////////////////////////////////////////////
        vm.startPrank(LOCAL_DEPLOYER);
        IVeSdCRV(vesdcrv).acceptGovernance();

        // Deploy Proxy Admin
        proxyAdmin = new ProxyAdmin();

        // Deploy Smart Wallet Whitelist
        smartWalletWhitelist = new SmartWalletWhitelist(LOCAL_DEPLOYER);

        // Deploy veSDT
        bytes memory veSDTData = abi.encodeWithSignature(
            "initialize(address,address,address,string,string)",
            LOCAL_DEPLOYER,
            token,
            address(smartWalletWhitelist),
            "Vote-escrowed SDT",
            "veSDT"
        );
        veSDTImpl = IVeSDT(deployCode("artifacts/contracts/dao/veSDT.vy/veSDT.json"));
        proxy = new TransparentUpgradeableProxy(address(veSDTImpl), address(proxyAdmin), veSDTData);
        veSDT = IVeSDT(address(proxy));

        // Deploy sdCRV token
        _sdCRV = new sdCRV("Stake DAO CRV", "sdCRV");

        // Deploy crv depositor
        depositor = new CrvDepositor(Constants.CRV, Constants.OLD_CRV_LOCKER, address(_sdCRV));

        // Deploy Gauge Controller
        gaugeController = IGaugeController(
            deployCode(
                "artifacts/contracts/dao/GaugeController.vy/GaugeController.json",
                abi.encode(Constants.SDT, Constants.VE_SDT, LOCAL_DEPLOYER)
            )
        );

        // Deploy SDT Distributor
        bytes memory sdtDistributorData = abi.encodeWithSignature(
            "initialize(address,address,address,address)",
            address(gaugeController),
            LOCAL_DEPLOYER,
            LOCAL_DEPLOYER,
            LOCAL_DEPLOYER
        );
        sdtDistributorImpl = new SdtDistributorV2();
        proxy = new TransparentUpgradeableProxy(address(sdtDistributorImpl), address(proxyAdmin), sdtDistributorData);
        sdtDistributor = SdtDistributorV2(address(proxy));

        // Deploy Liquidity Gauge V4
        bytes memory lgData = abi.encodeWithSignature(
            "initialize(address,address,address,address,address,address)",
            address(address(_sdCRV)),
            LOCAL_DEPLOYER,
            Constants.SDT,
            Constants.VE_SDT,
            Constants.VE_SDT_BOOST_PROXY,
            address(sdtDistributor)
        );
        liquidityGaugeImpl =
            ILiquidityGauge(deployCode("artifacts/contracts/staking/LiquidityGaugeV4.vy/LiquidityGaugeV4.json"));
        proxy = new TransparentUpgradeableProxy(address(liquidityGaugeImpl), address(proxyAdmin), lgData);
        liquidityGauge = ILiquidityGauge(address(proxy));

        // Deploy Accumulator
        accumulator = new CurveAccumulator(rewards, address(liquidityGauge));
        vm.stopPrank();
        ////////////////////////////////////////////////////////////////
        /// --- START SETTERS
        ///////////////////////////////////////////////////////////////
        vm.prank(ICurveYCRVVoter(Constants.OLD_CRV_LOCKER).governance());
        ICurveYCRVVoter(Constants.OLD_CRV_LOCKER).setStrategy(address(depositor));

        vm.startPrank(LOCAL_DEPLOYER);
        IVeSdCRV(vesdcrv).setProxy(address(0));
        IVeSdCRV(vesdcrv).setFeeDistribution(address(0));
        depositor.setGauge(address(liquidityGauge));
        _sdCRV.setOperator(address(depositor));
        accumulator.setLocker(Constants.OLD_CRV_LOCKER);
        accumulator.setGauge(address(liquidityGauge));
        liquidityGauge.add_reward(rewards, address(accumulator));
        vm.stopPrank();

        deal(token, ALICE, INITIAL_AMOUNT_TO_LOCK);
    }

    function test01VesdCRVShouldBeDisable() public {
        vm.startPrank(ALICE);
        IERC20(token).approve(vesdcrv, INITIAL_AMOUNT_TO_LOCK);
        vm.expectRevert();
        IVeSdCRV(vesdcrv).deposit(INITIAL_AMOUNT_TO_LOCK);
    }

    function test02UserCanMigrateVesdCRV() public {
        deal(vesdcrv, ALICE, INITIAL_AMOUNT_TO_LOCK);
        vm.startPrank(ALICE);
        IERC20(vesdcrv).approve(address(depositor), INITIAL_AMOUNT_TO_LOCK);
        depositor.lockSdveCrvToSdCrv(INITIAL_AMOUNT_TO_LOCK);
        assertEq(_sdCRV.balanceOf(ALICE), INITIAL_AMOUNT_TO_LOCK, "ERROR_020");
    }

    function test03UserCanMigrateVesdCRV2TimeInRow() public {
        deal(vesdcrv, ALICE, INITIAL_AMOUNT_TO_LOCK);
        vm.startPrank(ALICE);
        IERC20(vesdcrv).approve(address(depositor), INITIAL_AMOUNT_TO_LOCK);
        depositor.lockSdveCrvToSdCrv(INITIAL_AMOUNT_TO_LOCK / 2);
        depositor.lockSdveCrvToSdCrv(INITIAL_AMOUNT_TO_LOCK / 2);
        assertEq(_sdCRV.balanceOf(ALICE), INITIAL_AMOUNT_TO_LOCK, "ERROR_030");
    }

    function test04Claim3CRVAfterMigration() public {
        uint256 balanceRewardBefore = IERC20(rewards).balanceOf(ALICE);
        deal(vesdcrv, ALICE, INITIAL_AMOUNT_TO_LOCK);
        vm.startPrank(ALICE);
        IVeSdCRV(vesdcrv).claim();
        uint256 balanceRewardAfter = IERC20(rewards).balanceOf(ALICE);
        assertGt(balanceRewardAfter, balanceRewardBefore, "ERROR_040");
    }

    function test05DepositCRVMintSdCRVNoLockNoStake() public {
        deal(token, ALICE, INITIAL_AMOUNT_TO_LOCK);
        vm.startPrank(ALICE);
        IERC20(token).approve(address(depositor), INITIAL_AMOUNT_TO_LOCK);
        uint256 balanceSdCRVBefore = _sdCRV.balanceOf(ALICE);
        depositor.deposit(INITIAL_AMOUNT_TO_LOCK, false, false, ALICE);
        uint256 balanceSdCRVAfter = _sdCRV.balanceOf(ALICE);

        assertGt(balanceSdCRVAfter, balanceSdCRVBefore, "ERROR_050");
        assertGt(balanceSdCRVAfter, 0, "ERROR_051");
        assertLt(balanceSdCRVAfter, INITIAL_AMOUNT_TO_LOCK, "ERROR_052");
    }

    function test06DepositCRVMintSdCRVLockNoStake() public {
        deal(token, ALICE, INITIAL_AMOUNT_TO_LOCK);
        vm.startPrank(ALICE);
        IERC20(token).approve(address(depositor), INITIAL_AMOUNT_TO_LOCK);
        uint256 balanceSdCRVBefore = _sdCRV.balanceOf(ALICE);
        depositor.deposit(INITIAL_AMOUNT_TO_LOCK, true, false, ALICE);
        uint256 balanceSdCRVAfter = _sdCRV.balanceOf(ALICE);

        assertEq(balanceSdCRVAfter - balanceSdCRVBefore, INITIAL_AMOUNT_TO_LOCK, "ERROR_060");
    }

    function test07DepositCRVMintSdCRVLockStake() public {
        deal(token, ALICE, INITIAL_AMOUNT_TO_LOCK);
        vm.startPrank(ALICE);
        IERC20(token).approve(address(depositor), INITIAL_AMOUNT_TO_LOCK);
        uint256 balanceSdCRVBefore = _sdCRV.balanceOf(ALICE);
        uint256 balanceGaugeBefore = _sdCRV.balanceOf(address(liquidityGauge));
        depositor.deposit(INITIAL_AMOUNT_TO_LOCK, true, true, ALICE);
        uint256 balanceSdCRVAfter = _sdCRV.balanceOf(ALICE);
        uint256 balanceGaugeAfter = _sdCRV.balanceOf(address(liquidityGauge));

        assertEq(balanceSdCRVAfter - balanceSdCRVBefore, 0, "ERROR_070");
        assertEq(balanceGaugeAfter - balanceGaugeBefore, INITIAL_AMOUNT_TO_LOCK, "ERROR_071");
    }

    function test08Claim3CRVFromStrategyProxyToAccumulator() public {
        uint256 last_token_amount = ICurveDistributor(Constants.CURVE_FEE_DISTRIBUTOR).token_last_balance();
        deal(rewards, Constants.CURVE_FEE_DISTRIBUTOR, last_token_amount + INITIAL_AMOUNT_TO_LOCK);
        vm.prank(ICurveYCRVVoter(Constants.OLD_CRV_LOCKER).governance());
        ICurveYCRVVoter(Constants.OLD_CRV_LOCKER).setStrategy(CRV_STRATEGY_PROXY);
        timeJump(Constants.DAY * 8);

        uint256 balanceRewardAccumulatorBefore = IERC20(rewards).balanceOf(address(accumulator));
        vm.prank(ICRVStrategyProxy(CRV_STRATEGY_PROXY).governance());
        ICRVStrategyProxy(CRV_STRATEGY_PROXY).setSdveCRV(LOCAL_DEPLOYER);
        vm.prank(LOCAL_DEPLOYER);
        ICRVStrategyProxy(CRV_STRATEGY_PROXY).claim(address(accumulator));
        uint256 balanceRewardAccumulatorAfter = IERC20(rewards).balanceOf(address(accumulator));

        assertGt(balanceRewardAccumulatorAfter - balanceRewardAccumulatorBefore, 0, "ERROR_080");
    }

    function test09Notify3CRVToLGV4() public {
        deal(rewards, Constants.OLD_CRV_LOCKER, 1e18);

        vm.prank(ICRVStrategyProxy(CRV_STRATEGY).governance());
        ICRVStrategyProxy(CRV_STRATEGY).setAccumulator(address(accumulator));
        accumulator.notifyAll();

        assertEq(IERC20(rewards).balanceOf(address(accumulator)), 0, "ERROR_090");
        assertEq(IERC20(rewards).balanceOf(address(liquidityGauge)), 1e18, "ERROR_091");
    }

    function test10Claim3CRVFromLGV4() public {
        // Notify rewards to LGV4
        deal(rewards, Constants.OLD_CRV_LOCKER, 1e18);
        vm.prank(ICRVStrategyProxy(CRV_STRATEGY).governance());
        ICRVStrategyProxy(CRV_STRATEGY).setAccumulator(address(accumulator));
        accumulator.notifyAll();

        // Claim rewards
        deal(token, ALICE, INITIAL_AMOUNT_TO_LOCK);
        vm.startPrank(ALICE);
        IERC20(token).approve(address(depositor), INITIAL_AMOUNT_TO_LOCK);
        uint256 balanceSdCRVBefore = IERC20(rewards).balanceOf(ALICE);
        depositor.deposit(INITIAL_AMOUNT_TO_LOCK, true, true, ALICE);
        timeJump(Constants.DAY * 10);
        liquidityGauge.claim_rewards(ALICE);
        uint256 balanceSdCRVAfter = IERC20(rewards).balanceOf(ALICE);

        assertGt(balanceSdCRVAfter, balanceSdCRVBefore, "ERROR_100");
    }

    ////////////////////////////////////////////////////////////////
    /// --- HELPER
    ///////////////////////////////////////////////////////////////
}
