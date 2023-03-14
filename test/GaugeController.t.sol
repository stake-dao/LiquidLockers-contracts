// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

// Base Tests
import "./baseTest/Base.t.sol";

// Contract
import "contracts/lockers/AngleLocker.sol";
import "contracts/lockers/FxsLocker.sol";
import "contracts/accumulators/AngleAccumulatorV3.sol";
import "contracts/accumulators/FxsAccumulator.sol";
import "contracts/depositors/Depositor.sol";

import "contracts/tokens/sdToken.sol";
import "contracts/sdtDistributor/SdtDistributor.sol";
import "contracts/dao/SmartWalletWhitelist.sol";
import "contracts/external/ProxyAdmin.sol";
import "contracts/external/TransparentUpgradeableProxy.sol";
import "contracts/sdtDistributor/MasterchefMasterToken.sol";
import "contracts/staking/ClaimRewards.sol";

// Interface
import "contracts/interfaces/IVeSDT.sol";
import "contracts/interfaces/IVeANGLE.sol";
import "contracts/interfaces/ISmartWalletChecker.sol";
import "contracts/interfaces/IAngleGaugeController.sol";
import "contracts/interfaces/ILiquidityGauge.sol";
import "contracts/interfaces/IGaugeController.sol";
import "contracts/interfaces/IMasterchef.sol";

