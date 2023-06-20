// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "forge-std/Script.sol";

import {AddressBook} from "addressBook/AddressBook.sol";
import {ILiquidityGaugeStrat} from "contracts/interfaces/ILiquidityGaugeStrat.sol";
import {AngleVaultGamma} from "contracts/strategies/angle/AngleVaultGamma.sol";
import {AngleGammaClaimer} from "contracts/strategies/angle/AngleGammaClaimer.sol";
import {TransparentUpgradeableProxy} from "contracts/external/TransparentUpgradeableProxy.sol";

contract DeployAngleGUni is Script, Test {
    AngleVaultGamma public agEurEthVault;
    AngleVaultGamma public agEurUsdcVault;
    AngleGammaClaimer public rewardClaimer; // hardcode the address after deploy 
    address public liquidityGaugeStratImpl = 0x3Dc56D46F0Bd13655EfB29594a2e44534c453BF9;
    ILiquidityGaugeStrat public agEurEthGauge;
    ILiquidityGaugeStrat public agEurUsdcGauge;
    address public deployer = 0x000755Fbe4A24d7478bfcFC1E561AfCE82d1ff62;
    address public constant GUNI_AGEUR_ETH_LP = 0x857E0B2eD0E82D5cDEB015E77ebB873C47F99575;
    address public constant GUNI_AGEUR_USDC_LP = 0xEDECB43233549c51CC3268b5dE840239787AD56c;

    function run() public {
        vm.startBroadcast(deployer);

        // Deploy Vaults Contract
        agEurEthVault = new AngleVaultGamma(GUNI_AGEUR_ETH_LP, deployer, "stake dao AgEurEthGUni", "sdAgEurEthGUni");
        agEurUsdcVault = new AngleVaultGamma(GUNI_AGEUR_USDC_LP, deployer, "stake dao AgEurUsdcGUni", "sdAgEurUsdcGUni");

        // Deploy LiquidityGauge
        agEurEthGauge = ILiquidityGaugeStrat(
            address(
                new TransparentUpgradeableProxy(
                liquidityGaugeStratImpl,
                AddressBook.PROXY_ADMIN,
                abi.encodeWithSignature(
                    "initialize(address,address,address,address,address,address,address,string)",
                    address(agEurEthVault),
                    deployer,
                    AddressBook.SDT,
                    AddressBook.VE_SDT,
                    AddressBook.VE_SDT_BOOST_PROXY,
                    AddressBook.SDT_DISTRIBUTOR_STRAT,
                    address(agEurEthVault),
                    "agEur/ETH GUni"
                )
                )
            )
        );
        agEurEthVault.setLiquidityGauge(address(agEurEthGauge));

        agEurUsdcGauge = ILiquidityGaugeStrat(
            address(
                new TransparentUpgradeableProxy(
                liquidityGaugeStratImpl,
                AddressBook.PROXY_ADMIN,
                abi.encodeWithSignature(
                    "initialize(address,address,address,address,address,address,address,string)",
                    address(agEurUsdcVault),
                    deployer,
                    AddressBook.SDT,
                    AddressBook.VE_SDT,
                    AddressBook.VE_SDT_BOOST_PROXY,
                    AddressBook.SDT_DISTRIBUTOR_STRAT,
                    address(agEurUsdcVault),
                    "agEur/USDC GUni"
                )
                )
            )
        );
        agEurUsdcVault.setLiquidityGauge(address(agEurUsdcGauge));

        // add ANGLE extra reward
        agEurEthGauge.add_reward(AddressBook.ANGLE, address(rewardClaimer));
        agEurUsdcGauge.add_reward(AddressBook.ANGLE, address(rewardClaimer));

        // whitelist the claimer to claim ANGLE via the merkle
        agEurEthVault.toggleOnlyOperatorCanClaim();
        agEurUsdcVault.toggleOnlyOperatorCanClaim();
        agEurEthVault.toggleOperator(address(rewardClaimer));
        agEurUsdcVault.toggleOperator(address(rewardClaimer));
        agEurEthVault.approveClaimer(AddressBook.ANGLE, address(rewardClaimer));
        agEurUsdcVault.approveClaimer(AddressBook.ANGLE, address(rewardClaimer));

        vm.stopBroadcast();
    }
}
