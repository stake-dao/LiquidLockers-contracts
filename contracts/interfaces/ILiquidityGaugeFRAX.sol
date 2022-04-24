// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

interface ILiquidityGaugeFRAX {
	function getAllRewardTokens() external view returns (address[] memory);

	function earned(address account) external view returns (uint256[] memory new_earned);
}
