// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IVeSDT {
	function deposit_for(address account, uint256 amount) external;

	function deposit_for_sd(address _addr, uint256 _value) external;
}
