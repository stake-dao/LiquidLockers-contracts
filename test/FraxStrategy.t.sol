// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

// Base Tests
import "./baseTest/Base.t.sol";

import "contracts/lockers/FxsLocker.sol";
import "contracts/external/ProxyAdmin.sol";
import "contracts/strategies/frax/Booster.sol";
import "contracts/strategies/frax/FeeRegistry.sol";
import "contracts/accumulators/FxsAccumulator.sol";
import "contracts/strategies/frax/PoolRegistry.sol";
import "contracts/accumulators/veSDTFeeFraxProxy.sol";
import "contracts/sdtDistributor/SdtDistributorV2.sol";
import "contracts/external/TransparentUpgradeableProxy.sol";
import {VaultV1} from "contracts/strategies/frax/VaultV1.sol";
import {FraxStrategy} from "contracts/strategies/frax/FraxStrategy.sol";

import "contracts/interfaces/IMasterchef.sol";
import "contracts/interfaces/IGaugeController.sol";
import "contracts/interfaces/ILiquidityGaugeStratFrax.sol";

interface IFraxGauge {
    struct LockedStake {
        bytes32 kek_id;
        uint256 start_timestamp;
        uint256 liquidity;
        uint256 ending_timestamp;
        uint256 lock_multiplier; // 6 decimals of precision. 1x = 1000000
    }

    function veFXSMultiplier(address _user) external view returns (uint256);

    function lockedStakesOfLength(address _user) external view returns (uint256);

    function lockedStakesOf(address account) external view returns (LockedStake[] memory);

    function sync() external;
}

