// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

interface IVeToken {
	struct LockedBalance {
		int128 amount;
		uint256 end;
	}

	function create_lock(uint256 _value, uint256 _unlock_time) external;

	function increase_amount(uint256 _value) external;

	function increase_unlock_time(uint256 _unlock_time) external;

	function withdraw() external;
}
