// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

interface IMasterchef {
	function deposit(uint256, uint256) external;

	function withdraw(uint256, uint256) external;

	function userInfo(uint256, address) external view returns (uint256, uint256);
}