contract FraxStrategyTest is BaseTest {
    address public constant BOB = address(0xB0B);
    address public constant ALICE = address(0xAA);
    address public constant LOCAL_DEPLOYER = address(0xDE);
    address public constant FXS_TEMPLE_GAUGE = 0x10460d02226d6ef7B2419aE150E6377BdbB7Ef16;
    address public constant FRAX_GAUGE_REWARDS_DISTRIBUTOR = 0x278dC748edA1d8eFEf1aDFB518542612b49Fcd34;

    uint256 public constant AMOUNT = 1_000e18;
    uint256 public constant LOCK_DURATION = 365 days;

    VaultV1 public vault;
    VaultV1 public vaultImpl;
    Booster public booster;
    ProxyAdmin public proxyAdmin;
    FraxStrategy public strategy;
    PoolRegistry public poolRegistry;
    VeSDTFeeFraxProxy public feeProxy;
    SdtDistributorV2 public distributor;
    SdtDistributorV2 public distributorImpl;
    TransparentUpgradeableProxy public proxy;

    FxsLocker public locker = FxsLocker(0xCd3a267DE09196C48bbB1d9e842D7D7645cE448f);
    FeeRegistry public feeRegistry = FeeRegistry(0x0f1dc3Bd5fE8a3034d6Df0A411Efc7916830d19c);
    FxsAccumulator public accumulator = FxsAccumulator(0xF980B8A714Ce0cCB049f2890494b068CeC715c3f);

    IGaugeController public gaugeController;
    ILiquidityGaugeStratFrax public lgImpl;
    ILiquidityGaugeStratFrax public lgFake;
    ILiquidityGaugeStratFrax public lgFxsTemple;

    IERC20 public fxs = IERC20(Constants.FXS);
    IERC20 public sdt = IERC20(Constants.SDT);
    IERC20 public frax = IERC20(Constants.FRAX);
    IERC20 public temple = IERC20(Constants.TEMPLE);
    IERC20 public fxsTemple = IERC20(0x6021444f1706f15465bEe85463BCc7d7cC17Fc03);
    IMasterchef public masterChef = IMasterchef(0xfEA5E213bbD81A8a94D0E1eDB09dBD7CEab61e1c);
    IFraxGauge public fxsTempleFraxGauge = IFraxGauge(0x10460d02226d6ef7B2419aE150E6377BdbB7Ef16);

    function setUp() public {
        uint256 forkId = vm.createFork(vm.rpcUrl("mainnet"));
        vm.selectFork(forkId);

        address[] memory path = new address[](2);
        path[0] = address(fxs);
        path[1] = address(frax);

        vm.startPrank(LOCAL_DEPLOYER);
        // deploy all needed contracts
        gaugeController = IGaugeController(
            deployCode(
                "artifacts/contracts/dao/GaugeController.vy/GaugeController.json",
                abi.encode(Constants.SDT, Constants.VE_SDT, LOCAL_DEPLOYER)
            )
        );
        bytes memory distributorData = abi.encodeWithSignature(
            "initialize(address,address,address,address)",
            address(gaugeController),
            LOCAL_DEPLOYER,
            LOCAL_DEPLOYER,
            LOCAL_DEPLOYER
        );
        proxyAdmin = new ProxyAdmin();
        distributorImpl = new SdtDistributorV2();
        proxy = new TransparentUpgradeableProxy(address(distributorImpl), address(proxyAdmin), distributorData);
        distributor = SdtDistributorV2(address(proxy));

        poolRegistry = new PoolRegistry();
        lgImpl = ILiquidityGaugeStratFrax(
            deployCode("artifacts/contracts/staking/LiquidityGaugeV4StratFrax.vy/LiquidityGaugeV4StratFrax.json")
        );
        lgFake = ILiquidityGaugeStratFrax(
            deployCode("artifacts/contracts/staking/LiquidityGaugeV4StratFrax.vy/LiquidityGaugeV4StratFrax.json")
        );
        vaultImpl = new VaultV1();
        feeProxy = new VeSDTFeeFraxProxy(path);
        strategy = new FraxStrategy(
    ILocker(address(locker)),
    LOCAL_DEPLOYER,
    address(accumulator),
    address(feeProxy),
    address(distributor),
    LOCAL_DEPLOYER
    );
        booster = new Booster(address(locker), address(poolRegistry), address(strategy));
        vm.stopPrank();

        // Call setters
        vm.prank(LOCAL_DEPLOYER);
        strategy.toggleVault(address(booster));

        vm.prank(locker.governance());
        locker.setGovernance(address(strategy));

        // Masterchef <> SdtDistributor setup
        vm.startPrank(masterChef.owner());
        masterChef.add(1000, IERC20(distributor.masterchefToken()), false);
        vm.stopPrank();

        vm.startPrank(LOCAL_DEPLOYER);
        gaugeController.add_type("Mainnet staking", 1e18); // 0
        gaugeController.add_type("External", 1e18); // 1
        gaugeController.add_type("Cross Chain", 1e18); // 2
        distributor.initializeMasterchef(masterChef.poolLength() - 1);
        distributor.setDistribution(true);
        vm.stopPrank();

        lockSDTWhiteList(ALICE);

        deal(address(fxsTemple), ALICE, AMOUNT * 100);
    }

    function testPoolRegistry01SetBooster() public {
        assertEq(poolRegistry.operator(), address(0));
        vm.prank(LOCAL_DEPLOYER);
        poolRegistry.setOperator(address(booster));
        assertEq(poolRegistry.operator(), address(booster));
    }

    function testPoolRegistry02SetPoolReward() public {
        testPoolRegistry01SetBooster();
        assertEq(poolRegistry.rewardImplementation(), address(0));
        vm.prank(LOCAL_DEPLOYER);
        booster.setPoolRewardImplementation(address(lgImpl));
        assertEq(poolRegistry.rewardImplementation(), address(lgImpl));
    }

    function testPoolRegistry03SetDistributor() public {
        testPoolRegistry02SetPoolReward();
        vm.prank(LOCAL_DEPLOYER);
        booster.setDistributor(address(distributor));
        assertEq(poolRegistry.distributor(), address(distributor));
    }

    function testPoolRegistry04CreateNewPool() public {
        testPoolRegistry03SetDistributor();
        vm.prank(LOCAL_DEPLOYER);
        booster.addPool(address(vaultImpl), address(fxsTempleFraxGauge), address(fxsTemple));

        (address impl, address staking, address token, address reward, uint8 active) = poolRegistry.poolInfo(0);
        lgFxsTemple = ILiquidityGaugeStratFrax(reward);

        assertEq(poolRegistry.poolLength(), 1);
        assertEq(impl, address(vaultImpl));
        assertEq(staking, address(fxsTempleFraxGauge));
        assertEq(token, address(fxsTemple));
        assertEq(active, 1);
        assertEq(lgFxsTemple.admin(), LOCAL_DEPLOYER);
        assertEq(lgFxsTemple.pool_registry(), address(poolRegistry));
        assertEq(lgFxsTemple.pid(), 0);
        assertEq(lgFxsTemple.reward_count(), 1);
        assertEq(lgFxsTemple.reward_tokens(0), address(sdt));
    }

    function testPoolRegistry05CreateVault() public {
        testPoolRegistry04CreateNewPool();
        vm.prank(ALICE);
        booster.createVault(0);
        vault = VaultV1(poolRegistry.vaultMap(0, ALICE));

        assertEq(poolRegistry.poolVaultLength(0), 1);
        assertGt(fxsTempleFraxGauge.veFXSMultiplier(address(vault)), 0);
        assertEq(vault.owner(), ALICE);
        assertEq(vault.usingProxy(), address(locker));
    }

    function testPoolRegistry06CreateNewPoolRewardForExistingPool() public {
        testPoolRegistry05CreateVault();
        vm.startPrank(LOCAL_DEPLOYER);
        booster.setPoolRewardImplementation(address(lgFake));
        booster.createNewPoolRewards(0);
        vm.stopPrank();

        (address impl, address staking, address token,,) = poolRegistry.poolInfo(0);

        assertEq(poolRegistry.poolLength(), 1);
        assertEq(impl, address(vaultImpl));
        assertEq(staking, address(fxsTempleFraxGauge));
        assertEq(token, address(fxsTemple));
    }

    function testPoolRegistry07KillPool() public {
        testPoolRegistry06CreateNewPoolRewardForExistingPool();
        (,,,, uint8 active) = poolRegistry.poolInfo(0);
        assertEq(active, 1);
        vm.prank(LOCAL_DEPLOYER);
        booster.deactivatePool(0);
        (,,,, active) = poolRegistry.poolInfo(0);
        assertEq(active, 0);
    }

    function testPoolRegistry08AddGauge() public {
        testPoolRegistry05CreateVault();
        vm.prank(gaugeController.admin());
        gaugeController.add_gauge(address(lgFxsTemple), 0, 0);
        vm.prank(ALICE);
        gaugeController.vote_for_gauge_weights(address(lgFxsTemple), 10000);
        vm.prank(LOCAL_DEPLOYER);
        distributor.approveGauge(address(lgFxsTemple));

        timeJump(8 days);
        vm.prank(LOCAL_DEPLOYER);
        uint256 balanceBefore = sdt.balanceOf(address(lgFxsTemple));
        distributor.distribute(address(lgFxsTemple));

        assertGt(gaugeController.get_gauge_weight(address(lgFxsTemple)), 0);
        assertGt(gaugeController.gauge_relative_weight(address(lgFxsTemple)), 0);
        assertGt(sdt.balanceOf(address(lgFxsTemple)), balanceBefore);
    }

    function testPoolRegistry09Revert() public {
        vm.expectRevert(bytes("!auth"));
        poolRegistry.setOperator(ALICE);
        vm.expectRevert(bytes("!auth"));
        booster.setPoolRewardImplementation(ALICE);
        vm.expectRevert(bytes("!auth"));
        booster.addPool(address(vault), address(fxsTempleFraxGauge), address(fxsTemple));

        testPoolRegistry04CreateNewPool();

        vm.startPrank(LOCAL_DEPLOYER);
        vm.expectRevert(bytes("!imp"));
        booster.addPool(address(0), address(fxsTempleFraxGauge), address(fxsTemple));
        vm.expectRevert(bytes("!stkAdd"));
        booster.addPool(address(vaultImpl), address(0), address(fxsTemple));
        vm.expectRevert(bytes("!stkTok"));
        booster.addPool(address(vaultImpl), address(fxsTempleFraxGauge), address(0));
        vm.stopPrank();

        vm.startPrank(ALICE);
        vm.expectRevert(bytes("!op auth"));
        poolRegistry.addUserVault(0, ALICE);
        booster.createVault(0);
        vm.expectRevert(bytes("already exists"));
        booster.createVault(0);
    }

    function testVault01StakeLP() public {
        testPoolRegistry08AddGauge();
        vm.startPrank(ALICE);
        fxsTemple.approve(address(vault), type(uint256).max);
        vault.stakeLocked(AMOUNT, LOCK_DURATION);
        vm.stopPrank();

        assertEq(lgFxsTemple.balanceOf(ALICE), AMOUNT);
        assertEq(lgFxsTemple.totalSupply(), AMOUNT);
        assertEq(fxsTempleFraxGauge.lockedStakesOfLength(address(vault)), 1);
        assertEq(fxsTempleFraxGauge.lockedStakesOf(address(vault))[0].liquidity, AMOUNT);
        assertTrue(fxsTempleFraxGauge.lockedStakesOf(address(vault))[0].kek_id != bytes32(0));
    }

    function testVault02AddLiquidity() public {
        testVault01StakeLP();
        vm.startPrank(ALICE);
        vault.lockAdditional(fxsTempleFraxGauge.lockedStakesOf(address(vault))[0].kek_id, AMOUNT);
        vm.stopPrank();
        assertEq(fxsTempleFraxGauge.lockedStakesOf(address(vault))[0].liquidity, AMOUNT * 2);
        assertEq(lgFxsTemple.balanceOf(ALICE), AMOUNT * 2);
        assertEq(lgFxsTemple.totalSupply(), AMOUNT * 2);
    }

    function testVault03GetReward() public {
        testVault01StakeLP();
        timeJump(1 days);

        uint256 balanceBeforeAcc = fxs.balanceOf(feeRegistry.accumulator());
        uint256 balanceBeforeMul = fxs.balanceOf(feeRegistry.multiSig());
        vm.prank(ALICE);
        vault.getReward();

        assertGt(temple.balanceOf(ALICE), 0);
        assertGt(fxs.balanceOf(ALICE), 0);
        assertGt(sdt.balanceOf(ALICE), 0);
        assertGt(fxs.balanceOf(feeRegistry.accumulator()), balanceBeforeAcc);
        assertGt(fxs.balanceOf(feeRegistry.multiSig()), balanceBeforeMul);
    }

    function testVault04GetRewardWithoutClaim() public {
        testVault01StakeLP();
        timeJump(1 days);

        vm.prank(ALICE);
        vault.getReward(false);

        assertEq(temple.balanceOf(ALICE), 0);
        assertEq(fxs.balanceOf(ALICE), 0);
        assertGt(sdt.balanceOf(ALICE), 0);
    }

    function testVault05GetSpecificReward() public {
        testVault01StakeLP();
        timeJump(1 days);

        address[] memory addresses = new address[](0);
        vm.prank(ALICE);
        vault.getReward(true, addresses);

        assertEq(temple.balanceOf(ALICE), 0);
        assertGt(fxs.balanceOf(ALICE), 0);
        assertGt(sdt.balanceOf(ALICE), 0);
    }

    function testVault06Withdraw() public {
        testVault01StakeLP();
        timeJump(LOCK_DURATION);
        transferFXS(FRAX_GAUGE_REWARDS_DISTRIBUTOR, AMOUNT);
        fxsTempleFraxGauge.sync();

        vm.startPrank(ALICE);
        vault.withdrawLocked(fxsTempleFraxGauge.lockedStakesOf(address(vault))[0].kek_id, true);
        vm.stopPrank();

        assertGt(temple.balanceOf(ALICE), 0);
        assertGt(fxs.balanceOf(ALICE), 0);
        assertGt(sdt.balanceOf(ALICE), 0);
        assertEq(lgFxsTemple.balanceOf(ALICE), 0);
        assertEq(lgFxsTemple.totalSupply(), 0);
    }

    function testVault07Revert() public {
        testVault01StakeLP();
        vm.expectRevert(bytes("!auth"));
        vault.stakeLocked(AMOUNT, LOCK_DURATION);

        vm.prank(feeRegistry.owner());
        vm.expectRevert("!address(0)");
        feeRegistry.setMultisig(address(0));

        vm.startPrank(ALICE);
        vm.expectRevert("Stake not found");
        vault.lockAdditional(bytes32("0x0123"), AMOUNT);

        bytes32 kekId = fxsTempleFraxGauge.lockedStakesOf(address(vault))[0].kek_id;
        vm.expectRevert("Stake is still locked!");
        vault.withdrawLocked(kekId, false);
        vm.expectRevert("!only personal vault");
        vault.changeRewards();
    }

    function testBooster01Setter() public {
        vm.prank(LOCAL_DEPLOYER);
        booster.setPendingOwner(ALICE);

        vm.prank(ALICE);
        booster.acceptPendingOwner();
        assertEq(booster.owner(), ALICE);

        vm.prank(ALICE);
        booster.setPoolManager(BOB);

        assertEq(booster.poolManager(), BOB);
    }

    function testFeeRegistry01SetNewFee() public {
        vm.prank(feeRegistry.owner());
        feeRegistry.setFees(100, 200, 400);
        assertEq(feeRegistry.multisigPart(), 100);
        assertEq(feeRegistry.accumulatorPart(), 200);
        assertEq(feeRegistry.veSDTPart(), 400);
        assertEq(feeRegistry.totalFees(), 100 + 200 + 400);
    }

    function testFeeRegistry02SetNewAddresses() public {
        vm.startPrank(feeRegistry.owner());
        feeRegistry.setAccumulator(address(0x1));
        feeRegistry.setMultisig(address(0x2));
        feeRegistry.setVeSDTFeeProxy(address(0x3));
        vm.stopPrank();

        assertEq(feeRegistry.accumulator(), address(0x1));
        assertEq(feeRegistry.multiSig(), address(0x2));
        assertEq(feeRegistry.veSDTFeeProxy(), address(0x3));
    }

    function testFeeRegistry03Revert() public {
        vm.expectRevert("!auth");
        feeRegistry.setFees(1, 1, 1);
        vm.startPrank(feeRegistry.owner());
        vm.expectRevert("fees over");
        feeRegistry.setFees(15000, 1, 1);
        vm.expectRevert("!address(0)");
        feeRegistry.setMultisig(address(0));
    }

    function testVeSDTFraxProxy() public {
        transferFXS(address(feeProxy), AMOUNT);
        vm.prank(BOB);
        feeProxy.sendRewards();

        assertEq(fxs.balanceOf(address(feeProxy)), 0);
        assertGt(frax.balanceOf(BOB), 0);
        assertGt(IERC20(Constants.SDFRAX3CRV).balanceOf(feeProxy.FEE_DISTRIBUTOR()), 0);
    }

    function transferFXS(address to, uint256 amount) internal {
        vm.prank(Constants.FXS_WHALE);
        fxs.transfer(to, amount);
    }
}
