// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

import "forge-std/Test.sol";

import "../fixtures/Constants.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "contracts/interfaces/IVeToken.sol";
import "contracts/interfaces/IBaseLocker.sol";
import "contracts/interfaces/IBaseDepositor.sol";

contract BaseTest is Test {
	////////////////////////////////////////////////////////////////
	/// --- LOCKER
	///////////////////////////////////////////////////////////////

	function createLock(
		address _locker,
		address _token,
		address _veToken,
		uint256 _initialAmountToLock,
		uint256 _initialPeriodToLock,
		bytes memory _createLockSign
	) internal {
		deal(_token, _locker, _initialAmountToLock);
		vm.startPrank(IBaseLocker(_locker).governance());

		if (keccak256(_createLockSign) == keccak256(abi.encodeWithSignature("base()"))) {
			IBaseLocker(_locker).createLock(_initialAmountToLock, block.timestamp + _initialPeriodToLock);
		} else {
			(bool success, ) = _locker.call(_createLockSign);
			require(success, "low-level call failed");
		}
		vm.stopPrank();

		IVeToken.LockedBalance memory lockedBalance = IVeToken(_veToken).locked(_locker);

		assertEq(lockedBalance.amount, int256(_initialAmountToLock));
		assertEq(lockedBalance.end, ((block.timestamp + _initialPeriodToLock) / Constants.WEEK) * Constants.WEEK);
		assertApproxEqRel(IVeToken(_veToken).balanceOf(_locker), _initialAmountToLock, 1e16); // 1% Margin of Error
	}

	function increaseAmount(
		address _locker,
		address _token,
		address _veToken,
		uint256 _initialAmountToLock,
		uint256 _initialPeriodToLock,
		uint256 _extraAmountToLock,
		bytes memory _createLockSign,
		bytes memory _increaseAmountSign
	) internal {
		createLock(_locker, _token, _veToken, _initialAmountToLock, _initialPeriodToLock, _createLockSign);

		deal(_token, address(_locker), _extraAmountToLock);
		vm.startPrank(IBaseLocker(_locker).governance());
		if (keccak256(_increaseAmountSign) == keccak256(abi.encodeWithSignature("base()"))) {
			IBaseLocker(_locker).increaseAmount(_extraAmountToLock);
		} else {
			(bool success, ) = _locker.call(_increaseAmountSign);
			require(success, "low-level call failed");
		}
		vm.stopPrank();

		IVeToken.LockedBalance memory lockedBalance = IVeToken(_veToken).locked(_locker);

		assertEq(lockedBalance.amount, int256(_initialAmountToLock + _extraAmountToLock));
	}

	function increaseLock(
		address _locker,
		address _token,
		address _veToken,
		uint256 _initialAmountToLock,
		uint256 _initialPeriodToLock,
		uint256 _extraPeriodToLock,
		bytes memory _createLockSign,
		bytes memory _increasePeriodSign
	) internal {
		uint256 timestampBefore = block.timestamp;
		createLock(_locker, _token, _veToken, _initialAmountToLock, _initialPeriodToLock, _createLockSign);
		timeJump(_extraPeriodToLock);
		vm.startPrank(IBaseLocker(_locker).governance());

		if (keccak256(_increasePeriodSign) == keccak256(abi.encodeWithSignature("base()"))) {
			IBaseLocker(_locker).increaseUnlockTime(timestampBefore + _initialPeriodToLock + _extraPeriodToLock);
		} else {
			(bool success, ) = _locker.call(_increasePeriodSign);
			require(success, "low-level call failed");
		}
		vm.stopPrank();

		IVeToken.LockedBalance memory lockedBalance = IVeToken(_veToken).locked(address(_locker));
		assertEq(lockedBalance.end, ((block.timestamp + _initialPeriodToLock) / Constants.WEEK) * Constants.WEEK);
	}

	function release(
		address _locker,
		address _token,
		address _veToken,
		uint256 _initialAmountToLock,
		uint256 _initialPeriodToLock,
		bytes memory _createLockSign,
		bytes memory _releaseSign
	) internal {
		createLock(_locker, _token, _veToken, _initialAmountToLock, _initialPeriodToLock, _createLockSign);
		timeJump(block.timestamp + _initialPeriodToLock);
		vm.startPrank(IBaseLocker(_locker).governance());

		if (keccak256(_releaseSign) == keccak256(abi.encodeWithSignature("base()"))) {
			IBaseLocker(_locker).release(address(this));
		} else {
			(bool success, ) = _locker.call(_releaseSign);
			require(success, "low-level call failed");
		}
		vm.stopPrank();

		assertEq(IERC20(_token).balanceOf(address(this)), _initialAmountToLock);
	}

	function claimReward(
		address _locker,
		address _token,
		address _veToken,
		uint256 _initialAmountToLock,
		uint256 _initialPeriodToLock,
		address[] memory _rewardsToken,
		uint256[] memory _rewardsAmount,
		address _rewardsDistributor,
		bytes memory _createLockSign,
		bytes memory _claimRewardsSign
	) internal {
		uint256[] memory balancesBefore = new uint256[](_rewardsToken.length);
		uint256[] memory balancesAfter = new uint256[](_rewardsToken.length);

		// Check balances for rewards tokens before
		for (uint8 i = 0; i < _rewardsToken.length; i++) {
			balancesBefore[i] = IERC20(_rewardsToken[i]).balanceOf(address(this));
		}

		createLock(_locker, _token, _veToken, _initialAmountToLock, _initialPeriodToLock, _createLockSign);

		// Distribute rewards
		for (uint8 i = 0; i < _rewardsToken.length; ++i) {
			uint256 balanceBefore = IERC20(_rewardsToken[i]).balanceOf(address(this));
			deal(_rewardsToken[i], address(this), _rewardsAmount[i]);
			IERC20(_rewardsToken[i]).transfer(_rewardsDistributor, _rewardsAmount[i]);
			require((balanceBefore - IERC20(_rewardsToken[i]).balanceOf(address(this))) == 0, "!not empty");
		}
		timeJump(2 * Constants.WEEK);

		// Claim rewards
		vm.startPrank(IBaseLocker(_locker).governance());
		if (keccak256(_claimRewardsSign) == keccak256(abi.encodeWithSignature("base()"))) {
			for (uint8 i = 0; i < _rewardsToken.length; ++i) {
				IBaseLocker(_locker).claimRewards(_rewardsToken[i], address(this));
			}
		} else {
			for (uint8 i = 0; i < _rewardsToken.length; ++i) {
				(bool success, ) = _locker.call(_claimRewardsSign);
				require(success, "low-level call failed");
			}
		}
		vm.stopPrank();

		// Check rewards obtained
		for (uint8 i = 0; i < _rewardsToken.length; i++) {
			balancesAfter[i] = IERC20(_rewardsToken[i]).balanceOf(address(this));

			assertEq(balancesBefore[i], 0);
			assertGt(balancesAfter[i], balancesBefore[i]);
		}
	}

	function execute(
		address _locker,
		address _target,
		uint256 _value,
		bytes memory _data,
		bytes memory _claimRewardsSign
	) internal {
		vm.startPrank(IBaseLocker(_locker).governance());
		bool success;
		if (keccak256(_claimRewardsSign) == keccak256(abi.encodeWithSignature("base()"))) {
			(success, ) = IBaseLocker(_locker).execute(_target, _value, _data);
		} else {
			(success, ) = _locker.call{ value: _value }(_claimRewardsSign);
		}
		vm.stopPrank();

		assertEq(success, true);
	}

	function setAccumulator(
		address _locker,
		bytes memory _setterFuncSign,
		bytes memory _setterSign
	) internal {
		vm.startPrank(IBaseLocker(_locker).governance());
		if (keccak256(_setterFuncSign) == keccak256(abi.encodeWithSignature("base()"))) {
			IBaseLocker(_locker).setAccumulator(address(0xA));
		} else {
			(bool success, ) = _locker.call(_setterFuncSign);
			require(success, "low-level call failed");
		}
		vm.stopPrank();

		if (keccak256(_setterSign) == keccak256(abi.encodeWithSignature("base()"))) {
			assertEq(IBaseLocker(_locker).accumulator(), address(0xA));
		} else {
			(bool success, bytes memory _data) = _locker.call(_setterSign);
			require(success, "low-level call failed");
			assertEq(keccak256(_data), keccak256(abi.encode(address(0xA))));
		}
	}

	function setGovernance(
		address _locker,
		bytes memory _setterFuncSign,
		bytes memory _setterSign
	) internal {
		vm.startPrank(IBaseLocker(_locker).governance());
		if (keccak256(_setterFuncSign) == keccak256(abi.encodeWithSignature("base()"))) {
			IBaseLocker(_locker).setGovernance(address(0xA));
		} else {
			(bool success, ) = _locker.call(_setterFuncSign);
			require(success, "low-level call failed");
		}
		vm.stopPrank();

		if (keccak256(_setterSign) == keccak256(abi.encodeWithSignature("base()"))) {
			assertEq(IBaseLocker(_locker).governance(), address(0xA));
		} else {
			(bool success, bytes memory _data) = _locker.call(_setterSign);
			require(success, "low-level call failed");
			assertEq(keccak256(_data), keccak256(abi.encode(address(0xA))));
		}
	}

	
	function setDepositor(
		address _locker,
		bytes memory _setterFuncSign,
		bytes memory _setterSign
	) internal {
		vm.startPrank(IBaseLocker(_locker).governance());
		if (keccak256(_setterFuncSign) == keccak256(abi.encodeWithSignature("base()"))) {
			IBaseLocker(_locker).setDepositor(address(0xA));
		} else {
			(bool success, ) = _locker.call(_setterFuncSign);
			require(success, "low-level call failed");
		}
		vm.stopPrank();

		if (keccak256(_setterSign) == keccak256(abi.encodeWithSignature("base()"))) {
			assertEq(IBaseLocker(_locker).depositor(), address(0xA));
		} else {
			(bool success, bytes memory _data) = _locker.call(_setterSign);
			require(success, "low-level call failed");
			assertEq(keccak256(_data), keccak256(abi.encode(address(0xA))));
		}
	}

	function setFeeDistributor(
		address _locker,
		bytes memory _setterFuncSign,
		bytes memory _setterSign
	) internal {
		vm.startPrank(IBaseLocker(_locker).governance());
		if (keccak256(_setterFuncSign) == keccak256(abi.encodeWithSignature("base()"))) {
			IBaseLocker(_locker).setFeeDistributor(address(0xA));
		} else {
			(bool success, ) = _locker.call(_setterFuncSign);
			require(success, "low-level call failed");
		}
		vm.stopPrank();

		if (keccak256(_setterSign) == keccak256(abi.encodeWithSignature("base()"))) {
			assertEq(IBaseLocker(_locker).feeDistributor(), address(0xA));
		} else {
			(bool success, bytes memory _data) = _locker.call(_setterSign);
			require(success, "low-level call failed");
			assertEq(keccak256(_data), keccak256(abi.encode(address(0xA))));
		}
	}

	function setGaugeController(
		address _locker,
		bytes memory _setterFuncSign,
		bytes memory _setterSign
	) internal {
		vm.startPrank(IBaseLocker(_locker).governance());
		if (keccak256(_setterFuncSign) == keccak256(abi.encodeWithSignature("base()"))) {
			IBaseLocker(_locker).setGaugeController(address(0xA));
		} else {
			(bool success, ) = _locker.call(_setterFuncSign);
			require(success, "low-level call failed");
		}
		vm.stopPrank();

		if (keccak256(_setterSign) == keccak256(abi.encodeWithSignature("base()"))) {
			assertEq(IBaseLocker(_locker).gaugeController(), address(0xA));
		} else {
			(bool success, bytes memory _data) = _locker.call(_setterSign);
			require(success, "low-level call failed");
			assertEq(keccak256(_data), keccak256(abi.encode(address(0xA))));
		}
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
