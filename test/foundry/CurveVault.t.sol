// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

// Base Tests
import "./baseTest/Base.t.sol";

import "../../contracts/strategies/curve/CurveStrategy.sol";
import "../../contracts/strategies/curve/CurveVault.sol";
import "../../contracts/accumulators/VeSdtFeeCurveProxy.sol";
import "../../contracts/factories/CurveVaultFactory.sol";
import "../../contracts/accumulators/CurveAccumulator.sol";
import "../../contracts/sdtDistributor/SdtDistributorV2.sol";
import "../../contracts/strategies/angle/AngleVault.sol";

import "../../contracts/interfaces/ILiquidityGaugeStrat.sol";
import "../../contracts/interfaces/IGaugeController.sol";
import "contracts/interfaces/ISmartWalletChecker.sol";

contract CurveVaultTest is BaseTest {
	address public constant LOCAL_DEPLOYER = address(0xDE);
	address public constant ALICE = address(0xAA);
	address public constant BOB = address(0xB0B);
	address public constant CHARLIE = address(0xCC);
	address public constant ACCUMULATOR = 0xa44bFD194Fd7185ebecEcE4F7fA87a47DaA01c6A;
	address public constant CRV_LOCKER = 0x52f541764E6e90eeBc5c21Ff570De0e2D63766B6;
	address public constant LGV4_STRAT_IMPL = 0x3Dc56D46F0Bd13655EfB29594a2e44534c453BF9;
	address public constant GAUGE_CONTROLLER = 0x3F3F0776D411eb97Cfa4E3eb25F33c01ca4e7Ca8;
	address public constant SDT_DISTRIBUTOR = 0x9C99dffC1De1AfF7E7C1F36fCdD49063A281e18C;
	address public constant SDT_DISTRIBUTOR_OWNER = 0x0dE5199779b43E13B3Bec21e91117E18736BC1A8;
	address public constant SD_CRV_GAUGE = 0x7f50786A0b15723D741727882ee99a0BF34e3466;

	uint256 public constant AMOUNT = 1_000e18;

	veSDTFeeCurveProxy public feeProxy;
	CurveStrategy public strategy;
	CurveAccumulator public accumulator;
	CurveVaultFactory public factory;
	CurveVault public vault3CRV;
	CurveVault public vaultSDTETH;
	SdtDistributorV2 public distributor;

	IERC20 public crv3 = IERC20(Constants.CRV3);
	IERC20 public crv = IERC20(Constants.CRV);
	IERC20 public sdt = IERC20(Constants.SDT);
	IERC20 public sdfrax3crv = IERC20(Constants.SDFRAX3CRV);
	IGaugeController public gc;
	ILiquidityGauge public lg3CRV; // This one is from curve
	ILiquidityGauge public lgSDTETH; // This one is from curve
	ILiquidityGaugeStrat public gauge3CRV; // This one is deployed by Stake DAO
	ILiquidityGaugeStrat public gaugeSDTETH; // This one is deployed by Stake DAO

	function setUp() public {
		address[] memory path = new address[](4);
		path[0] = Constants.CRV;
		path[1] = Constants.WETH;
		path[2] = Constants.SUSHI;
		path[3] = Constants.FRAX;

		accumulator = CurveAccumulator(ACCUMULATOR);
		gc = IGaugeController(GAUGE_CONTROLLER);
		distributor = SdtDistributorV2(SDT_DISTRIBUTOR);

		vm.startPrank(LOCAL_DEPLOYER);
		feeProxy = new veSDTFeeCurveProxy(path);
		strategy = new CurveStrategy(
			ILocker(CRV_LOCKER),
			LOCAL_DEPLOYER,
			LOCAL_DEPLOYER,
			accumulator,
			address(feeProxy),
			Constants.SDT_DISTRIBUTOR_STRAT
		);
		factory = new CurveVaultFactory(LGV4_STRAT_IMPL, address(strategy), Constants.SDT_DISTRIBUTOR_STRAT);
		vm.stopPrank();

		vm.prank(ILocker(CRV_LOCKER).governance());
		ILocker(CRV_LOCKER).setGovernance(address(strategy));

		vm.startPrank(LOCAL_DEPLOYER);

		// Deploy vault for gauge : 3CRV
		strategy.setVaultGaugeFactory(address(factory));
		vm.recordLogs();
		factory.cloneAndInit(Constants.CRV_GAUGE_3CRV);
		Vm.Log[] memory logs = vm.getRecordedLogs();
		bytes memory eventData1 = logs[0].data;
		bytes memory eventData3 = logs[2].data;
		vault3CRV = CurveVault(bytesToAddressCustom(eventData1, 32));
		gauge3CRV = ILiquidityGaugeStrat(bytesToAddressCustom(eventData3, 32));
		lg3CRV = ILiquidityGauge(Constants.CRV_GAUGE_3CRV);

		// Deploy vault for gauge : SDT/ETH;
		strategy.setVaultGaugeFactory(address(factory));
		vm.recordLogs();
		factory.cloneAndInit(Constants.CRV_GAUGE_SDT_ETH);
		logs = vm.getRecordedLogs();
		eventData1 = logs[0].data;
		eventData3 = logs[2].data;
		vaultSDTETH = CurveVault(bytesToAddressCustom(eventData1, 32));
		gaugeSDTETH = ILiquidityGaugeStrat(bytesToAddressCustom(eventData3, 32));
		lgSDTETH = ILiquidityGauge(Constants.CRV_GAUGE_SDT_ETH);
		vm.stopPrank();

		vm.prank(gc.admin());
		gc.commit_transfer_ownership(LOCAL_DEPLOYER);

		vm.startPrank(LOCAL_DEPLOYER);
		gc.accept_transfer_ownership();
		gc.add_gauge(address(gauge3CRV), 0, 0);
		gc.add_gauge(address(gaugeSDTETH), 0, 0);
		vm.stopPrank();

		deal(Constants.SDT, ALICE, AMOUNT);
		deal(Constants.SDT, LOCAL_DEPLOYER, AMOUNT);
		deal(Constants.CRV3, ALICE, AMOUNT * 10);
		deal(Constants.CRV3, BOB, AMOUNT);
		deal(Constants.EUR3, ALICE, AMOUNT);
		deal(Constants.STECRV, ALICE, AMOUNT);
		deal(Constants.CRV3, Constants.CURVE_FEE_DISTRIBUTOR, AMOUNT);

		vm.prank(IVeToken(Constants.VE_SDT).admin());
		ISmartWalletChecker(Constants.SDT_SMART_WALLET_CHECKER).approveWallet(ALICE);
		lockSDTCustom(ALICE, Constants.SDT, Constants.VE_SDT, AMOUNT, block.timestamp + Constants.YEAR);
		vm.prank(IVeToken(Constants.VE_SDT).admin());
		ISmartWalletChecker(Constants.SDT_SMART_WALLET_CHECKER).approveWallet(LOCAL_DEPLOYER);
		lockSDTCustom(LOCAL_DEPLOYER, Constants.SDT, Constants.VE_SDT, AMOUNT, block.timestamp + (4 * Constants.YEAR));
	}

	function testVaultAndLGSettings() public {
		assertEq(gauge3CRV.name(), "Stake DAO 3Crv Gauge");
		assertEq(gauge3CRV.symbol(), "sd3Crv-gauge");
		assertEq(vault3CRV.name(), "sd3Crv Vault");
		assertEq(vault3CRV.symbol(), "sd3Crv-vault");
		assertEq(address(vault3CRV.token()), Constants.CRV3);
		assertEq(address(vault3CRV.curveStrategy()), address(strategy));
		assertEq(gaugeSDTETH.name(), "Stake DAO SDTETH-f Gauge");
		assertEq(gaugeSDTETH.symbol(), "sdSDTETH-f-gauge");
		assertEq(vaultSDTETH.name(), "sdSDTETH-f Vault");
		assertEq(vaultSDTETH.symbol(), "sdSDTETH-f-vault");
		assertEq(address(vaultSDTETH.token()), Constants.CRV_POOL_SDT_ETH);
		assertEq(address(vaultSDTETH.curveStrategy()), address(strategy));
	}

	function testDeposit3CRVToVault() public {
		uint256 keeperFee = vault3CRV.keeperFee();
		uint256 maxFee = vault3CRV.MAX();

		// deposit to vault without earn
		vm.startPrank(ALICE);
		crv3.approve(address(vault3CRV), type(uint256).max);
		vault3CRV.deposit(ALICE, AMOUNT, false);
		vm.stopPrank();
		uint256 amountForKeep = (AMOUNT * keeperFee) / maxFee;
		assertEq(crv3.balanceOf(address(vault3CRV)), AMOUNT);
		assertEq(gauge3CRV.balanceOf(ALICE), AMOUNT - amountForKeep);

		// deposit to vault with earn
		vm.startPrank(BOB);
		crv3.approve(address(vault3CRV), AMOUNT);
		vault3CRV.deposit(BOB, AMOUNT, true);
		vm.stopPrank();
		assertEq(crv3.balanceOf(address(vault3CRV)), 0);
		assertEq(gauge3CRV.balanceOf(BOB), AMOUNT + amountForKeep);

		// deposit to vault for another user
		vm.startPrank(ALICE);
		vault3CRV.deposit(BOB, AMOUNT, true);
		assertEq(crv3.balanceOf(address(vault3CRV)), 0);
		vault3CRV.deposit(CHARLIE, AMOUNT, false);
		assertEq(crv3.balanceOf(address(vault3CRV)), AMOUNT);
		vm.stopPrank();
	}

	function testClaimCRVRewardWithoutSDT() public {
		vm.startPrank(ALICE);
		crv3.approve(address(vault3CRV), type(uint256).max);
		vault3CRV.deposit(ALICE, AMOUNT, true);
		vm.stopPrank();

		timeJump(1 days);

		uint256 balanceBeforeCRV = crv.balanceOf(address(gauge3CRV));
		uint256 balanceBeforeSDT = sdt.balanceOf(address(gauge3CRV));
		strategy.claim(address(crv3));
		uint256 balanceAfterCRV = crv.balanceOf(address(gauge3CRV));
		uint256 balanceAfterSDT = sdt.balanceOf(address(gauge3CRV));
		assertGt(balanceAfterCRV, balanceBeforeCRV);
		assertEq(balanceAfterSDT, balanceBeforeSDT);
	}

	function testWithdrawAnfBurnGaugeToken() public {
		vm.startPrank(ALICE);
		crv3.approve(address(vault3CRV), type(uint256).max);
		vault3CRV.deposit(ALICE, AMOUNT, false);
		vm.stopPrank();

		uint256 balanceBeforeCRV3 = crv3.balanceOf(address(vault3CRV));
		uint256 balanceBeforeGaugeToken = gauge3CRV.balanceOf(ALICE);
		vm.prank(ALICE);
		vault3CRV.withdraw(AMOUNT / 2);
		uint256 balanceAfterCRV3 = crv3.balanceOf(address(vault3CRV));
		uint256 balanceAfterGaugeToken = gauge3CRV.balanceOf(ALICE);
		assertEq(balanceBeforeCRV3, AMOUNT, "ERROR_0");
		assertEq(balanceAfterCRV3, balanceBeforeCRV3 - (AMOUNT / 2), "ERROR_1");
		assertEq(balanceAfterGaugeToken, balanceBeforeGaugeToken - (AMOUNT / 2), "ERROR_2");

		vm.startPrank(BOB);
		crv3.approve(address(vault3CRV), type(uint256).max);
		vault3CRV.deposit(BOB, AMOUNT, false);
		vm.stopPrank();
		balanceBeforeCRV3 = crv3.balanceOf(address(vault3CRV));
		balanceBeforeGaugeToken = gauge3CRV.balanceOf(BOB);
		vm.prank(BOB);
		vault3CRV.withdraw(999e18);
		balanceAfterCRV3 = crv3.balanceOf(address(vault3CRV));
		balanceAfterGaugeToken = gauge3CRV.balanceOf(BOB);
		assertApproxEqRel(balanceAfterCRV3 + (AMOUNT), balanceBeforeCRV3, 1e16, "ERROR_1");
		assertApproxEqRel(balanceAfterGaugeToken + (AMOUNT), balanceBeforeGaugeToken, 1e16, "ERROR_2");
	}

	function testWithdrawRevertBecauseNotEnoughToken() public {
		vm.startPrank(ALICE);
		crv3.approve(address(vault3CRV), type(uint256).max);
		vault3CRV.deposit(ALICE, AMOUNT, false);
		vm.expectRevert(bytes("Not enough staked"));
		vault3CRV.withdraw(AMOUNT + 1);
		vm.stopPrank();
	}

	function testClaimRewardWithSDT() public {
		vm.startPrank(ALICE);
		crv3.approve(address(vault3CRV), type(uint256).max);
		vault3CRV.deposit(ALICE, AMOUNT, false);
		vm.stopPrank();

		vm.prank(LOCAL_DEPLOYER);
		gc.vote_for_gauge_weights(address(gauge3CRV), 1000);
		vm.prank(SDT_DISTRIBUTOR_OWNER);
		distributor.approveGauge(address(gauge3CRV));

		timeJump(8 days);

		uint256 balanceBeforeCRV = crv.balanceOf(address(gauge3CRV));
		uint256 balanceBeforeSDT = sdt.balanceOf(address(gauge3CRV));
		strategy.claim(address(crv3));
		uint256 balanceAfterCRV = crv.balanceOf(address(gauge3CRV));
		uint256 balanceAfterSDT = sdt.balanceOf(address(gauge3CRV));

		assertGt(balanceAfterCRV, balanceBeforeCRV, "ERROR_1");
		assertGt(balanceAfterSDT, balanceBeforeSDT, "ERROR_2");
	}

	function testClaimCRVFromGauge() public {
		vm.startPrank(ALICE);
		crv3.approve(address(vault3CRV), type(uint256).max);
		vault3CRV.deposit(ALICE, AMOUNT, true);
		vm.stopPrank();

		strategy.claim(address(crv3));
		timeJump(8 days);

		uint256 balanceBeforeCRV = crv.balanceOf(address(ALICE));
		uint256 balanceBeforeSDT = sdt.balanceOf(address(ALICE));
		gauge3CRV.claim_rewards(ALICE);
		uint256 balanceAfterCRV = crv.balanceOf(address(ALICE));
		uint256 balanceAfterSDT = sdt.balanceOf(address(ALICE));

		assertGt(balanceAfterCRV, balanceBeforeCRV);
		assertEq(balanceAfterSDT, balanceBeforeSDT);
	}

	function testWithdrawFromVaultRevert() public {
		vm.expectRevert();
		gauge3CRV.withdraw(100, ALICE, true);
	}

	function testApproveVaultRevert() public {
		vm.expectRevert(bytes("!governance && !factory"));
		strategy.toggleVault(address(vault3CRV));
	}

	function testAddGaugeRevert() public {
		vm.expectRevert();
		strategy.setGauge(Constants.CRV3, Constants.CRV_GAUGE_3CRV);
	}

	function testCallEarn() public {
		vm.startPrank(ALICE);
		crv3.approve(address(vault3CRV), type(uint256).max);
		vault3CRV.deposit(ALICE, AMOUNT, false);
		vm.stopPrank();

		uint256 crv3GaugeStakedBefore = lg3CRV.balanceOf(CRV_LOCKER);
		uint256 accumulatedFees = vault3CRV.accumulatedFee();
		uint256 balanceBefore = gauge3CRV.balanceOf(BOB);
		vm.prank(BOB);
		vault3CRV.deposit(BOB, 0, true);
		uint256 balanceAfter = gauge3CRV.balanceOf(BOB);
		uint256 crv3GaugeStakedAfter = lg3CRV.balanceOf(CRV_LOCKER);

		assertGt(accumulatedFees, 0);
		assertEq(balanceAfter, balanceBefore + accumulatedFees);
		assertApproxEqRel(crv3GaugeStakedAfter, crv3GaugeStakedBefore + accumulatedFees, 1e16);
	}

	function testPayWithdrawFee() public {
		vm.startPrank(ALICE);
		crv3.approve(address(vault3CRV), type(uint256).max);
		vault3CRV.deposit(ALICE, AMOUNT, false);

		uint256 balanceBefore = crv3.balanceOf(ALICE);
		uint256 balanceBeforeGauge = gauge3CRV.balanceOf(ALICE);
		vault3CRV.withdraw(10e18);
		uint256 balanceAfter = crv3.balanceOf(ALICE);
		uint256 balanceAfterGauge = gauge3CRV.balanceOf(ALICE);
		vm.stopPrank();

		assertEq(balanceAfter, balanceBefore + 10e18, "ERROR_1");
		assertEq(balanceAfterGauge, balanceBeforeGauge - 10e18, "ERROR_2");
	}

	function testGetMaxBoost() public {
		uint256 workingBalance = lg3CRV.working_balances(CRV_LOCKER);
		uint256 stakedAmount = lg3CRV.balanceOf(CRV_LOCKER);
		uint256 boost = (workingBalance * (1e18)) / ((stakedAmount * 4) / 10);
		assertEq(boost, 25e17);
	}

	function testSwapCRVAndTransferToFeeDistributor() public {
		deal(Constants.CRV, address(feeProxy), 10000e18);
		uint256 balanceBeforeSDFRAX3CRV = sdfrax3crv.balanceOf(Constants.FEE_D_SD);
		uint256 balanceBeforeCRV = crv.balanceOf(address(feeProxy));
		assertEq(balanceBeforeCRV, 10000e18);

		feeProxy.sendRewards();

		uint256 balanceAfterSDFRAX3CRV = sdfrax3crv.balanceOf(Constants.FEE_D_SD);
		uint256 balanceAfterCRV = crv.balanceOf(address(feeProxy));

		assertEq(balanceAfterCRV, 0);
		assertGt(balanceAfterSDFRAX3CRV, balanceBeforeSDFRAX3CRV);
	}

	function testSendAccumulatedCRVRewardtosdCRVLGFromAccu() public {
		uint256 balanceBefore = crv.balanceOf(SD_CRV_GAUGE);

		//vm.prank(ILiquidityGauge(SD_CRV_GAUGE).admin());
		//ILiquidityGauge(SD_CRV_GAUGE).add_reward(Constants.CRV, address(accumulator));
		vm.prank(accumulator.governance());
		accumulator.notifyAllExtraReward(Constants.CRV);

		uint256 balanceAfter = crv.balanceOf(SD_CRV_GAUGE);
		assertGt(balanceAfter, balanceBefore);
		assertEq(crv.balanceOf(address(accumulator)), 0);
	}

	function testCreatNewVaultAndGauge() public {
		vm.startPrank(LOCAL_DEPLOYER);
		vm.recordLogs();
		factory.cloneAndInit(Constants.CRV_GAUGE_EUR3);
		Vm.Log[] memory logs = vm.getRecordedLogs();
		bytes memory eventData1 = logs[0].data;
		bytes memory eventData3 = logs[2].data;
		AngleVault vault3EUR = AngleVault(bytesToAddressCustom(eventData1, 32));
		ILiquidityGaugeStrat gauge3EUR = ILiquidityGaugeStrat(bytesToAddressCustom(eventData3, 32));
		address tokenOfVault = address(vault3EUR.token());
		gc.add_gauge(address(gauge3EUR), 0, 0);

		assertEq(tokenOfVault, address(Constants.EUR3));
	}

	function testSetBackLockersGov() public {
		bytes memory callData = abi.encodeWithSignature("setGovernance(address)", ALICE);
		vm.prank(LOCAL_DEPLOYER);
		strategy.execute(CRV_LOCKER, 0, callData);
		assertEq(ILocker(CRV_LOCKER).governance(), ALICE);
	}
}
