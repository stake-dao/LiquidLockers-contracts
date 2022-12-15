// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "forge-std/Script.sol";

import {Constants} from "../test/fixtures/Constants.sol";
import {VeSDTFeeCurveProxyV2} from "../contracts/accumulators/VeSDTFeeCurveProxyV2.sol";

contract DeployVeSDTFeeCurveProxyV2 is Script, Test {
    address[] public crvUsdcSushiPath = [Constants.CRV, Constants.WETH, Constants.USDC];

    function run() public {
        vm.startBroadcast();
        // Deploy new curve fee proxy
        VeSDTFeeCurveProxyV2 feeProxy = new VeSDTFeeCurveProxyV2(crvUsdcSushiPath);
        emit log_address(address(feeProxy));
        vm.stopBroadcast();
    }
}
