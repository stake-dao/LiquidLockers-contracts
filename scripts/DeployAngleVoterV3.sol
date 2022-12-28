// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "forge-std/Script.sol";

import {AddressBook} from "@addressbook/AddressBook.sol";

import {AngleVoterV3} from "contracts/dao/voters/AngleVoterV3.sol";

contract DeployAngleVoterV3 is Script, Test {
    function run() public {
        vm.startBroadcast(AddressBook.SDTNEWDEPLOYER);
        AngleVoterV3 voter = new AngleVoterV3();
        emit log_address(address(voter));
        vm.stopBroadcast();
    }
}
