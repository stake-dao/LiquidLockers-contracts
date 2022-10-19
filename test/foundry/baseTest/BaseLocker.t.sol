// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

import "forge-std/Test.sol";

import "../fixtures/Constants.sol";

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "contracts/interfaces/IBaseLocker.sol";

contract BaseLockerTest is Test {
	address public token;
	address public veToken;
	address public locker;
	address[] public rewardsToken;
	address public rewardDistributor;

	uint256 public initialLockAmount;
	uint256 public extraLockAmount;
	uint256 public initialLockTime;
	uint256 public extraLockTime;
	uint256[] public rewardsAmount;

	function initBaseLocker(
		address _token,
		address _veToken,
		address _locker,
		address[] memory _rewardsToken,
		address _rewardDistributor,
		uint256 _initialLockAmount,
		uint256 _initialLockTime,
		uint256 _extraLockAmount,
		uint256 _extraLockTime,
		uint256[] memory _rewardsAmount
	) public {
		token = _token;
		veToken = _veToken;
		locker = _locker;
		initialLockAmount = _initialLockAmount;
		initialLockTime = _initialLockTime;
		extraLockAmount = _extraLockAmount;
		extraLockTime = _extraLockTime;
		rewardsToken = _rewardsToken;
		rewardDistributor = _rewardDistributor;
		rewardsAmount = _rewardsAmount;
	}

	function createLock() internal {
		deal(token, address(locker), initialLockAmount);
		vm.startPrank(IBaseLocker(locker).governance());
		IBaseLocker(locker).createLock(initialLockAmount, block.timestamp + initialLockTime);
		vm.stopPrank();
	}

	function increaseAmount() internal {
		createLock();
		deal(token, address(locker), extraLockAmount);
		vm.startPrank(IBaseLocker(locker).governance());
		IBaseLocker(locker).increaseAmount(extraLockAmount);
		vm.stopPrank();
	}

	function increaseLock() internal {
		uint256 timestampBefore = block.timestamp;
		createLock();
		timeJump(extraLockTime);
		vm.startPrank(IBaseLocker(locker).governance());
		IBaseLocker(locker).increaseUnlockTime(timestampBefore + initialLockTime + extraLockTime);
		vm.stopPrank();
	}

	function release() internal {
		createLock();
		timeJump(block.timestamp + initialLockTime);
		vm.startPrank(IBaseLocker(locker).governance());
		IBaseLocker(locker).release(address(this));
		vm.stopPrank();
	}

	function claimReward() internal {
		createLock();
		for (uint8 i = 0; i < rewardsToken.length; ++i) {
			uint256 balanceBefore = IERC20(rewardsToken[i]).balanceOf(address(this));
			deal(rewardsToken[i], address(this), rewardsAmount[i]);
			IERC20(rewardsToken[i]).transfer(rewardDistributor, rewardsAmount[i]);
			require((balanceBefore - IERC20(rewardsToken[i]).balanceOf(address(this))) == 0, "!not empty");
		}
		timeJump(2 * Constants.WEEK);

		vm.startPrank(IBaseLocker(locker).governance());
		for (uint8 i = 0; i < rewardsToken.length; ++i) {
			IBaseLocker(locker).claimRewards(rewardsToken[i], address(this));
		}
		vm.stopPrank();
	}

	function execute() internal returns (bool success) {
		vm.startPrank(IBaseLocker(locker).governance());
		bytes memory data = abi.encodeWithSignature("token()");
		(success, ) = IBaseLocker(locker).execute(address(this), 0, data);
	}

	function setters() internal {
		vm.startPrank(IBaseLocker(locker).governance());
		IBaseLocker(locker).setAccumulator(address(0xA));
		IBaseLocker(locker).setGovernance(address(0xA));
	}

	function timeJump(uint256 _period) public returns (uint256, uint256) {
		skip(_period);
		vm.roll(block.number + _period / 12);
		return (block.timestamp, block.number);
	}
}
