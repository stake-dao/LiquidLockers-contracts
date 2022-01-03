// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IGaugeMultiRewards.sol";
import "./interfaces/ILocker.sol";

/// @title A contract that accumulates FXS rewards and notifies them to the gauges
/// @author StakeDAO
contract FXSAccumulator {
	/* ========== STATE VARIABLES ========== */
	address public governance;
	address public locker;
	address public fxs = 0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0;
	address public gauge;

	/* ========== EVENTS ========== */
	event GaugeSet(address newGauge);
	event RewardNotified(address gauge, uint256 amount);
	event LockerSet(address newLocker);
	event GovernanceSet(address newGov);

	/* ========== CONSTRUCTOR ========== */
	constructor() public {
		governance = msg.sender;
		emit GovernanceSet(governance);
	}

	/* ========== MUTATIVE FUNCTIONS ========== */
	/// @notice Claims rewards from the locker and notifies it to the gauge multireward
	function claimAndNotify() external {
		require(locker != address(0));
		ILocker(locker).claimFXSRewards(address(this));
		_notifyReward();
	}

	/// @notice Notify the gauge multireward of the new reward
	function _notifyReward() internal {
		require(gauge != address(0));
		uint256 balanceBefore = IERC20(fxs).balanceOf(address(this));
		IERC20(fxs).approve(gauge, balanceBefore);
		IGaugeMultiRewards(gauge).notifyRewardAmount(fxs, balanceBefore);
		emit RewardNotified(gauge, balanceBefore);
	}

	/// @notice Sets gauge for the accumulator which will receive and distribute the rewards
	/// @dev Can be called only by the governance
	function setGauge(address _gauge) external {
		require(msg.sender == governance, "!gov");
		gauge = _gauge;
		emit GaugeSet(gauge);
	}

	/// @notice Allows the governance to set the governance
	/// @dev Can be called only by the governance
	function setGovernance(address _newG) external {
		require(msg.sender == governance, "!gov");
		governance = _newG;
		emit GovernanceSet(governance);
	}

	/// @notice Allows the governance to set the locker
	/// @dev Can be called only by the governance
	function setLocker(address _newL) external {
		require(msg.sender == governance, "!gov");
		locker = _newL;
		emit LockerSet(locker);
	}

	function setRewardsDuration(uint256 _rewardsDuration) external {
		require(msg.sender == governance, "!gov");
		IGaugeMultiRewards(gauge).setRewardsDuration(fxs, _rewardsDuration);
	}
}
