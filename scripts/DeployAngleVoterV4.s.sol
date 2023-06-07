// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "forge-std/Script.sol";
import {AngleVoterV4} from "contracts/dao/voters/AngleVoterV4.sol";

contract DeployAngleVoterV4 is Script, Test {
    address public deployer = 0x000755Fbe4A24d7478bfcFC1E561AfCE82d1ff62;
    function run() public {
        vm.startBroadcast(deployer);
        AngleVoterV4 voter = new AngleVoterV4();
        emit log_address(address(voter));
        vm.stopBroadcast();
    }
}
