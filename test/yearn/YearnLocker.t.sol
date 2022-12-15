// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Vm.sol";
import "forge-std/Test.sol";
import "forge-std/console.sol";

import { YearnLocker } from "contracts/lockers/YearnLocker.sol";
import { IVeYFI } from "contracts/interfaces/IVeYFI.sol";
import { Constants } from "test/fixtures/Constants.sol";
import { IRewardPool } from "contracts/interfaces/IRewardPool.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract YearnLockerTest is Test {
    ////////////////////////////////////////////////////////////////
    /// --- TEST STORAGE
    ///////////////////////////////////////////////////////////////

	IERC20 internal YFI;
	IVeYFI internal veYFI;
	YearnLocker internal yearnLocker;
	IRewardPool internal rewardPool;

	function setUp() public virtual {
		uint256 forkId = vm.createFork(vm.rpcUrl("mainnet"));
		vm.selectFork(forkId);

		YFI = IERC20(Constants.YFI);
		veYFI = IVeYFI(Constants.VE_YFI);
		rewardPool = IRewardPool(Constants.YFI_REWARD_POOL);

		// Deploy and Intialize the YearnLocker contract
		yearnLocker = new YearnLocker(address(this), address(this), Constants.VE_YFI, Constants.YFI_REWARD_POOL);
		yearnLocker.approveUnderlying();

		// Mint YFI to the YearnLocker contract
		deal(address(YFI), address(yearnLocker), 100e18);
	}

	function testCreateLock() public {
		yearnLocker.createLock(100e18, block.timestamp + 4 * Constants.YEAR);
		assertApproxEqRel(veYFI.balanceOf(address(yearnLocker)), 100e18, 1e16); // 1% Margin of Error
	}

	function testIncreaseLockAmount() public {
		yearnLocker.createLock(100e18, block.timestamp + Constants.YEAR);

		IVeYFI.LockedBalance memory lockedBalance = veYFI.locked(address(yearnLocker));
		assertEq(lockedBalance.amount, 100e18);

		deal(address(YFI), address(yearnLocker), 100e18);
		yearnLocker.increaseAmount(100e18);

		lockedBalance = veYFI.locked(address(yearnLocker));
		assertEq(lockedBalance.amount, 200e18);
	}

	function testIncreaseLockDuration() public {
		uint256 initialUnlockTime = block.timestamp + Constants.YEAR;
		uint256 newUnlockTime = block.timestamp + 2 * Constants.YEAR;

		yearnLocker.createLock(100e18, initialUnlockTime);
		IVeYFI.LockedBalance memory lockedBalance = veYFI.locked(address(yearnLocker));

		// Assert that the Locked End Timestamp is equal to the initialUnlockTime rounded down to week.
		assertEq(lockedBalance.end, (initialUnlockTime / Constants.WEEK) * Constants.WEEK);
	
		yearnLocker.increaseUnlockTime(newUnlockTime);

		lockedBalance = veYFI.locked(address(yearnLocker));

		// Assert that the new Locked End Timestamp is equal to the newUnlockTime rounded down to week.
		assertEq(lockedBalance.end, (newUnlockTime / Constants.WEEK) * Constants.WEEK);
	}

	function testWithdrawWithPenalty() public {
		uint256 balanceBefore = YFI.balanceOf(address(this));

		yearnLocker.createLock(100e18, block.timestamp + Constants.YEAR);
		yearnLocker.release(address(this));

		uint256 balanceAfter = YFI.balanceOf(address(this));

		assertEq(balanceBefore, 0);
		assertApproxEqRel(balanceAfter, 75e18, 1e16); // 25% penalty
	}

	function testClaimRewards() public {
		uint256 balanceBefore = YFI.balanceOf(address(this));
		deal(address(YFI), address(yearnLocker), 200e18);
		yearnLocker.createLock(200e18, block.timestamp + Constants.YEAR);

		vm.warp(block.timestamp + 2 * Constants.WEEK); //extend 2weeks

		// Fill the Reward Pool with YFI.
		deal(address(YFI), address(rewardPool), 200e18);
		rewardPool.checkpoint_token();

		vm.warp(block.timestamp + 10 * Constants.DAY); //extend 10 days

		yearnLocker.claimRewards(address(YFI), address(this));
		uint256 balanceAfterClaim = YFI.balanceOf(address(this));

		assertEq(balanceBefore, 0);
		assertGt(balanceAfterClaim, balanceBefore);
	}
}
