// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

interface ISmartWalletChecker {
	function admin() external returns (address);

	function approveWallet(address _address) external;
}
