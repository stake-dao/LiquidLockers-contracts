// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IFeeDistributor {
	function claim() external returns(uint256);
}