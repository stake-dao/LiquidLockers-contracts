// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

// Base Tests
import "./baseTest/Base.t.sol";
import {VaultV2} from "contracts/strategies/frax/VaultV2.sol";
import {FraxStrategy} from "contracts/strategies/frax/FraxStrategy.sol";
import {PoolRegistry} from "contracts/strategies/frax/PoolRegistry.sol";
import {Booster} from "contracts/strategies/frax/Booster.sol";

interface FraxGauge {
    struct LockedStake {
        bytes32 kek_id;
        uint256 start_timestamp;
        uint256 liquidity;
        uint256 ending_timestamp;
        uint256 lock_multiplier; // 6 decimals of precision. 1x = 1000000
    }

    function toggleValidVeFXSProxy(address _proxy_addr) external;

    function lockedStakesOf(address _user)
        external
        view
        returns (LockedStake[] memory);

    function veFXSMultiplier(address _user) external view returns (uint256);
}

contract FraxVaultV2Test is BaseTest {
    address public constant FRAX_STRATEGY =
        0xf285Dec3217E779353350443fC276c07D05917c3;
    address public constant POOL_REGISRTRY =
        0xd4525E29111edD74eAA425AB4c0Bc507bE3aC69F;
    address public constant STAKEDAO_DEPLOYER =
        0x0dE5199779b43E13B3Bec21e91117E18736BC1A8;
    address SDT_FRAXBP_GAUGE = 0x9C8d9667d5726aEcA4d24171958BeE9F46861bed;
    address SDT_FRAXBP_CONVEX_STAKING_TOKEN =
        0xE6Aa75F98e6c105b821a2dba9Fbbd886b421F06b;
    address SDT_FRAXBP_CURVE_LP_TOKEN =
        address(0x893DA8A02b487FEF2F7e3F35DF49d7625aE549a3);

    address public constant BOOSTER =
        0x3f7c5021f5Bc634fae82cf9F67F19C5f05562bD3;
    address public constant FRAX_GOVERNANCE =
        0xB1748C79709f4Ba2Dd82834B8c82D4a505003f27;
    address public constant FRAX_LOCKER =
        0xCd3a267DE09196C48bbB1d9e842D7D7645cE448f;
    address public constant OHM_FRAXBP_GAUGE =
        0xc96e1a26264D965078bd01eaceB129A65C09FFE7;
    address public constant OHM_FRAXBP_CONVEX_STAKING_TOKEN =
        0x81b0dCDa53482A2EA9eb496342dC787643323e95;
    address public constant OHM_FRAXBP_CURVE_LP_TOKEN =
        0x5271045F7B73c17825A7A7aee6917eE46b0B7520;

    address public constant FXS = 0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0;
    address public constant CRV = 0xD533a949740bb3306d119CC777fa900bA034cd52;
    uint256 public sdtFraxBPPid;
    uint256 public ohmFraxBPPid;
    VaultV2 vaultImpl;
    FraxStrategy strategy;
    PoolRegistry registry;
    Booster booster;

    function setUp() public {
        uint256 forkId = vm.createFork(vm.rpcUrl("mainnet"));
        vm.selectFork(forkId);
        strategy = FraxStrategy(FRAX_STRATEGY);
        registry = PoolRegistry(POOL_REGISRTRY);
        booster = Booster(BOOSTER);
        vaultImpl = new VaultV2();
        vm.prank(STAKEDAO_DEPLOYER);
        booster.addPool(
            address(vaultImpl),
            SDT_FRAXBP_GAUGE,
            SDT_FRAXBP_CONVEX_STAKING_TOKEN
        );
        uint256 poolLength = registry.poolLength();
        sdtFraxBPPid = poolLength - 1;
        vm.prank(FRAX_GOVERNANCE);
        FraxGauge(SDT_FRAXBP_GAUGE).toggleValidVeFXSProxy(address(FRAX_LOCKER));
        vm.prank(STAKEDAO_DEPLOYER);
        booster.addPool(
            address(vaultImpl),
            OHM_FRAXBP_GAUGE,
            OHM_FRAXBP_CONVEX_STAKING_TOKEN
        );
        poolLength = registry.poolLength();
        ohmFraxBPPid = poolLength - 1;
        vm.prank(FRAX_GOVERNANCE);
        FraxGauge(OHM_FRAXBP_GAUGE).toggleValidVeFXSProxy(address(FRAX_LOCKER));
    }

    function testCreateVault() public {
        address vaultAddressBefore = registry.vaultMap(
            sdtFraxBPPid,
            address(this)
        );
        booster.createVault(sdtFraxBPPid);
        address vaultAddressAfter = registry.vaultMap(
            sdtFraxBPPid,
            address(this)
        );
        assertTrue(vaultAddressBefore == address(0));
        assertTrue(vaultAddressAfter != address(0));
    }

    function testDepositVault() public {
        uint256 amount = 10000e18;
        deal(SDT_FRAXBP_CURVE_LP_TOKEN, address(this), amount);
        booster.createVault(sdtFraxBPPid);
        address vaultAddress = registry.vaultMap(sdtFraxBPPid, address(this));
        VaultV2 vault = VaultV2(vaultAddress);
        IERC20(SDT_FRAXBP_CURVE_LP_TOKEN).approve(vaultAddress, amount);
        vault.stakeLockedCurveLp(amount, 94608000);
        uint256 veFXSMultiplier = FraxGauge(SDT_FRAXBP_GAUGE).veFXSMultiplier(
            vaultAddress
        );
        FraxGauge.LockedStake memory lockedStake = FraxGauge(SDT_FRAXBP_GAUGE)
            .lockedStakesOf(vaultAddress)[0];

        uint256 boost = (lockedStake.lock_multiplier + veFXSMultiplier);
        assertEq(boost, 4e18); // Max boost is 4x
    }

    function testGetRewards() public {
        uint256 amount = 10000e18;
        deal(SDT_FRAXBP_CURVE_LP_TOKEN, address(this), amount);
        booster.createVault(sdtFraxBPPid);
        address vaultAddress = registry.vaultMap(sdtFraxBPPid, address(this));
        VaultV2 vault = VaultV2(vaultAddress);
        IERC20(SDT_FRAXBP_CURVE_LP_TOKEN).approve(vaultAddress, amount);
        vault.stakeLockedCurveLp(amount, 94608000);
        skip(7 days);
        uint256 crvBalanceBefore = IERC20(CRV).balanceOf(address(this));
        uint256 fxsBalanceBefore = IERC20(FXS).balanceOf(address(this));
        vault.getReward();
        uint256 crvBalanceAfter = IERC20(CRV).balanceOf(address(this));
        uint256 fxsBalanceAfter = IERC20(FXS).balanceOf(address(this));
        assertEq(crvBalanceBefore, 0);
        assertEq(fxsBalanceBefore, 0);
        assertGt(crvBalanceAfter, 0);
        assertGt(fxsBalanceAfter, 0);
    }

    function testCreateOhmFraxBpVault() public {
        address vaultAddressBefore = registry.vaultMap(
            ohmFraxBPPid,
            address(this)
        );
        booster.createVault(ohmFraxBPPid);
        address vaultAddressAfter = registry.vaultMap(
            ohmFraxBPPid,
            address(this)
        );
        assertTrue(vaultAddressBefore == address(0));
        assertTrue(vaultAddressAfter != address(0));
    }

    function testOhmFraxBpVault() public {
        uint256 amount = 100000e18;
        deal(OHM_FRAXBP_CURVE_LP_TOKEN, address(this), amount);
        booster.createVault(ohmFraxBPPid);
        address vaultAddress = registry.vaultMap(ohmFraxBPPid, address(this));
        VaultV2 vault = VaultV2(vaultAddress);
        IERC20(OHM_FRAXBP_CURVE_LP_TOKEN).approve(vaultAddress, amount);
        vault.stakeLockedCurveLp(amount, 94608000);
        uint256 veFXSMultiplier = FraxGauge(OHM_FRAXBP_GAUGE).veFXSMultiplier(
            vaultAddress
        );
        FraxGauge.LockedStake memory lockedStake = FraxGauge(OHM_FRAXBP_GAUGE)
            .lockedStakesOf(vaultAddress)[0];
        uint256 boost = (lockedStake.lock_multiplier + veFXSMultiplier);
        assertEq(boost, 4e18); // Max boost is 4x
    }
}
