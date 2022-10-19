// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

// Base Tests
import "./baseTest/Base.t.sol";

// Contract
import "contracts/lockers/AngleLocker.sol";

// Interface
import "contracts/interfaces/IVeANGLE.sol";
import "contracts/interfaces/ISmartWalletChecker.sol";
import "contracts/interfaces/IAngleGaugeController.sol";

contract AngleTest is BaseTest {
	address internal constant LOCAL_DEPLOYER = address(0xDE);

	AngleLocker internal angleLocker;

	function setUp() public {
		vm.prank(LOCAL_DEPLOYER);
		angleLocker = new AngleLocker(address(this));

		address[] memory rewardsToken = new address[](1);
		rewardsToken[0] = Constants.SAN_USDC_EUR;

		uint256[] memory rewardsAmount = new uint256[](1);
		rewardsAmount[0] = 1e18;

		initBase(
			// Token to lock address
			Constants.ANGLE,
			// veToken address
			Constants.VEANGLE,
			// Liquid Locker address
			address(angleLocker),
			// Depositor address
			address(0),
			// Wrapper address
			address(0),
			// rewards token list
			rewardsToken,
			// Fee/yield distributor address
			Constants.ANGLE_FEE_DITRIBUTOR,
			// Initial amount to lock
			1e18,
			// Initial period to lock
			125_798_400,
			// Initial user deposit amount
			1e18,
			// Extra amount to lock
			1e16,
			// Extra period to lock
			31_449_600,
			// Amount for each rewards
			rewardsAmount
		);

		vm.prank(ISmartWalletChecker(Constants.ANGLE_SMART_WALLET_CHECKER).admin());
		ISmartWalletChecker(Constants.ANGLE_SMART_WALLET_CHECKER).approveWallet(address(locker));
	}

	function testNothing() public {}

	function testLocker01createLock() public {
		createLock();

		IVeANGLE.LockedBalance memory lockedBalance = IVeANGLE(veToken).locked(address(locker));

		assertEq(lockedBalance.amount, int256(initialLockAmount));
		assertEq(lockedBalance.end, ((block.timestamp + initialLockTime) / Constants.WEEK) * Constants.WEEK);
		assertApproxEqRel(IVeANGLE(veToken).balanceOf(address(locker)), initialLockAmount, 1e16); // 1% Margin of Error
	}

	function testLocker02IncreaseLockAmount() public {
		increaseAmount();

		IVeANGLE.LockedBalance memory lockedBalance = IVeANGLE(veToken).locked(address(locker));
		assertApproxEqRel(lockedBalance.amount, int256(initialLockAmount + extraLockAmount), 0);
	}

	function testLocker03IncreaseLockDuration() public {
		increaseLock();

		IVeANGLE.LockedBalance memory lockedBalance = IVeANGLE(veToken).locked(address(locker));
		assertApproxEqRel(lockedBalance.end, ((block.timestamp + initialLockTime) / Constants.WEEK) * Constants.WEEK, 0);
	}

	function testLocker04Release() public {
		release();
		assertEq(IERC20(token).balanceOf(address(this)), initialLockAmount);
	}

	function testLocker05ClaimReward() public {
		uint256 balanceBefore = IERC20(Constants.SAN_USDC_EUR).balanceOf(address(this));

		claimReward();

		assertEq(balanceBefore, 0);
		assertGt(IERC20(Constants.SAN_USDC_EUR).balanceOf(address(this)), balanceBefore);
	}

	function testLocker06Execute() public {
		bool success = execute();

		assertEq(success, true);
	}

	function testLocker07Setters() public {
		setters();

		assertEq(IBaseLocker(locker).accumulator(), address(0xA));
		assertEq(IBaseLocker(locker).governance(), address(0xA));
	}

	function testLocker08Extra01Setters() public {
		vm.startPrank(IBaseLocker(locker).governance());
		angleLocker.setAngleDepositor(address(0xA));
		angleLocker.setFeeDistributor(address(0xA));
		angleLocker.setGaugeController(address(0xA));
		vm.stopPrank();

		assertEq(angleLocker.angleDepositor(), address(0xA));
		assertEq(angleLocker.feeDistributor(), address(0xA));
		assertEq(angleLocker.gaugeController(), address(0xA));
	}

	function testLocker09Extra02VoteGauge() public {
		createLock();
		address gauge = IAngleGaugeController(Constants.ANGLE_GAUGE_CONTROLLER).gauges(0);
		uint256 voteBefore = IAngleGaugeController(Constants.ANGLE_GAUGE_CONTROLLER).last_user_vote(address(locker), gauge);
		vm.startPrank(IBaseLocker(locker).governance());
		angleLocker.voteGaugeWeight(gauge, 10000);
		uint256 voteAfter = IAngleGaugeController(Constants.ANGLE_GAUGE_CONTROLLER).last_user_vote(address(locker), gauge);

		assertEq(voteBefore, 0);
		assertGt(voteAfter, voteBefore);
	}
}
