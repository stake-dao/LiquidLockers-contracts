// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "forge-std/Script.sol";

import {AddressBook} from "addressBook/AddressBook.sol";
import {ILiquidityGauge} from "contracts/interfaces/ILiquidityGauge.sol";
import {PendleAccumulator} from "contracts/accumulators/PendleAccumulator.sol";
import {PendleLocker} from "contracts/lockers/PendleLocker.sol";

contract DeployPendleLLPart2 is Script, Test {
    PendleAccumulator public pendleAccumulator;
    PendleLocker public pendleLocker; // hardcode it before running the script

    ILiquidityGauge public liquidityGauge; // hardcode it before running the script
    address public deployer = 0x000755Fbe4A24d7478bfcFC1E561AfCE82d1ff62;

    function run() public {
        vm.startBroadcast();

        // Deploy Accumulator Contract
        pendleAccumulator = new PendleAccumulator(address(liquidityGauge), deployer, deployer, deployer);
        pendleAccumulator.setLocker(address(pendleLocker));

        // Add Reward to LGV4
        liquidityGauge.add_reward(AddressBook.WETH, address(pendleAccumulator));

        // Locker
        pendleLocker.setAccumulator(address(pendleAccumulator));

        vm.stopBroadcast();
    }
}
