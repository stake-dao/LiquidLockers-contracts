// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

import "forge-std/Test.sol";

import "../fixtures/Constants.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "contracts/interfaces/IVeToken.sol";
import "contracts/interfaces/IGaugeController.sol";
import "contracts/interfaces/IBaseLocker.sol";
import "contracts/interfaces/IBaseDepositor.sol";

contract BaseTest is Test {
	////////////////////////////////////////////////////////////////
	/// --- LOCKER
	///////////////////////////////////////////////////////////////

	function createLock(
		address caller,
		address locker,
		address token,
		address veToken,
		uint256 initialAmountToLock,
		uint256 initialPeriodToLock,
		bytes memory callData
	) internal {
		deal(token, locker, initialAmountToLock);
		vm.startPrank(caller);
		(bool success, ) = locker.call(callData);
		require(success, "low-level call failed");
		vm.stopPrank();

		IVeToken.LockedBalance memory lockedBalance = IVeToken(veToken).locked(locker);

		assertEq(lockedBalance.amount, int256(initialAmountToLock));
		assertEq(lockedBalance.end, ((block.timestamp + initialPeriodToLock) / Constants.WEEK) * Constants.WEEK);
		assertApproxEqRel(IVeToken(veToken).balanceOf(locker), initialAmountToLock, 1e16); // 1% Margin of Error
	}

	function increaseAmount(
		address caller,
		address locker,
		address token,
		address veToken,
		uint256 initialAmountToLock,
		uint256 extraAmountToLock,
		bytes memory callData
	) internal {
		deal(token, address(locker), extraAmountToLock);
		vm.startPrank(caller);
		(bool success, ) = locker.call(callData);
		require(success, "low-level call failed");
		vm.stopPrank();

		IVeToken.LockedBalance memory lockedBalance = IVeToken(veToken).locked(locker);

		assertEq(lockedBalance.amount, int256(initialAmountToLock + extraAmountToLock));
	}

	function increaseLock(
		address caller,
		address locker,
		address veToken,
		uint256 endPeriodLock,
		bytes memory callData
	) internal {
		vm.startPrank(caller);
		(bool success, ) = locker.call(callData);
		require(success, "low-level call failed");
		vm.stopPrank();

		IVeToken.LockedBalance memory lockedBalance = IVeToken(veToken).locked(address(locker));
		assertEq(lockedBalance.end, (endPeriodLock / Constants.WEEK) * Constants.WEEK);
	}

	function release(
		address caller,
		address locker,
		address token,
		address receiver,
		uint256 initialAmountToWithdraw,
		bytes memory callData
	) internal {
		vm.startPrank(caller);
		(bool success, ) = locker.call(callData);
		require(success, "low-level call failed");
		vm.stopPrank();

		assertEq(IERC20(token).balanceOf(receiver), initialAmountToWithdraw);
	}

	function claimReward(
		address caller,
		address locker,
		address[] memory rewardsToken,
		uint256[] memory rewardsAmount,
		address rewardsDistributor,
		bytes[] memory callData
	) internal {
		uint256[] memory balancesBefore = new uint256[](rewardsToken.length);
		uint256[] memory balancesAfter = new uint256[](rewardsToken.length);

		// Check balances for rewards tokens before
		for (uint8 i = 0; i < rewardsToken.length; i++) {
			balancesBefore[i] = IERC20(rewardsToken[i]).balanceOf(address(this));
		}

		// Distribute rewards
		for (uint8 i = 0; i < rewardsToken.length; ++i) {
			uint256 balanceBefore = IERC20(rewardsToken[i]).balanceOf(address(this));
			deal(rewardsToken[i], address(this), rewardsAmount[i]);
			IERC20(rewardsToken[i]).transfer(rewardsDistributor, rewardsAmount[i]);
			require((balanceBefore - IERC20(rewardsToken[i]).balanceOf(address(this))) == 0, "!not empty");
		}
		timeJump(2 * Constants.WEEK);

		// Claim rewards
		vm.startPrank(caller);
		for (uint8 i = 0; i < rewardsToken.length; ++i) {
			(bool success, ) = locker.call(callData[i]);
			require(success, "low-level call failed");
		}
		vm.stopPrank();

		// Check rewards obtained
		for (uint8 i = 0; i < rewardsToken.length; i++) {
			balancesAfter[i] = IERC20(rewardsToken[i]).balanceOf(address(this));

			assertEq(balancesBefore[i], 0);
			assertGt(balancesAfter[i], balancesBefore[i]);
		}
	}

	function voteForGauge(
		address caller,
		address locker,
		address gaugeController,
		address gauge,
		bytes memory callData
	) internal {
		uint256 voteBefore = IGaugeController(gaugeController).last_user_vote(address(locker), gauge);
		vm.startPrank(caller);
		(bool success, ) = locker.call(callData);
		require(success, "low-level call failed");
		vm.stopPrank();
		uint256 voteAfter = IGaugeController(gaugeController).last_user_vote(address(locker), gauge);

		assertEq(voteBefore, 0);
		assertGt(voteAfter, voteBefore);
	}

	function execute(
		address caller,
		address locker,
		bytes memory callData
	) internal {
		vm.startPrank(caller);
		(bool success, ) = locker.call(callData);
		require(success, "low-level call failed");
		vm.stopPrank();

		assertEq(success, true);
	}

	// All addresses setters
	function setter(
		address caller,
		address locker,
		address newAddress,
		bytes memory callDataFun,
		bytes memory callDataVar
	) internal {
		vm.startPrank(caller);
		(bool success, bytes memory data) = locker.call(callDataFun);
		require(success, "low-level call failed");
		vm.stopPrank();

		(success, data) = locker.call(callDataVar);
		require(success, "low-level call failed");

		assertEq(keccak256(data), keccak256(abi.encode(newAddress)));
	}

	/*
	////////////////////////////////////////////////////////////////
	/// --- DEPOSITOR
	///////////////////////////////////////////////////////////////
	function lockToken() internal {
		createLock();
		timeJump(60 * 60 * 24 * 30 * 2);
		deal(token, locker, initialDepositAmount);
		IBaseDepositor(depositor).lockToken();
	}

	// Needed to reach 100% coverage
	function lock0Token() internal {
		createLock();
		timeJump(60 * 60 * 24 * 30);
		deal(token, locker, 0);
		IBaseDepositor(depositor).lockToken();
	}

	function depositNoLockNoIncentiveNoStakeNoGauge(address _user) internal {
		deal(token, _user, initialDepositAmount);
		vm.startPrank(_user);
		IERC20(token).approve(depositor, initialDepositAmount);
		IBaseDepositor(depositor).deposit(initialDepositAmount, false, false, _user);
	}*/

	function timeJump(uint256 _period) public returns (uint256, uint256) {
		skip(_period);
		vm.roll(block.number + _period / 12);
		return (block.timestamp, block.number);
	}
}
