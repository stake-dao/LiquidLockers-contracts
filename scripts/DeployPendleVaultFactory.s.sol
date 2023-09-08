// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "forge-std/Script.sol";

import {PendleVaultFactory} from "contracts/factories/PendleVaultFactory.sol";

contract DeployPendleVaultFactory is Script, Test {
    address public deployer = 0x000755Fbe4A24d7478bfcFC1E561AfCE82d1ff62;
    address public pendleStrategy = 0xA7641acBc1E85A7eD70ea7bCFFB91afb12AD0c54;
    address public sdtDistributor = 0x9C99dffC1De1AfF7E7C1F36fCdD49063A281e18C;
    
    PendleVaultFactory public factory;

    function run() public {
        vm.startBroadcast(deployer);
        factory = new PendleVaultFactory(pendleStrategy, sdtDistributor);
        vm.stopBroadcast();
    }
}