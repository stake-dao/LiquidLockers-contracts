// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

interface IDepositor {
	function depositFor(address account, uint256 amount) external;
}
