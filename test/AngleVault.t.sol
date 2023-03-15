// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

// Base Tests
import "./baseTest/Base.t.sol";

import "contracts/external/ProxyAdmin.sol";
import "contracts/lockers/AngleLocker.sol";
import "contracts/factories/AngleVaultFactory.sol";
import "contracts/strategies/angle/AngleVault.sol";
import "contracts/strategies/angle/AngleStrategy.sol";
import "contracts/accumulators/AngleAccumulatorV2.sol";
import "contracts/accumulators/veSDTFeeAngleProxy.sol";
import "contracts/sdtDistributor/SdtDistributorV2.sol";
import "contracts/strategies/angle/AngleVaultGUni.sol";
import "contracts/external/TransparentUpgradeableProxy.sol";

import "contracts/interfaces/IMasterchef.sol";
import "contracts/interfaces/ISmartWalletChecker.sol";
import "contracts/interfaces/ILiquidityGaugeStrat.sol";

contract AngleVaultTest is BaseTest {
    address public constant BOB = address(0xB0B);
    address public constant ALICE = address(0xAA);
    address public constant LOCAL_DEPLOYER = address(0xDE);
    address public constant GUNI_AGEUR_WETH_LP = 0x857E0B2eD0E82D5cDEB015E77ebB873C47F99575;
    address public constant GUNI_AGEUR_WETH_ANGLE_GAUGE = 0x3785Ce82be62a342052b9E5431e9D3a839cfB581;

    uint256 public constant AMOUNT = 1_000e18;

    AngleVault public vaultUSDC;
    AngleVault public vaultDAI;
    ProxyAdmin public proxyAdmin;
    AngleStrategy public strategy;
    AngleVaultGUni public vaultGUNI;
    SdtDistributorV2 public distributor;
    SdtDistributorV2 public distributorImpl;
    AngleVaultFactory public factory;
    veSDTFeeAngleProxy public feeProxy;
    TransparentUpgradeableProxy public proxy;

    AngleLocker public locker = AngleLocker(0xD13F8C25CceD32cdfA79EB5eD654Ce3e484dCAF5);
    AngleAccumulatorV2 public accumulator = AngleAccumulatorV2(0x943671e6c3A98E28ABdBc60a7ac703b3c0C6aA51);

    IGaugeController public gaugeController;
    ILiquidityGaugeStrat public liquidityGaugeDAI;
    ILiquidityGaugeStrat public liquidityGaugeUSDC;
    ILiquidityGaugeStrat public liquidityGaugeGUNI;
    ILiquidityGaugeStrat public liquidityGaugeStratImpl;

    IERC20 public guni = IERC20(GUNI_AGEUR_WETH_LP);
    IERC20 public sandaieur = IERC20(AddressBook.SAN_DAI_EUR);
    IERC20 public sanusdceur = IERC20(AddressBook.SAN_USDC_EUR);

    IMasterchef public masterChef = IMasterchef(0xfEA5E213bbD81A8a94D0E1eDB09dBD7CEab61e1c);
    ILiquidityGauge public gaugeSdAngle = ILiquidityGauge(0xE55843a90672f7d8218285e51EE8fF8E233F35d5);
    ILiquidityGauge public gaugeGUniEur = ILiquidityGauge(0x3785Ce82be62a342052b9E5431e9D3a839cfB581);
    ILiquidityGauge public liquidityGaugeAngleGUNI = ILiquidityGauge(GUNI_AGEUR_WETH_ANGLE_GAUGE);
    ILiquidityGauge public liquidityGaugeAngleDAI = ILiquidityGauge(0x8E2c0CbDa6bA7B65dbcA333798A3949B07638026);
    ILiquidityGauge public liquidityGaugeAngleUSDC = ILiquidityGauge(0x51fE22abAF4a26631b2913E417c0560D547797a7);

    function setUp() public {
        uint256 forkId = vm.createFork(vm.rpcUrl("mainnet"));
        vm.selectFork(forkId);

        address[] memory path = new address[](3);
        path[0] = AddressBook.ANGLE;
        path[1] = AddressBook.WETH;
        path[2] = AddressBook.FRAX;

        vm.startPrank(LOCAL_DEPLOYER);
        feeProxy = new veSDTFeeAngleProxy(path);
        proxyAdmin = new ProxyAdmin();
        distributorImpl = new SdtDistributorV2();
        gaugeController = IGaugeController(
            deployCode(
                "artifacts/vyper-contracts/GaugeController.vy/GaugeController.json",
                abi.encode(AddressBook.SDT, AddressBook.VE_SDT, LOCAL_DEPLOYER)
            )
        );
        liquidityGaugeStratImpl = ILiquidityGaugeStrat(
            deployCode("artifacts/vyper-contracts/LiquidityGaugeV4Strat.vy/LiquidityGaugeV4Strat.json")
        );
        bytes memory distributorData = abi.encodeWithSignature(
            "initialize(address,address,address,address)",
            address(gaugeController),
            LOCAL_DEPLOYER,
            LOCAL_DEPLOYER,
            LOCAL_DEPLOYER
        );
        proxy = new TransparentUpgradeableProxy(address(distributorImpl), address(proxyAdmin), distributorData);
        distributor = SdtDistributorV2(address(proxy));
        strategy = new AngleStrategy(
    ILocker(address(locker)),
    LOCAL_DEPLOYER,
    LOCAL_DEPLOYER,
    AngleAccumulator(address(0)),
    address(feeProxy),
    address(distributor)
    );
        strategy.setAccumulator(address(accumulator));
        factory = new AngleVaultFactory(address(liquidityGaugeStratImpl), address(strategy), address(distributor));
        strategy.setVaultGaugeFactory(address(factory));

        // Clone and Init
        vm.recordLogs();
        factory.cloneAndInit(address(liquidityGaugeAngleUSDC));
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes memory eventData1 = logs[0].data;
        bytes memory eventData3 = logs[2].data;
        vaultUSDC = AngleVault(bytesToAddressCustom(eventData1, 32));
        liquidityGaugeUSDC = ILiquidityGaugeStrat(bytesToAddressCustom(eventData3, 32));

        // Add gauge type
        gaugeController.add_type("Mainnet staking", 1e18); // 0
        gaugeController.add_type("External", 1e18); // 1
        gaugeController.add_type("Cross Chain", 1e18); // 2
        gaugeController.add_gauge(address(liquidityGaugeUSDC), 0, 0);
        vm.stopPrank();

        // Masterchef <> SdtDistributor setup
        IERC20 masterToken = distributor.masterchefToken();
        vm.prank(masterChef.owner());
        masterChef.add(1000, masterToken, false);

        vm.startPrank(LOCAL_DEPLOYER);
        distributor.initializeMasterchef(masterChef.poolLength() - 1);
        distributor.setDistribution(true);
        vaultGUNI = new AngleVaultGUni(
    ERC20(GUNI_AGEUR_WETH_LP),
    LOCAL_DEPLOYER,
    "Stake DAO GUniAgeur/ETH Vault",
    "sdGUniAgeur/ETH-vault",
    strategy,
    966923637982619002
    );
        bytes memory lgData = abi.encodeWithSignature(
            "initialize(address,address,address,address,address,address,address,string)",
            address(vaultGUNI),
            LOCAL_DEPLOYER,
            AddressBook.SDT,
            AddressBook.VE_SDT,
            AddressBook.VE_SDT_BOOST_PROXY, // to mock
            address(strategy),
            address(vaultGUNI),
            "agEur/ETH"
        );
        proxy = new TransparentUpgradeableProxy(address(liquidityGaugeStratImpl), address(proxyAdmin), lgData);
        liquidityGaugeGUNI = ILiquidityGaugeStrat(address(proxy));
        vaultGUNI.setLiquidityGauge(address(liquidityGaugeGUNI));
        strategy.toggleVault(address(vaultGUNI));
        strategy.setGauge(GUNI_AGEUR_WETH_LP, GUNI_AGEUR_WETH_ANGLE_GAUGE);
        strategy.setMultiGauge(GUNI_AGEUR_WETH_ANGLE_GAUGE, address(liquidityGaugeGUNI));
        vm.stopPrank();

        vm.prank(locker.governance());
        locker.setGovernance(address(strategy));

        vm.prank(IVeToken(AddressBook.VE_SDT).admin());
        ISmartWalletChecker(AddressBook.SDT_SMART_WALLET_CHECKER).approveWallet(LOCAL_DEPLOYER);

        deal(AddressBook.SAN_USDC_EUR, LOCAL_DEPLOYER, AMOUNT * 100);
        deal(AddressBook.SAN_DAI_EUR, LOCAL_DEPLOYER, AMOUNT * 100);
        deal(AddressBook.SDT, LOCAL_DEPLOYER, AMOUNT * 100);
        deal(GUNI_AGEUR_WETH_LP, LOCAL_DEPLOYER, AMOUNT * 100);
        lockSDTCustom(LOCAL_DEPLOYER, AddressBook.SDT, AddressBook.VE_SDT, AMOUNT, block.timestamp + (4 * 365 days));

        vm.startPrank(LOCAL_DEPLOYER);
        sanusdceur.approve(address(vaultUSDC), type(uint256).max);
        guni.approve(address(vaultGUNI), type(uint256).max);
        vm.stopPrank();
    }

    function test01LGSettings() public {
        assertEq(liquidityGaugeUSDC.name(), "Stake DAO sanUSDC_EUR Gauge");
        assertEq(liquidityGaugeUSDC.symbol(), "sdsanUSDC_EUR-gauge");
    }

    function test02DepositSanUSDCToVault() public {
        vm.prank(LOCAL_DEPLOYER);
        vaultUSDC.deposit(LOCAL_DEPLOYER, AMOUNT, false);
        assertEq(sanusdceur.balanceOf(address(vaultUSDC)), AMOUNT);
        assertEq(liquidityGaugeUSDC.balanceOf(LOCAL_DEPLOYER), (AMOUNT * 999) / 1000);
    }

    function test03WithdrawFromVault() public {
        vm.startPrank(LOCAL_DEPLOYER);
        vaultUSDC.deposit(LOCAL_DEPLOYER, AMOUNT, false);
        vaultUSDC.withdraw(liquidityGaugeUSDC.balanceOf(LOCAL_DEPLOYER));
        vm.stopPrank();
        assertEq(sanusdceur.balanceOf(address(vaultUSDC)), (AMOUNT * 1) / 1000);
        assertEq(liquidityGaugeUSDC.balanceOf(LOCAL_DEPLOYER), 0);
    }

    function test04WithdrawRevert() public {
        vm.startPrank(LOCAL_DEPLOYER);
        vaultUSDC.deposit(LOCAL_DEPLOYER, AMOUNT, false);
        uint256 balanceBefore = liquidityGaugeUSDC.balanceOf(LOCAL_DEPLOYER);
        liquidityGaugeUSDC.transfer(ALICE, AMOUNT / 2);
        vm.expectRevert(bytes("Not enough staked"));
        vaultUSDC.withdraw(balanceBefore);
        vm.stopPrank();
    }

    function test05WithdrawRevert() public {
        vm.expectRevert();
        liquidityGaugeUSDC.withdraw(AMOUNT, ALICE);
    }

    function test06ApproveVaultRevert() public {
        vm.expectRevert("!governance && !factory");
        strategy.toggleVault(address(vaultUSDC));
    }

    function test07AddGaugeRevert() public {
        vm.expectRevert("!governance && !factory");
        strategy.setGauge(address(sanusdceur), address(liquidityGaugeAngleUSDC));
    }

    function test08GetAccumulatedFee() public {
        vm.prank(LOCAL_DEPLOYER);
        vaultUSDC.deposit(LOCAL_DEPLOYER, AMOUNT, false);
        uint256 accumulatedFee = vaultUSDC.accumulatedFee();
        vm.prank(ALICE);
        vaultUSDC.deposit(ALICE, 0, true);
        assertGt(liquidityGaugeAngleUSDC.balanceOf(address(locker)), AMOUNT);
        assertEq(sanusdceur.balanceOf(address(vaultUSDC)), 0);
        assertEq(liquidityGaugeUSDC.balanceOf(ALICE), accumulatedFee);
    }

    function test09ClaimReward() public {
        vm.startPrank(LOCAL_DEPLOYER);
        distributor.approveGauge(address(liquidityGaugeUSDC));
        gaugeController.vote_for_gauge_weights(address(liquidityGaugeUSDC), 10000);
        vaultUSDC.deposit(LOCAL_DEPLOYER, AMOUNT, true);
        timeJump(30 days);

        uint256 claimable = liquidityGaugeAngleUSDC.claimable_reward(address(locker), AddressBook.ANGLE);
        uint256 balanceBeforeAccumulator = IERC20(AddressBook.ANGLE).balanceOf(address(accumulator));

        vm.recordLogs();
        strategy.claim(address(sanusdceur));
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 claimed = sliceUint(logs[logs.length - 1].data, 2 * 32);

        assertGt(claimed, 0);
        assertEq(claimable, claimed);
        assertGt(liquidityGaugeUSDC.reward_data(AddressBook.ANGLE).rate, 0);
        assertGt(liquidityGaugeUSDC.reward_data(AddressBook.SDT).rate, 0);
        assertEq(gaugeController.gauge_relative_weight(address(liquidityGaugeUSDC)), 1e18);
        assertEq(
            IERC20(AddressBook.ANGLE).balanceOf(address(accumulator)) - balanceBeforeAccumulator,
            (claimed * 800) / 10_000
        );
    }

    function test10GetMaxBoost() public {
        vm.prank(LOCAL_DEPLOYER);
        vaultUSDC.deposit(LOCAL_DEPLOYER, AMOUNT, true);
        uint256 workingBalance = liquidityGaugeAngleUSDC.working_balances(address(locker));
        uint256 stakedAmount = liquidityGaugeAngleUSDC.balanceOf(address(locker));
        uint256 boost = (workingBalance * 10e18) / (stakedAmount * 4);
        assertApproxEqRel(boost, 25e17, 40e16); // ± 40% due to the uge amount of veANGLE owned by LL
    }

    function test11UseFeeDistributor() public {
        deal(AddressBook.ANGLE, address(feeProxy), 10_000e18);
        uint256 balanceBeforeClaimer = IERC20(AddressBook.FRAX).balanceOf(LOCAL_DEPLOYER);
        uint256 balanceBeforeFeeDist = IERC20(AddressBook.SDFRAX3CRV).balanceOf(AddressBook.FEE_D_SD);
        vm.prank(LOCAL_DEPLOYER);
        feeProxy.sendRewards();
        uint256 balanceAfterClaimer = IERC20(AddressBook.FRAX).balanceOf(LOCAL_DEPLOYER);
        uint256 balanceAfterFeeDist = IERC20(AddressBook.SDFRAX3CRV).balanceOf(AddressBook.FEE_D_SD);

        assertGt(balanceAfterClaimer, balanceBeforeClaimer);
        assertGt(balanceAfterFeeDist, balanceBeforeFeeDist);
    }

    function test12AccumulateAngleRewardToSdAngle() public {
        uint256 balanceBeforeAngleGauge = IERC20(AddressBook.ANGLE).balanceOf(address(gaugeSdAngle));

        vm.prank(gaugeSdAngle.admin());
        gaugeSdAngle.set_reward_distributor(AddressBook.ANGLE, address(accumulator));

        deal(AddressBook.ANGLE, address(accumulator), AMOUNT);
        vm.startPrank(accumulator.governance());
        accumulator.setGauge(address(gaugeSdAngle));
        accumulator.notifyAllExtraReward(AddressBook.ANGLE);
        uint256 balanceAfterAngleGauge = IERC20(AddressBook.ANGLE).balanceOf(address(gaugeSdAngle));
        uint256 balanceAfterAccumulato = IERC20(AddressBook.ANGLE).balanceOf(address(accumulator));

        assertGt(balanceAfterAngleGauge, balanceBeforeAngleGauge);
        assertEq(balanceAfterAccumulato, 0);
    }

    function test13CreateNewVault() public {
        vm.startPrank(LOCAL_DEPLOYER);
        // Clone and Init
        vm.recordLogs();
        factory.cloneAndInit(address(liquidityGaugeAngleDAI));
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes memory eventData1 = logs[0].data;
        bytes memory eventData3 = logs[2].data;
        vaultDAI = AngleVault(bytesToAddressCustom(eventData1, 32));
        liquidityGaugeDAI = ILiquidityGaugeStrat(bytesToAddressCustom(eventData3, 32));
        gaugeController.add_gauge(address(liquidityGaugeDAI), 0, 0);
        distributor.approveGauge(address(liquidityGaugeDAI));
        vm.stopPrank();
        assertEq(address(vaultDAI.token()), AddressBook.SAN_DAI_EUR);
    }

    function test14DepositToNewVault() public {
        test13CreateNewVault();
        vm.startPrank(LOCAL_DEPLOYER);
        sandaieur.approve(address(vaultDAI), type(uint256).max);
        vaultDAI.deposit(LOCAL_DEPLOYER, AMOUNT, false);
        vm.stopPrank();
        assertEq(sandaieur.balanceOf(address(vaultDAI)), AMOUNT);
        assertEq(liquidityGaugeDAI.balanceOf(LOCAL_DEPLOYER), (AMOUNT * 999) / 1000);
    }

    function test15CallEarn() public {
        uint256 balanceBefore = liquidityGaugeAngleDAI.balanceOf(address(locker));
        test14DepositToNewVault();
        vm.prank(ALICE);
        vaultDAI.deposit(ALICE, 0, true);
        assertEq(liquidityGaugeAngleDAI.balanceOf(address(locker)) - balanceBefore, AMOUNT);
    }

    // It should distribute for one gauge for during 44 days then it should distribute other gauge rewards at once for 44days
    function test16DistributeRewardsFor2Gauge() public {
        test15CallEarn();
        vm.startPrank(LOCAL_DEPLOYER);
        distributor.approveGauge(address(liquidityGaugeUSDC));
        gaugeController.vote_for_gauge_weights(address(liquidityGaugeUSDC), 5000);
        gaugeController.vote_for_gauge_weights(address(liquidityGaugeDAI), 5000);
        vm.stopPrank();
        timeJump(8 days);
        vm.prank(0x4f91F01cE8ec07c9B1f6a82c18811848254917Ab); // Angle depositor
        liquidityGaugeAngleDAI.deposit_reward_token(AddressBook.ANGLE, AMOUNT);
        vm.prank(LOCAL_DEPLOYER);
        strategy.claim(address(sandaieur));

        for (uint8 i; i < 44; ++i) {
            timeJump(1 days);
            vm.prank(LOCAL_DEPLOYER);
            strategy.claim(address(sandaieur));
            if (i % 7 == 0) {
                vm.prank(0x4f91F01cE8ec07c9B1f6a82c18811848254917Ab); // Angle depositor
                liquidityGaugeAngleDAI.deposit_reward_token(AddressBook.ANGLE, AMOUNT);
                vm.prank(0x4f91F01cE8ec07c9B1f6a82c18811848254917Ab); // Angle depositor
                liquidityGaugeAngleUSDC.deposit_reward_token(AddressBook.ANGLE, AMOUNT);
            }
        }
        vm.prank(LOCAL_DEPLOYER);
        strategy.claim(address(sanusdceur));
        assertEq(IERC20(AddressBook.SDT).balanceOf(address(distributor)), 0);
    }

    function test17StakeGUNIToken() public {
        uint256 balanceBefore = liquidityGaugeAngleGUNI.balanceOf(address(locker));
        vm.prank(LOCAL_DEPLOYER);
        vaultGUNI.deposit(LOCAL_DEPLOYER, AMOUNT, true);
        uint256 balanceAfter = liquidityGaugeAngleGUNI.balanceOf(address(locker));
        uint256 scalingFactor = vaultGUNI.scalingFactor();
        uint256 scaledDown = (AMOUNT * scalingFactor) / (1e18);
        assertEq(balanceAfter - balanceBefore, scaledDown);
    }

    function test18WithdrawAll() public {
        test17StakeGUNIToken();
        uint256 balanceBefore = liquidityGaugeGUNI.balanceOf(LOCAL_DEPLOYER);
        vm.prank(LOCAL_DEPLOYER);
        vaultGUNI.withdraw(balanceBefore);
        uint256 balanceAfter = liquidityGaugeGUNI.balanceOf(LOCAL_DEPLOYER);

        assertGt(balanceBefore, 0);
        assertLt(balanceAfter, 10);
    }

    function test19WithdrawPartially() public {
        uint256 before = liquidityGaugeAngleGUNI.balanceOf(address(locker));
        vm.startPrank(LOCAL_DEPLOYER);
        vaultGUNI.deposit(LOCAL_DEPLOYER, AMOUNT, true);
        vaultGUNI.deposit(LOCAL_DEPLOYER, AMOUNT, false);
        uint256 balanceBeforeGauge = liquidityGaugeAngleGUNI.balanceOf(address(locker));
        uint256 balanceBefore = liquidityGaugeGUNI.balanceOf(LOCAL_DEPLOYER);
        vaultGUNI.withdraw(balanceBefore);
        uint256 balanceAfter = liquidityGaugeGUNI.balanceOf(LOCAL_DEPLOYER);
        uint256 balanceAfterGauge = liquidityGaugeAngleGUNI.balanceOf(address(locker));
        uint256 scalingFactor = vaultGUNI.scalingFactor();
        uint256 scaledDown = (AMOUNT * scalingFactor) / (1e18);
        assertGt(balanceBefore, 0);
        assertLt(balanceAfter, 10);
        assertEq(balanceAfterGauge - before, 0);
        assertEq(balanceBeforeGauge - before, scaledDown);
    }
}
