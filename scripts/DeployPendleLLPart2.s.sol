// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "forge-std/Script.sol";

import {AddressBook} from "addressBook/AddressBook.sol";
import {ILiquidityGauge} from "contracts/interfaces/ILiquidityGauge.sol";
import {PendleAccumulator} from "contracts/accumulators/PendleAccumulator.sol";
import {PendleLocker} from "contracts/lockers/PendleLocker.sol";
import {VeSDTFeePendleProxy} from "contracts/accumulators/VeSDTFeePendleProxy.sol";

contract DeployPendleLLPart2 is Script, Test {
    VeSDTFeePendleProxy public veSDTFeePendleProxy;
    PendleAccumulator public pendleAccumulator;
    PendleLocker public pendleLocker = PendleLocker(0xD8fa8dC5aDeC503AcC5e026a98F32Ca5C1Fa289A);

    ILiquidityGauge public liquidityGauge = ILiquidityGauge(0x50DC9aE51f78C593d4138263da7088A973b8184E);
    address public deployer = 0x000755Fbe4A24d7478bfcFC1E561AfCE82d1ff62;

    function run() public {
        vm.startBroadcast();

        // Deploy veSDTFeePendleProxy contract
        veSDTFeePendleProxy = new VeSDTFeePendleProxy();

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
