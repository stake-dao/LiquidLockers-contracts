// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

interface ILiquidityGaugeFRAX {
	struct LockedStake {
		bytes32 kek_id;
		uint256 start_timestamp;
		uint256 liquidity;
		uint256 ending_timestamp;
		uint256 lock_multiplier; // 6 decimals of precision. 1x = 1000000
	}
	function stakingToken() external view returns (address);

	function getAllRewardTokens() external view returns (address[] memory);

	function earned(address account) external view returns (uint256[] memory new_earned);

	function lockedStakesOf(address account) external view returns (LockedStake[] memory);

	function lockedStakesOfLength(address account) external view returns (uint256);

	function lockedLiquidityOf(address account) external view returns (uint256);
	
	function veFXSMultiplier(address account) external view returns (uint256 vefxs_multiplier);
}
