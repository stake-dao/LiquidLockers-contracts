// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Vm.sol";
import "forge-std/Test.sol";
import "forge-std/console.sol";

import {DepositorV2} from "contracts/locking/DepositorV2.sol";

abstract contract DepositorSetup is Test {
	DepositorV2 depositor;

	function setUp() public virtual{
		// depositor = new DepositorV2();
	}
}
