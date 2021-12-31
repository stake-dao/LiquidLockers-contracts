// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IMasterchef {
	function deposit(uint256, uint256) external;

	function withdraw(uint256, uint256) external;

	function userInfo(uint256, address) external view returns (uint256, uint256);
}
