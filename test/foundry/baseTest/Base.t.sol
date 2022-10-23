// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

import "forge-std/Test.sol";

import "../fixtures/Constants.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "contracts/interfaces/IVeToken.sol";
import "contracts/interfaces/ILiquidityGauge.sol";
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
		address targetCall,
		address targetCheck,
		address newValue,
		bytes memory callDataFun,
		bytes memory callDataVar
	) internal {
		_setter(caller, targetCall, targetCheck, abi.encode(newValue), callDataFun, callDataVar);
	}

	// All bool setters
	function setter(
		address caller,
		address targetCall,
		address targetCheck,
		bool newValue,
		bytes memory callDataFun,
		bytes memory callDataVar
	) internal {
		_setter(caller, targetCall, targetCheck, abi.encode(newValue), callDataFun, callDataVar);
	}

	// All uint setters
	function setter(
		address caller,
		address targetCall,
		address targetCheck,
		uint256 newValue,
		bytes memory callDataFun,
		bytes memory callDataVar
	) internal {
		_setter(caller, targetCall, targetCheck, abi.encode(newValue), callDataFun, callDataVar);
	}

	function _setter(
		address caller,
		address targetCall,
		address targetCheck,
		bytes memory newValue,
		bytes memory callDataFun,
		bytes memory callDataVar
	) internal {
		vm.startPrank(caller);
		(bool success, bytes memory data) = targetCall.call(callDataFun);
		require(success, "low-level call failed");
		vm.stopPrank();

		(success, data) = targetCheck.call(callDataVar);
		require(success, "low-level call failed");

		assertEq(keccak256(data), keccak256(newValue));
	}

	////////////////////////////////////////////////////////////////
	/// --- DEPOSITOR
	///////////////////////////////////////////////////////////////
	function lockToken(
		address caller,
		address locker,
		address depositor,
		address token,
		address veToken,
		address sdToken,
		uint256 amountToLock,
		uint256 incentiveAmount,
		uint256 waitBeforeLock,
		bytes memory callData
	) internal {
		timeJump(waitBeforeLock);
		IVeToken.LockedBalance memory lockedBalanceBefore = IVeToken(veToken).locked(locker);

		// Force incentive token amount
		vm.store(depositor, bytes32(uint256(4)), bytes32(incentiveAmount));
		require(IBaseDepositor(depositor).incentiveToken() == incentiveAmount, "Force to incentive failed");

		vm.startPrank(caller);
		(bool success, ) = depositor.call(callData);
		require(success, "low-level call failed");
		vm.stopPrank();

		IVeToken.LockedBalance memory lockedBalanceAfter = IVeToken(veToken).locked(locker);

		assertEq(IERC20(token).balanceOf(locker), 0);
		assertEq(IERC20(token).balanceOf(depositor), 0);
		assertEq(lockedBalanceAfter.amount, lockedBalanceBefore.amount + int256(amountToLock));
		assertEq(IERC20(sdToken).balanceOf(caller), incentiveAmount);
		if (amountToLock != 0) {
			assertEq(lockedBalanceAfter.end, lockedBalanceBefore.end + ((waitBeforeLock / Constants.WEEK) * Constants.WEEK));
		}
	}

	function deposit(
		address caller,
		address depositor,
		address token,
		address sdToken,
		address user,
		uint256 amountToDeposit,
		uint256 incentiveAmount,
		uint256 waitBeforeLock,
		bool lock,
		bool stake,
		bytes memory callData
	) internal {
		timeJump(waitBeforeLock);
		deal(token, user, amountToDeposit);
		vm.prank(user);
		IERC20(token).approve(depositor, amountToDeposit);

		// Force incentive token amount
		vm.store(depositor, bytes32(uint256(4)), bytes32(incentiveAmount));
		require(IBaseDepositor(depositor).incentiveToken() == incentiveAmount, "Force to incentive failed");

		uint256 balanceDepositorBefore = IERC20(token).balanceOf(depositor);
		uint256 incentiveTokenBefore = IBaseDepositor(depositor).incentiveToken();

		vm.startPrank(caller);
		(bool success, ) = depositor.call(callData);
		require(success, "low-level call failed");
		vm.stopPrank();

		if (lock) {
			amountToDeposit += incentiveAmount;
			assertEq(IBaseDepositor(depositor).incentiveToken(), 0);
		} else {
			//uint256 callIncentive = (amountToDeposit * IBaseDepositor(depositor).lockIncentive()) /
			//	IBaseDepositor(depositor).FEE_DENOMINATOR(); //not use because stack too deep.

			assertEq(IERC20(token).balanceOf(depositor), balanceDepositorBefore + amountToDeposit);
			assertEq(
				IBaseDepositor(depositor).incentiveToken(),
				incentiveTokenBefore +
					(amountToDeposit * IBaseDepositor(depositor).lockIncentive()) /
					IBaseDepositor(depositor).FEE_DENOMINATOR()
			);
			amountToDeposit -=
				(amountToDeposit * IBaseDepositor(depositor).lockIncentive()) /
				IBaseDepositor(depositor).FEE_DENOMINATOR();
		}
		if (stake && IBaseDepositor(depositor).gauge() != address(0)) {
			assertEq(ILiquidityGauge(IBaseDepositor(depositor).gauge()).balanceOf(user), amountToDeposit);
		} else {
			assertEq(IERC20(sdToken).balanceOf(user), amountToDeposit);
		}
	}

	////////////////////////////////////////////////////////////////
	/// --- SDTOKEN
	///////////////////////////////////////////////////////////////
	function mint(
		address caller,
		address sdToken,
		address to,
		uint256 mintAmount,
		bytes memory callData
	) internal {
		uint256 balanceBefore = IERC20(sdToken).balanceOf(to);
		uint256 supplyBefore = IERC20(sdToken).totalSupply();

		vm.startPrank(caller);
		(bool success, ) = sdToken.call(callData);
		require(success, "low-level call failed");
		vm.stopPrank();

		assertEq(IERC20(sdToken).balanceOf(to), balanceBefore + mintAmount);
		assertEq(IERC20(sdToken).totalSupply(), supplyBefore + mintAmount);
	}

	function burn(
		address caller,
		address sdToken,
		address from,
		uint256 burnAmount,
		bytes memory callData
	) internal {
		uint256 balanceBefore = IERC20(sdToken).balanceOf(from);
		uint256 supplyBefore = IERC20(sdToken).totalSupply();
		vm.startPrank(caller);
		(bool success, ) = sdToken.call(callData);
		require(success, "low-level call failed");
		vm.stopPrank();

		assertEq(IERC20(sdToken).balanceOf(from), balanceBefore - burnAmount);
		assertEq(IERC20(sdToken).totalSupply(), supplyBefore - burnAmount);
	}

	////////////////////////////////////////////////////////////////
	/// --- HELPERS
	///////////////////////////////////////////////////////////////
	function timeJump(uint256 _period) public returns (uint256, uint256) {
		skip(_period);
		vm.roll(block.number + _period / 12);
		return (block.timestamp, block.number);
	}
}
