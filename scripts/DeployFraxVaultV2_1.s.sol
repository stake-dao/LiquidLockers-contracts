// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "forge-std/Script.sol";

import {AddressBook} from "addressBook/AddressBook.sol";
import {Booster} from "contracts/strategies/frax/Booster.sol";
import {VaultV2_1} from "contracts/strategies/frax/VaultV2_1.sol";

contract DeployFraxVaultV2_1 is Script, Test {

    address newDeployer = AddressBook.SDTNEWDEPLOYER;

    function run() public {
        vm.startBroadcast(newDeployer);
        VaultV2_1 vaultImpl = new VaultV2_1();
        emit log_address(address(vaultImpl));
        vm.stopBroadcast();
    }
}
