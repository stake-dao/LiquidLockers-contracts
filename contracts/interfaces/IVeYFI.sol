// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

interface IVeYFI {
	function modify_lock(
		uint256 amount,
		uint256 unlock_time,
		address user
	) external;

	function withdraw() external;
}
