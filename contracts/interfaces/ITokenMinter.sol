// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.6.12;

interface ITokenMinter {
	function mint(address, uint256) external;

	function burn(address, uint256) external;
}
