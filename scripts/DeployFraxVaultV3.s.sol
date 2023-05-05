// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "forge-std/Script.sol";

import {AddressBook} from "addressBook/AddressBook.sol";
import {Booster} from "contracts/strategies/frax/Booster.sol";
import {VaultV3} from "contracts/strategies/frax/VaultV3.sol";

contract DeployFraxVaultV3 is Script, Test {

    address newDeployer = AddressBook.SDTNEWDEPLOYER;

    function run() public {
        vm.startBroadcast(newDeployer);
        VaultV3 vaultImpl = new VaultV3();
        emit log_address(address(vaultImpl));
        vm.stopBroadcast();
    }
}
