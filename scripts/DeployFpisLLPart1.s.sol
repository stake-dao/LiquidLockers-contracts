// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "forge-std/Script.sol";

import {Constants} from "test/fixtures/Constants.sol";
import {AddressBook} from "addressBook/AddressBook.sol";
import {FpisLocker} from "contracts/lockers/FpisLocker.sol";

contract DeployFpisLLPart1 is Script, Test {
    FpisLocker internal fpisLocker;
    address deployer = AddressBook.SDTNEWDEPLOYER;
    function run() public {
        vm.startBroadcast(deployer);
        
        // Deploy and Intialize the FpisLocker contract
        bytes32 lockerSalt = bytes32(uint256(uint160(Constants.VE_FPIS)) << 96); // VE_FPIS address
        fpisLocker =
        new FpisLocker{salt: lockerSalt}(deployer, deployer);

        vm.stopBroadcast();
    }
}