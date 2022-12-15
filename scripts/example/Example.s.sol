// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "forge-std/Script.sol";

import {ClaimRewards} from "contracts/staking/ClaimRewards.sol";

import {IGaugeController} from "contracts/interfaces/IGaugeController.sol";

contract ExampleScript is Script, Test {
    ClaimRewards claimRewards;

    IGaugeController controller;

    function run() public {
        vm.startBroadcast();

        // Simple Contract without argument.
        // Store the var if you want to retrive the address for a next deployment.
        claimRewards = new ClaimRewards();

        // Vyper Contract.
        // Retrieve from artifacts folder the bytecode of the vyper contract to be deployed.
        // Encode argument and boom,  it's deployed.
        controller = IGaugeController(
            deployCode(
                "artifacts/vyper-contracts/GaugeController.vy/GaugeController.json",
                abi.encode(
                    address(0xCAFE), // Token
                    address(0xBEEF), // Voting Escrow
                    address(0xBAFE) // Admin
                )
            )
        );

        // Launch "forge script scripts/example/Example.s.sol -vvvv --private-key $PRIVATE_KEY" to test the script.
        // To broadcast the transaction in desired network, add --broadcast.

        vm.stopBroadcast();
    }
}
