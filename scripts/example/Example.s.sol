// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "forge-std/Script.sol";

import { ClaimRewards } from "contracts/staking/ClaimRewards.sol";

contract ExampleScript is Script, Test {
	ClaimRewards claimRewards;

	function run() public {
		vm.startBroadcast();

		// That's it.
		claimRewards = new ClaimRewards();
		// Contract deployed.

		vm.stopBroadcast();
	}
}
