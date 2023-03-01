// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "forge-std/Script.sol";

import {Constants} from "test/fixtures/Constants.sol";
import {FpisLocker} from "contracts/lockers/FpisLocker.sol";

contract DeployFpisLLPart1 is Script, Test {
    FpisLocker internal fpisLocker;
    function run() public {
        vm.startBroadcast(Constants.SDTNEWDEPLOYER);
        
        // Deploy and Intialize the FpisLocker contract
        bytes32 lockerSalt = bytes32(uint256(uint160(Constants.FPIS)) << 96); // FPIS address
        fpisLocker =
        new FpisLocker{salt: lockerSalt}(Constants.SDTNEWDEPLOYER);

        vm.stopBroadcast();
    }
}