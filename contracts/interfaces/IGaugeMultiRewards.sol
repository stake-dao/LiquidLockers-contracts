// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IGaugeMultiRewards {
	function stakeFor(address, uint256) external;

	function withdrawFor(address, uint256) external;

	function getRewardFor(address) external;

	function notifyRewardAmount(address, uint256) external;

	function earned(address) external view returns (uint256);

	function claimReward(
		address account,
		bool[] memory locked
	) external;

	function claimReward(
		address account,
		address depositorProxy
	) external;

	function rewardTokens() external returns (address[] memory);

	function setRewardsDuration(address, uint256) external;
}
