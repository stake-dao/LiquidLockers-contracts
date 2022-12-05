// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "forge-std/Script.sol";

import { AngleVoterV3 } from "contracts/dao/voters/AngleVoterV3.sol";
import { Constants } from "test/foundry/fixtures/Constants.sol";

contract DeployAngleVoterV3 is Script, Test {

    function run() public { 
        vm.startBroadcast(Constants.SDTNEWDEPLOYER);
        AngleVoterV3 voter = new AngleVoterV3();
        emit log_address(address(voter));
        vm.stopBroadcast();
    }
}