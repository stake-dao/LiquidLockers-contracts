// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "forge-std/Script.sol";

import {VaultV2} from "contracts/strategies/frax/VaultV2.sol";
import {Booster} from "contracts/strategies/frax/Booster.sol";

contract DeployFraxVaultV2 is Script, Test {
    address SDT_FRAXBP_GAUGE = 0x9C8d9667d5726aEcA4d24171958BeE9F46861bed;
    address SDT_FRAXBP_CONVEX_STAKING_TOKEN =
        0xE6Aa75F98e6c105b821a2dba9Fbbd886b421F06b;
    address public constant BOOSTER =
        0x3f7c5021f5Bc634fae82cf9F67F19C5f05562bD3;

    function run() public {
        vm.startBroadcast();
        VaultV2 vaultImpl = new VaultV2();
        emit log_address(address(vaultImpl));
        Booster booster = Booster(BOOSTER);
        booster.addPool(
            address(vaultImpl),
            SDT_FRAXBP_GAUGE,
            SDT_FRAXBP_CONVEX_STAKING_TOKEN
        );

        vm.stopBroadcast();
    }
}
