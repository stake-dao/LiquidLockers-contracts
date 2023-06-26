// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "forge-std/Script.sol";

import {AddressBook} from "addressBook/AddressBook.sol";
import {PendleStrategy} from "contracts/strategies/pendle/PendleStrategy.sol";
import {PendleVaultFactory} from "contracts/factories/PendleVaultFactory.sol";

contract DeployPendleStrategy is Script, Test {
    address public deployer = 0x000755Fbe4A24d7478bfcFC1E561AfCE82d1ff62;
    address public ms = 0xF930EBBd05eF8b25B1797b9b2109DDC9B0d43063;
    address public accumulator;
    address public veSdtFeeProxy;

    PendleStrategy public strategy;
    PendleVaultFactory public factory;

    function run() public {
        vm.startBroadcast(deployer);

        // deploy pendle strategy
        strategy = new PendleStrategy(
            deployer, 
            ms, 
            accumulator, 
            veSdtFeeProxy, 
            AddressBook.SDT_DISTRIBUTOR_STRAT
        );

        // deploy factory
        factory = new PendleVaultFactory(address(strategy), AddressBook.SDT_DISTRIBUTOR_STRAT);

        strategy.setVaultGaugeFactory(address(factory));

        vm.stopBroadcast();
    }
}
