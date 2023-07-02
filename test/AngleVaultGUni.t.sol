// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

// Base Tests
import "./baseTest/Base.t.sol";

import "contracts/external/ProxyAdmin.sol";
import "contracts/strategies/angle/AngleVaultGamma.sol";
import "contracts/strategies/angle/AngleMerklClaimer.sol";
import "contracts/external/TransparentUpgradeableProxy.sol";
import "contracts/interfaces/ILiquidityGaugeStrat.sol";

contract AngleVaultGUniTest is BaseTest {
    address public constant BOB = address(0xB0B);
    address public constant ALICE = address(0xAA);
    address public constant LOCAL_DEPLOYER = address(0xDE);
    address public constant CLAIMER_USER = 0x5Be876Ed0a9655133226BE302ca6f5503E3DA569;
    address public constant GUNI_AGEUR_ETH_LP = 0x857E0B2eD0E82D5cDEB015E77ebB873C47F99575;
    address public constant GUNI_AGEUR_USDC_LP = 0xEDECB43233549c51CC3268b5dE840239787AD56c;
    address public constant MERKLE_DISTRIBUTOR = 0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae;

    uint256 public constant AMOUNT = 1e18;

    AngleVaultGamma public agEurEthVault;
    AngleVaultGamma public agEurUsdcVault;
    ProxyAdmin public proxyAdmin;
    TransparentUpgradeableProxy public agEurEthGaugeProxy;
    TransparentUpgradeableProxy public agEurUsdcGaugeProxy;
    ILiquidityGaugeStrat public agEurEthGauge;
    ILiquidityGaugeStrat public agEurUsdcGauge;
    ILiquidityGaugeStrat public liquidityGaugeStratImpl;
    AngleMerklClaimer public claimer;

    function setUp() public {
        uint256 forkId = vm.createFork(vm.rpcUrl("mainnet"), 17305960);
        vm.selectFork(forkId);

        proxyAdmin = new ProxyAdmin();

        vm.startPrank(LOCAL_DEPLOYER);

        // Deploy Vaults
        agEurEthVault = new AngleVaultGamma(GUNI_AGEUR_ETH_LP, LOCAL_DEPLOYER, "stake dao AgEurEthGUni", "sdAgEurEthGUni");
        agEurUsdcVault = new AngleVaultGamma(GUNI_AGEUR_USDC_LP, LOCAL_DEPLOYER, "stake dao AgEurUsdcGUni", "sdAgEurUsdcGUni");

        // LGV4 strategy impl
        liquidityGaugeStratImpl = ILiquidityGaugeStrat(
            deployCode("artifacts/vyper-contracts/LiquidityGaugeV4Strat.vy/LiquidityGaugeV4Strat.json")
        );
        
        // Gauges
        // AgEur/Eth
        bytes memory AgEurEthGaugeData = abi.encodeWithSignature(
            "initialize(address,address,address,address,address,address,address,string)",
            address(agEurEthVault),
            LOCAL_DEPLOYER,
            AddressBook.SDT,
            AddressBook.VE_SDT,
            AddressBook.VE_SDT_BOOST_PROXY,
            LOCAL_DEPLOYER,
            address(agEurEthVault),
            "agEur/ETH GUni"
        );
        agEurEthGaugeProxy = new TransparentUpgradeableProxy(address(liquidityGaugeStratImpl), address(proxyAdmin), AgEurEthGaugeData);
        agEurEthGauge = ILiquidityGaugeStrat(address(agEurEthGaugeProxy));
        agEurEthVault.setLiquidityGauge(address(agEurEthGauge));

        // AgEur/Usdc
        bytes memory AgEurUsdcGaugeData = abi.encodeWithSignature(
            "initialize(address,address,address,address,address,address,address,string)",
            address(agEurUsdcVault),
            LOCAL_DEPLOYER,
            AddressBook.SDT,
            AddressBook.VE_SDT,
            AddressBook.VE_SDT_BOOST_PROXY,
            LOCAL_DEPLOYER,
            address(agEurUsdcVault),
            "agEur/USDC GUni"
        );
        agEurUsdcGaugeProxy = new TransparentUpgradeableProxy(address(liquidityGaugeStratImpl), address(proxyAdmin), AgEurUsdcGaugeData);
        agEurUsdcGauge = ILiquidityGaugeStrat(address(agEurUsdcGaugeProxy));
        agEurUsdcVault.setLiquidityGauge(address(agEurUsdcGauge));
        
        deal(GUNI_AGEUR_ETH_LP, LOCAL_DEPLOYER, AMOUNT);
        deal(GUNI_AGEUR_USDC_LP, LOCAL_DEPLOYER, AMOUNT);

        // Deploy Claimer
        claimer = new AngleMerklClaimer(
            LOCAL_DEPLOYER, 
            LOCAL_DEPLOYER, 
            LOCAL_DEPLOYER, 
            LOCAL_DEPLOYER
        );

        // add ANGLE extra reward
        agEurEthGauge.add_reward(AddressBook.ANGLE, address(claimer));
        agEurUsdcGauge.add_reward(AddressBook.ANGLE, address(claimer));

        // whitelist the claimer to claim ANGLE via the merkle
        agEurEthVault.toggleOnlyOperatorCanClaim();
        agEurUsdcVault.toggleOnlyOperatorCanClaim();
        agEurEthVault.toggleOperator(address(claimer));
        agEurUsdcVault.toggleOperator(address(claimer));
        agEurEthVault.approveClaimer(AddressBook.ANGLE, address(claimer));
        agEurUsdcVault.approveClaimer(AddressBook.ANGLE, address(claimer));

        vm.startPrank(CLAIMER_USER);
        // Angle merkle distributor 
        IAngleMerkleDistributor(MERKLE_DISTRIBUTOR).toggleOnlyOperatorCanClaim(CLAIMER_USER);
        IAngleMerkleDistributor(MERKLE_DISTRIBUTOR).toggleOperator(CLAIMER_USER, address(claimer));
        IERC20(AddressBook.ANGLE).approve(address(claimer), type(uint256).max);
        vm.stopPrank();
    }

    function test01LGSettings() public {
        assertEq(agEurEthGauge.name(), "Stake DAO agEur/ETH GUni Gauge");
        assertEq(agEurEthGauge.symbol(), "sdagEur/ETH GUni-gauge");
    }

    function test02DepositToVault() public {
        vm.startPrank(LOCAL_DEPLOYER);
        IERC20(GUNI_AGEUR_ETH_LP).approve(address(agEurEthVault), AMOUNT);
        agEurEthVault.deposit(LOCAL_DEPLOYER, AMOUNT);
        assertEq(IERC20(GUNI_AGEUR_ETH_LP).balanceOf(address(agEurEthVault)), AMOUNT);
        assertEq(agEurEthGauge.balanceOf(LOCAL_DEPLOYER), AMOUNT);
    }

    function test03WithdrawFromVault() public {
        vm.startPrank(LOCAL_DEPLOYER);
        IERC20(GUNI_AGEUR_USDC_LP).approve(address(agEurUsdcVault), AMOUNT);
        agEurUsdcVault.deposit(LOCAL_DEPLOYER, AMOUNT);
        agEurUsdcVault.withdraw(AMOUNT);
        vm.stopPrank();
        assertEq(IERC20(GUNI_AGEUR_USDC_LP).balanceOf(address(agEurUsdcVault)), 0);
        assertEq(agEurUsdcGauge.balanceOf(LOCAL_DEPLOYER), 0);
    }

    function test04WithdrawRevert() public {
        vm.startPrank(LOCAL_DEPLOYER);
        IERC20(GUNI_AGEUR_USDC_LP).approve(address(agEurUsdcVault), AMOUNT);
        agEurUsdcVault.deposit(ALICE, AMOUNT);
        vm.expectRevert(0xb1a6e9be); // NOT_ENOUGH_STAKED()
        agEurUsdcVault.withdraw(AMOUNT);
        vm.stopPrank();
        vm.prank(ALICE);
        agEurUsdcVault.withdraw(AMOUNT);
        assertEq(IERC20(GUNI_AGEUR_USDC_LP).balanceOf(address(agEurUsdcVault)), 0);
        assertEq(agEurUsdcGauge.balanceOf(LOCAL_DEPLOYER), 0);
    }
}