// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

// Base Tests
import "./baseTest/Base.t.sol";

// Contract
import "../../contracts/lockers/AngleLocker.sol";
import "../../contracts/lockers/FxsLocker.sol";
import "../../contracts/accumulators/AngleAccumulatorV3.sol";
import "../../contracts/accumulators/FxsAccumulator.sol";

import "../../contracts/tokens/sdToken.sol";
import "../../contracts/sdtDistributor/SdtDistributorV2.sol";
import "../../contracts/dao/SmartWalletWhitelist.sol";
import "../../contracts/external/ProxyAdmin.sol";
import "../../contracts/external/TransparentUpgradeableProxy.sol";
import "../../contracts/sdtDistributor/MasterchefMasterToken.sol";

// Interface
import "../../contracts/interfaces/IVeSDT.sol";
import "../../contracts/interfaces/ISmartWalletChecker.sol";
import "../../contracts/interfaces/ILiquidityGauge.sol";
import "../../contracts/interfaces/IGaugeController.sol";
import "../../contracts/interfaces/IMasterchef.sol";

contract SdtDistributorTest is BaseTest {
	address internal constant LOCAL_DEPLOYER = address(0xDE);
	address internal constant ALICE = address(0xAA);
	address internal constant BOB = address(0xB0B);
	address internal constant GAUGE_FAKE = address(0xBABE);
	address internal constant MASTER_CHEF = 0xfEA5E213bbD81A8a94D0E1eDB09dBD7CEab61e1c;
	address internal token = Constants.SDT;
	address internal angle = Constants.ANGLE;
	address internal fxs = Constants.FXS;

	uint256 internal constant INIITIAL_AMOUNT_TO_LOCK = 1_000e18;
	uint256 internal constant MAX_DURATION = 60 * 60 * 24 * 365 * 4;
	uint256 internal constant ACCUMULATOR_CLAIMER_FEE = 100; // 1%
	uint256 internal constant PERCENTAGE = 10000;

	sdToken internal _sdAngle;
	sdToken internal _sdFxs;
	AngleLocker internal angleLocker;
	FxsLocker internal fxsLocker;

	FxsAccumulator internal fxsAccumulator;
	AngleAccumulatorV3 internal angleAccumulator;

	SdtDistributorV2 internal sdtDistributor;
	SdtDistributorV2 internal sdtDistributorImpl;
	ProxyAdmin internal proxyAdmin;
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
		////////////////////////////////////////////////////////////////
		/// --- START DEPLOYEMENT
		///////////////////////////////////////////////////////////////
		vm.startPrank(LOCAL_DEPLOYER);

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
		veSDTImplNew = IVeSDT(deployCode("artifacts/contracts/dao/veSDT.vy/veSDT.json"));
		proxy = new TransparentUpgradeableProxy(address(veSDTImpl), address(proxyAdmin), veSDTData);
		veSDT = IVeSDT(address(proxy));
		vm.stopPrank();

		// Deploy Gauge Controller
		gaugeController = IGaugeController(
			deployCode(
				"artifacts/contracts/dao/GaugeController.vy/GaugeController.json",
				abi.encode(Constants.SDT, address(veSDT), LOCAL_DEPLOYER)
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

		// Deploy sdToken
		_sdAngle = new sdToken("Stake DAO ANGLE", "_sdAngle");
		_sdFxs = new sdToken("Stake DAO FXS", "_sdFxs");

		// Deploy Accumulator
		angleAccumulator = new AngleAccumulatorV3(Constants.AG_EUR, address(0));
		fxsAccumulator = new FxsAccumulator(Constants.FXS, address(0));

		// Deploy Locker
		angleLocker = new AngleLocker(address(angleAccumulator));
		fxsLocker = new FxsLocker(address(fxsAccumulator));

		// Deploy LGV4 model
		liquidityGaugeImpl = ILiquidityGauge(
			deployCode("artifacts/contracts/staking/LiquidityGaugeV4.vy/LiquidityGaugeV4.json")
		);
		// Deploy Liquidity Gauge V4 for Angle
		bytes memory lgData = abi.encodeWithSignature(
			"initialize(address,address,address,address,address,address)",
			address(_sdAngle),
			address(this),
			Constants.SDT,
			address(veSDT),
			Constants.VE_SDT_BOOST_PROXY,
			address(sdtDistributor)
		);
		proxy = new TransparentUpgradeableProxy(address(liquidityGaugeImpl), address(proxyAdmin), lgData);
		angleLiquidityGauge = ILiquidityGauge(address(proxy));

		// Deploy Liquidity Gauge V4 for Fxs
		lgData = abi.encodeWithSignature(
			"initialize(address,address,address,address,address,address)",
			address(_sdFxs),
			address(this),
			Constants.SDT,
			address(veSDT),
			Constants.VE_SDT_BOOST_PROXY,
			address(sdtDistributor)
		);
		proxy = new TransparentUpgradeableProxy(address(liquidityGaugeImpl), address(proxyAdmin), lgData);
		fxsLiquidityGauge = ILiquidityGauge(address(proxy));

		////////////////////////////////////////////////////////////////
		/// --- START SETTERS
		///////////////////////////////////////////////////////////////
		angleLiquidityGauge.add_reward(Constants.SAN_USDC_EUR, address(angleAccumulator));
		fxsLiquidityGauge.add_reward(fxs, address(fxsAccumulator));

		vm.startPrank(LOCAL_DEPLOYER);
		gaugeController.add_type("Mainnet staking", 1e18); // 0
		gaugeController.add_type("External", 1e18); // 1
		gaugeController.add_gauge(address(angleLiquidityGauge), 0, 0); // gauge - type - weight
		gaugeController.add_gauge(address(fxsLiquidityGauge), 0, 0); // gauge - type - weight
		gaugeController.add_gauge(GAUGE_FAKE, 1, 0); // simulate an external gauge

		smartWalletWhitelist.approveWallet(ALICE);
		vm.stopPrank();
		lockSDTCustom(ALICE, token, address(veSDT), 1_000_000e18, block.timestamp + Constants.YEAR * 4);

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
	}

	function test01ShouldDistributeToSingleGauge() public {
		// vote
		vm.prank(ALICE);
		gaugeController.vote_for_gauge_weights(address(angleLiquidityGauge), PERCENTAGE);

		vm.prank(LOCAL_DEPLOYER);
		sdtDistributor.approveGauge(address(angleLiquidityGauge));

		timeJump(Constants.WEEK + Constants.DAY);

		uint256 timestamp = block.timestamp - (block.timestamp % 86_400);
		uint256 balanceBefore = IERC20(token).balanceOf(address(angleLiquidityGauge));
		sdtDistributor.distribute(address(angleLiquidityGauge));
		uint256 balanceAfter = IERC20(token).balanceOf(address(angleLiquidityGauge));
		uint256 lastPull = sdtDistributor.pulls(timestamp);

		assertGt(balanceAfter, balanceBefore);
		assertEq(lastPull, balanceAfter - balanceBefore);
	}

	function test02DistributeIfDaysPast40() public {
		// vote
		vm.startPrank(ALICE);
		gaugeController.vote_for_gauge_weights(address(angleLiquidityGauge), PERCENTAGE / 2);
		gaugeController.vote_for_gauge_weights(address(fxsLiquidityGauge), PERCENTAGE / 2);
		vm.stopPrank();

		vm.startPrank(LOCAL_DEPLOYER);
		sdtDistributor.approveGauge(address(angleLiquidityGauge));
		sdtDistributor.approveGauge(address(fxsLiquidityGauge));
		vm.stopPrank();

		uint256 balanceBefore1 = IERC20(token).balanceOf(address(angleLiquidityGauge));
		uint256 balanceBefore2 = IERC20(token).balanceOf(address(fxsLiquidityGauge));

		timeJump(Constants.WEEK + Constants.DAY);

		sdtDistributor.distribute(address(angleLiquidityGauge));
		uint256 timestamp = block.timestamp - (block.timestamp % 86_400);
		uint256 lastPull1 = sdtDistributor.pulls(timestamp);

		timeJump(Constants.DAY * 32);
		sdtDistributor.distribute(address(fxsLiquidityGauge));
		timestamp = block.timestamp - (block.timestamp % 86_400);
		uint256 lastPull2 = sdtDistributor.pulls(timestamp);

		uint256 balanceAfter1 = IERC20(token).balanceOf(address(angleLiquidityGauge));
		uint256 balanceAfter2 = IERC20(token).balanceOf(address(fxsLiquidityGauge));

		assertEq(lastPull1 / 2, balanceAfter1 - balanceBefore1, "ERROR_020");
		assertEq((lastPull1 + lastPull2) / 2, balanceAfter2 - balanceBefore2, "ERROR_021");
	}

	function test03DistributeToGaugeAfter46DaysWithLeftover() public {
		// vote
		vm.startPrank(ALICE);
		gaugeController.vote_for_gauge_weights(address(angleLiquidityGauge), PERCENTAGE / 2);
		gaugeController.vote_for_gauge_weights(address(fxsLiquidityGauge), PERCENTAGE / 2);
		vm.stopPrank();

		vm.startPrank(LOCAL_DEPLOYER);
		sdtDistributor.approveGauge(address(angleLiquidityGauge));
		sdtDistributor.approveGauge(address(fxsLiquidityGauge));
		vm.stopPrank();

		uint256 balanceBefore1 = IERC20(token).balanceOf(address(angleLiquidityGauge));
		uint256 balanceBefore2 = IERC20(token).balanceOf(address(fxsLiquidityGauge));

		timeJump(Constants.DAY * 8);
		sdtDistributor.distribute(address(angleLiquidityGauge));
		uint256 timestamp = block.timestamp - (block.timestamp % 86_400);
		uint256 lastPull1 = sdtDistributor.pulls(timestamp);

		timeJump(Constants.DAY * 38);
		sdtDistributor.distribute(address(fxsLiquidityGauge));
		timestamp = block.timestamp - (block.timestamp % 86_400);
		uint256 lastPull2 = sdtDistributor.pulls(timestamp);

		uint256 balanceAfter1 = IERC20(token).balanceOf(address(angleLiquidityGauge));
		uint256 balanceAfter2 = IERC20(token).balanceOf(address(fxsLiquidityGauge));
		uint256 leftOver = IERC20(token).balanceOf(address(sdtDistributor));

		assertEq(lastPull1 / 2, balanceAfter1 - balanceBefore1, "ERROR_030");
		assertEq((lastPull1 + lastPull2) / 2, balanceAfter2 - balanceBefore2, "ERROR_031");
		assertEq(lastPull2 / 2, leftOver, "ERROR_032");
	}

	function test04NoDistributeToGaugeWith0Weight() public {
		vm.startPrank(LOCAL_DEPLOYER);
		sdtDistributor.approveGauge(address(angleLiquidityGauge));
		timeJump(Constants.DAY * 8);

		uint256 balanceBefore1 = IERC20(token).balanceOf(address(angleLiquidityGauge));
		sdtDistributor.distribute(address(angleLiquidityGauge));
		uint256 balanceAfter1 = IERC20(token).balanceOf(address(angleLiquidityGauge));

		uint256 weight = gaugeController.gauge_relative_weight(address(angleLiquidityGauge));

		assertEq(weight, 0, "ERROR_040");
		assertEq(balanceAfter1 - balanceBefore1, 0, "ERROR_041");
	}

	function test05DistributeToMultipleGauges() public {
		// vote
		vm.startPrank(ALICE);
		gaugeController.vote_for_gauge_weights(address(angleLiquidityGauge), PERCENTAGE / 2);
		gaugeController.vote_for_gauge_weights(address(fxsLiquidityGauge), PERCENTAGE / 2);
		vm.stopPrank();

		vm.startPrank(LOCAL_DEPLOYER);
		sdtDistributor.approveGauge(address(angleLiquidityGauge));
		sdtDistributor.approveGauge(address(fxsLiquidityGauge));
		vm.stopPrank();

		uint256 balanceBefore1 = IERC20(token).balanceOf(address(angleLiquidityGauge));
		uint256 balanceBefore2 = IERC20(token).balanceOf(address(fxsLiquidityGauge));

		timeJump(Constants.DAY * 8);

		address[] memory list = new address[](2);
		list[0] = address(angleLiquidityGauge);
		list[1] = address(fxsLiquidityGauge);
		sdtDistributor.distributeMulti(list);
		uint256 timestamp = block.timestamp - (block.timestamp % 86_400);
		uint256 lastPull1 = sdtDistributor.pulls(timestamp);
		uint256 balanceAfter1 = IERC20(token).balanceOf(address(angleLiquidityGauge));
		uint256 balanceAfter2 = IERC20(token).balanceOf(address(fxsLiquidityGauge));

		assertEq(lastPull1 / 2, balanceAfter1 - balanceBefore1, "ERROR_050");
		assertEq(lastPull1 / 2, balanceAfter2 - balanceBefore2, "ERROR_051");
	}
}
