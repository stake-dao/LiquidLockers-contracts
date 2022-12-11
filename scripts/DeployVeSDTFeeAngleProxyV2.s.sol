// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "forge-std/Script.sol";

import { Constants } from "test/fixtures/Constants.sol";
import { VeSDTFeeAngleProxyV2 } from "contracts/accumulators/VeSDTFeeAngleProxyV2.sol";


contract DeployVeSDTFeeAngleProxyV2 is Script, Test {

    address[] public angleAgEurSushiPath = [Constants.ANGLE, Constants.AG_EUR];
    address public constant AG_EUR_FRAXBP_POOL = 0x58257e4291F95165184b4beA7793a1d6F8e7b627;

    function run() public {
        vm.startBroadcast();
        // Deploy new angle fee proxy
        VeSDTFeeAngleProxyV2.CurveExchangeData memory curveExData = VeSDTFeeAngleProxyV2.CurveExchangeData(AG_EUR_FRAXBP_POOL, 0, 1);
        VeSDTFeeAngleProxyV2 feeProxy = new VeSDTFeeAngleProxyV2(angleAgEurSushiPath, curveExData);
        emit log_address(address(feeProxy));
        vm.stopBroadcast();
    }
}