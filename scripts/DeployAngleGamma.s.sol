// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "forge-std/Script.sol";

import {AddressBook} from "addressBook/AddressBook.sol";
import {ILiquidityGaugeStrat} from "contracts/interfaces/ILiquidityGaugeStrat.sol";
import {AngleVaultGamma} from "contracts/strategies/angle/AngleVaultGamma.sol";
import {AngleGammaClaimer} from "contracts/strategies/angle/AngleGammaClaimer.sol";
import {TransparentUpgradeableProxy} from "contracts/external/TransparentUpgradeableProxy.sol";

contract DeployAngleGamma is Script, Test {
    AngleVaultGamma public agEurEthVault;
    AngleVaultGamma public agEurUsdcVault;
    AngleGammaClaimer public rewardClaimer;
    address public liquidityGaugeStratImpl = 0x3Dc56D46F0Bd13655EfB29594a2e44534c453BF9;
    ILiquidityGaugeStrat public agEurEthGauge;
    ILiquidityGaugeStrat public agEurUsdcGauge;
    address public deployer = 0x000755Fbe4A24d7478bfcFC1E561AfCE82d1ff62;
    address public constant GAMMA_AGEUR_ETH_LP = 0xE8f20fD90161de1d5B4cF7e2B5D92932CA06D5f4;
    address public constant GAMMA_AGEUR_USDC_LP = 0xF56Abca39c27D5C74F94c901b8C137fDf53B3E80;

    function run() public {
        vm.startBroadcast(deployer);

        // Deploy Vaults Contract
        agEurEthVault = new AngleVaultGamma(GAMMA_AGEUR_ETH_LP, deployer, "stake dao AgEurEthGamma", "sdAgEurEthGamma");
        agEurUsdcVault = new AngleVaultGamma(GAMMA_AGEUR_USDC_LP, deployer, "stake dao AgEurUsdcGamma", "sdAgEurUsdcGamma");

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
                    "agEur/ETH Gamma"
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
                    "agEur/USDC Gamma"
                )
                )
            )
        );
        agEurUsdcVault.setLiquidityGauge(address(agEurUsdcGauge));

        // Deploy Claimer
        rewardClaimer = new AngleGammaClaimer(
            deployer, 
            deployer, 
            deployer, 
            deployer
        );

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