contract GaugeControllerTest is BaseTest {
    address internal constant LOCAL_DEPLOYER = address(0xDE);
    address internal constant ALICE = address(0xAA);
    address internal constant BOB = address(0xB0B);
    address internal constant GAUGE_FAKE = address(0xBABE);
    address internal constant MASTER_CHEF = 0xfEA5E213bbD81A8a94D0E1eDB09dBD7CEab61e1c;
    address internal token = AddressBook.SDT;
    address internal angle = AddressBook.ANGLE;
    address internal fxs = AddressBook.FXS;

    uint256 internal constant INIITIAL_AMOUNT_TO_LOCK = 1_000e18;
    uint256 internal constant MAX_DURATION = 60 * 60 * 24 * 365 * 4;
    uint256 internal constant ACCUMULATOR_CLAIMER_FEE = 100; // 1%

    sdToken internal _sdAngle;
    sdToken internal _sdFxs;
    Depositor internal angleDepositor;
    Depositor internal fxsDepositor;
    AngleLocker internal angleLocker;
    FxsLocker internal fxsLocker;

    FxsAccumulator internal fxsAccumulator;
    AngleAccumulatorV3 internal angleAccumulator;

    SdtDistributor internal sdtDistributor;
    SdtDistributor internal sdtDistributorImpl;
    ProxyAdmin internal proxyAdmin;
    ClaimRewards internal claimRewards;
    SmartWalletWhitelist internal smartWalletWhitelist;
    TransparentUpgradeableProxy internal proxy;
    MasterchefMasterToken internal masterChefToken;

    IVeSDT internal veSDT;
    IVeSDT internal veSDTImpl;
    IVeSDT internal veSDTImplNew;
    IMasterchef internal masterchef;
    ILiquidityGauge internal angleLiquidityGauge;
    ILiquidityGauge internal fxsLiquidityGauge;
    ILiquidityGauge internal liquidityGaugeImpl;
    IGaugeController internal gaugeController;

    function setUp() public {
        uint256 forkId = vm.createFork(vm.rpcUrl("mainnet"));
        vm.selectFork(forkId);

        ////////////////////////////////////////////////////////////////
        /// --- START DEPLOYEMENT
        ///////////////////////////////////////////////////////////////
        vm.startPrank(LOCAL_DEPLOYER);

        // Deploy Proxy Admin
        proxyAdmin = new ProxyAdmin();

        // Deploy Smart Wallet Whitelist
        smartWalletWhitelist = new SmartWalletWhitelist(LOCAL_DEPLOYER);

        // Deploy ClaimRewards
        claimRewards = new ClaimRewards();

        // Deploy veSDT
        bytes memory veSDTData = abi.encodeWithSignature(
            "initialize(address,address,address,string,string)",
            LOCAL_DEPLOYER,
            token,
            address(smartWalletWhitelist),
            "Vote-escrowed SDT",
            "veSDT"
        );
        veSDTImpl = IVeSDT(deployCode("artifacts/vyper-contracts/veSDT.vy/veSDT.json"));
        veSDTImplNew = IVeSDT(deployCode("artifacts/vyper-contracts/veSDT.vy/veSDT.json"));
        proxy = new TransparentUpgradeableProxy(address(veSDTImpl), address(proxyAdmin), veSDTData);
        veSDT = IVeSDT(address(proxy));
        vm.stopPrank();

        // Deploy Gauge Controller
        gaugeController = IGaugeController(
            deployCode(
                "artifacts/vyper-contracts/GaugeController.vy/GaugeController.json",
                abi.encode(Constants.SDT, address(veSDT), LOCAL_DEPLOYER)
            )
        );

        // Deploy SDT Distributor
        bytes memory sdtDistributorData = abi.encodeWithSignature(
            "initialize(address,address,address,address,address,address)",
            token,
            address(gaugeController),
            MASTER_CHEF,
            LOCAL_DEPLOYER,
            LOCAL_DEPLOYER,
            LOCAL_DEPLOYER
        );
        sdtDistributorImpl = new SdtDistributor();
        proxy = new TransparentUpgradeableProxy(address(sdtDistributorImpl), address(proxyAdmin), sdtDistributorData);
        sdtDistributor = SdtDistributor(address(proxy));

        // Deploy sdToken
        _sdAngle = new sdToken("Stake DAO ANGLE", "_sdAngle");
        _sdFxs = new sdToken("Stake DAO FXS", "_sdFxs");

        // Deploy Accumulator
        angleAccumulator = new AngleAccumulatorV3(AddressBook.AG_EUR, address(0));
        fxsAccumulator = new FxsAccumulator(AddressBook.FXS, address(0));

        // Deploy Locker
        angleLocker = new AngleLocker(address(angleAccumulator));
        fxsLocker = new FxsLocker(address(fxsAccumulator));

        // Deploy Depositor
        angleDepositor = new Depositor(address(angle), address(angleLocker), address(_sdAngle));
        fxsDepositor = new Depositor(address(fxs), address(fxsLocker), address(_sdFxs));

        // Deploy LGV4 model
        liquidityGaugeImpl =
            ILiquidityGauge(deployCode("artifacts/vyper-contracts/LiquidityGaugeV4.vy/LiquidityGaugeV4.json"));
        // Deploy Liquidity Gauge V4 for Angle
        bytes memory lgData = abi.encodeWithSignature(
            "initialize(address,address,address,address,address,address)",
            address(_sdAngle),
            address(this),
            AddressBook.SDT,
            address(veSDT),
            AddressBook.VE_SDT_BOOST_PROXY,
            address(sdtDistributor)
        );
        proxy = new TransparentUpgradeableProxy(address(liquidityGaugeImpl), address(proxyAdmin), lgData);
        angleLiquidityGauge = ILiquidityGauge(address(proxy));

        // Deploy Liquidity Gauge V4 for Fxs
        lgData = abi.encodeWithSignature(
            "initialize(address,address,address,address,address,address)",
            address(_sdFxs),
            address(this),
            AddressBook.SDT,
            address(veSDT),
            AddressBook.VE_SDT_BOOST_PROXY,
            address(sdtDistributor)
        );
        proxy = new TransparentUpgradeableProxy(address(liquidityGaugeImpl), address(proxyAdmin), lgData);
        fxsLiquidityGauge = ILiquidityGauge(address(proxy));

        ////////////////////////////////////////////////////////////////
        /// --- START SETTERS
        ///////////////////////////////////////////////////////////////
        _sdAngle.setOperator(address(angleDepositor));
        _sdFxs.setOperator(address(fxsDepositor));
        angleLocker.setAngleDepositor(address(angleDepositor));
        angleLocker.setAccumulator(address(angleAccumulator));
        fxsLocker.setFxsDepositor(address(fxsDepositor));
        fxsLocker.setAccumulator(address(fxsAccumulator));
        angleDepositor.setGauge(address(angleLiquidityGauge));
        fxsDepositor.setGauge(address(fxsLiquidityGauge));
        angleAccumulator.setGauge(address(angleLiquidityGauge));
        angleAccumulator.setClaimerFee(ACCUMULATOR_CLAIMER_FEE);
        angleAccumulator.setSdtDistributor(address(sdtDistributor));
        angleAccumulator.setLocker(address(angleLocker));
        fxsAccumulator.setGauge(address(fxsLiquidityGauge));
        fxsAccumulator.setClaimerFee(ACCUMULATOR_CLAIMER_FEE);
        fxsAccumulator.setSdtDistributor(address(sdtDistributor));
        fxsAccumulator.setLocker(address(fxsLocker));
        angleLiquidityGauge.add_reward(AddressBook.SAN_USDC_EUR, address(angleAccumulator));
        fxsLiquidityGauge.add_reward(fxs, address(fxsAccumulator));
        angleLiquidityGauge.set_claimer(address(claimRewards));
        fxsLiquidityGauge.set_claimer(address(claimRewards));

        vm.startPrank(LOCAL_DEPLOYER);
        gaugeController.add_type("Mainnet staking", 1e18); // 0
        gaugeController.add_type("External", 1e18); // 1
        gaugeController.add_gauge(address(angleLiquidityGauge), 0, 0); // gauge - type - weight
        gaugeController.add_gauge(address(fxsLiquidityGauge), 0, 0); // gauge - type - weight
        gaugeController.add_gauge(GAUGE_FAKE, 1, 0); // simulate an external gauge
        claimRewards.enableGauge(address(angleLiquidityGauge));
        claimRewards.enableGauge(address(fxsLiquidityGauge));
        claimRewards.addDepositor(fxs, address(fxsDepositor));
        claimRewards.addDepositor(angle, address(angleDepositor));

        smartWalletWhitelist.approveWallet(ALICE);
        vm.stopPrank();
        lockSDTCustom(ALICE, token, address(veSDT), 1_000_000e18, block.timestamp + 4 * 365 days);

        uint256 typeZeroWeight = gaugeController.get_type_weight(int128(0));
        uint256 typeOneWeight = gaugeController.get_type_weight(int128(1));
        assertEq(typeZeroWeight, 1e18, "ERROR_001");
        assertEq(typeOneWeight, 1e18, "ERROR_002");

        uint256 angleGaugeWeight = gaugeController.get_gauge_weight(address(angleLiquidityGauge));
        uint256 fxsGaugeWeight = gaugeController.get_gauge_weight(address(fxsLiquidityGauge));
        uint256 fakeGaugeWeight = gaugeController.get_gauge_weight(address(GAUGE_FAKE));
        assertEq(angleGaugeWeight, 0, "ERROR_003");
        assertEq(fxsGaugeWeight, 0, "ERROR_004");
        assertEq(fakeGaugeWeight, 0, "ERROR_005");

        IERC20 masterToken = sdtDistributor.masterchefToken();
        vm.prank(IMasterchef(MASTER_CHEF).owner());
        IMasterchef(MASTER_CHEF).add(1000, masterToken, false);
        uint256 poolsLength = IMasterchef(MASTER_CHEF).poolLength() - 1;

        vm.startPrank(LOCAL_DEPLOYER);
        sdtDistributor.initializeMasterchef(poolsLength);
        sdtDistributor.setDistribution(true);
        vm.stopPrank();

        deal(address(_sdAngle), ALICE, INIITIAL_AMOUNT_TO_LOCK);
        deal(address(_sdFxs), ALICE, INIITIAL_AMOUNT_TO_LOCK);
        deal(address(_sdAngle), BOB, INIITIAL_AMOUNT_TO_LOCK);
        deal(address(_sdFxs), BOB, INIITIAL_AMOUNT_TO_LOCK);
    }

    function test01ShouldVoteForGauge() public {
        uint256 wholePercent = 10000;
        uint256 angleVotePerc = 8000;
        uint256 fxsVotePerc = 2000;
        uint256 veSDTBalance = veSDT.balanceOf(ALICE);

        // vote
        vm.startPrank(ALICE);
        gaugeController.vote_for_gauge_weights(address(angleLiquidityGauge), angleVotePerc);
        gaugeController.vote_for_gauge_weights(address(fxsLiquidityGauge), fxsVotePerc);
        vm.stopPrank();

        // check vote
        uint256 angleWeight = gaugeController.get_gauge_weight(address(angleLiquidityGauge));
        uint256 angleRelWeight = gaugeController.gauge_relative_weight(address(angleLiquidityGauge));
        uint256 fxsWeight = gaugeController.get_gauge_weight(address(fxsLiquidityGauge));
        uint256 fxsRelWeight = gaugeController.gauge_relative_weight(address(fxsLiquidityGauge));
        uint256 totalWeight = gaugeController.get_total_weight();

        assertGt(angleWeight, 0, "ERROR_010");
        assertGt(fxsWeight, 0, "ERROR_011");
        assertApproxEqRel(angleWeight, ((veSDTBalance * angleVotePerc) / wholePercent), 10e15, "ERROR_012"); // 0.1%
        assertApproxEqRel(fxsWeight, ((veSDTBalance * fxsVotePerc) / wholePercent), 10e15, "ERROR_013"); // 0.1%
        assertEq(totalWeight, (angleWeight + fxsWeight) * 1e18, "ERROR_014");
        assertEq(angleRelWeight, 0, "ERROR_015");
        assertEq(fxsRelWeight, 0, "ERROR_016");
    }

    function test02CallGaugeCheckpointAfter1Week() public {
        uint256 wholePercent = 10000;
        uint256 angleVotePerc = 8000;
        uint256 fxsVotePerc = 2000;

        // vote
        vm.startPrank(ALICE);
        gaugeController.vote_for_gauge_weights(address(angleLiquidityGauge), angleVotePerc);
        gaugeController.vote_for_gauge_weights(address(fxsLiquidityGauge), fxsVotePerc);
        vm.stopPrank();

        timeJump(1 weeks);
        gaugeController.checkpoint_gauge(address(angleLiquidityGauge));

        uint256 angleRelWeight = gaugeController.gauge_relative_weight(address(angleLiquidityGauge));
        uint256 fxsRelWeight = gaugeController.gauge_relative_weight(address(fxsLiquidityGauge));

        assertEq(angleRelWeight, (angleVotePerc * 1e18) / wholePercent, "ERROR_020"); // 80%
        assertEq(fxsRelWeight, (fxsVotePerc * 1e18) / wholePercent, "ERROR_020"); // 20%
    }
}
