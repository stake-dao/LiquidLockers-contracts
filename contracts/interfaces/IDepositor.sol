// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IDepositor {
	function depositFor(address account, uint256 amount) external;
}
