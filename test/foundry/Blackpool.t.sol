// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

// Base Tests
import "./baseTest/BaseLocker.t.sol";

// Contracts
import "contracts/lockers/BlackpoolLocker.sol";

// Interface
import "contracts/interfaces/IVeBPT.sol";
import "contracts/interfaces/ISmartWalletChecker.sol";

contract BlackpoolTest is BaseLockerTest {
	address internal constant LOCAL_DEPLOYER = address(0xDE);

	BlackpoolLocker internal blackpoolLocker;

	function setUp() public {
		vm.prank(LOCAL_DEPLOYER);
		blackpoolLocker = new BlackpoolLocker(address(this));

		address[] memory rewardsToken = new address[](1);
		rewardsToken[0] = Constants.WETH;

		uint256[] memory rewardsAmount = new uint256[](1);
		rewardsAmount[0] = 1e18;

		initBaseLocker(
			// Token to lock address
			Constants.BPT,
			// veToken address
			Constants.VEBPT,
			// Liquid Locker address
			address(blackpoolLocker),
			// rewards token list
			rewardsToken,
			// Fee/yield distributor address
			Constants.BPT_FEE_DISTRIBUTOR,
			// Initial amount to lock
			1e18,
			// Initial period to lock
			125_798_400,
			// Extra amount to lock
			1e16,
			// Extra period to lock
			31_449_600,
			// Amount for each rewards
			rewardsAmount
		);

		vm.prank(Constants.BPT_DAO);
		ISmartWalletChecker(Constants.BPT_SMART_WALLET_CHECKER).approveWallet(address(locker));
	}

	function testLocker01createLock() public {
		createLock();

		IVeBPT.LockedBalance memory lockedBalance = IVeBPT(veToken).locked(address(locker));

		assertEq(lockedBalance.amount, int256(initialLockAmount));
		assertEq(lockedBalance.end, ((block.timestamp + initialLockTime) / Constants.WEEK) * Constants.WEEK);
		assertApproxEqRel(IVeBPT(veToken).balanceOf(address(locker)), initialLockAmount, 1e16); // 1% Margin of Error
	}

	function testLocker02IncreaseLockAmount() public {
		increaseAmount();

		IVeBPT.LockedBalance memory lockedBalance = IVeBPT(veToken).locked(address(locker));
		assertApproxEqRel(lockedBalance.amount, int256(initialLockAmount + extraLockAmount), 0);
	}

	function testLocker03IncreaseLockDuration() public {
		increaseLock();

		IVeBPT.LockedBalance memory lockedBalance = IVeBPT(veToken).locked(address(locker));
		assertApproxEqRel(lockedBalance.end, ((block.timestamp + initialLockTime) / Constants.WEEK) * Constants.WEEK, 0);
	}

	function testLocker04Release() public {
		release();
		assertEq(IERC20(token).balanceOf(address(this)), initialLockAmount);
	}

	function testLocker05ClaimReward() public {
		uint256 balanceBefore = IERC20(Constants.WETH).balanceOf(address(this));

		claimReward();

		assertEq(balanceBefore, 0);
		assertGt(IERC20(Constants.WETH).balanceOf(address(this)), balanceBefore);
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

	function testLocker08Extra01() public {
		vm.startPrank(IBaseLocker(locker).governance());
		blackpoolLocker.setBptDepositor(address(0xA));
		blackpoolLocker.setFeeDistributor(address(0xA));
		vm.stopPrank();

		assertEq(blackpoolLocker.bptDepositor(), address(0xA));
		assertEq(blackpoolLocker.feeDistributor(), address(0xA));
	}
}
