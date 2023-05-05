// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

// Base Tests
import "../baseTest/Base.t.sol";
import {VaultV2} from "contracts/strategies/frax/VaultV2.sol";
import {VaultV2_1} from "contracts/strategies/frax/VaultV2_1.sol";
import {FraxStrategy} from "contracts/strategies/frax/FraxStrategy.sol";
import {FeeRegistry} from "contracts/strategies/frax/FeeRegistry.sol";
import {PoolRegistry} from "contracts/strategies/frax/PoolRegistry.sol";
import {Booster} from "contracts/strategies/frax/Booster.sol";
import {ILiquidityGaugeStratFrax} from "contracts/interfaces/ILiquidityGaugeStratFrax.sol";

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

    function updateRewardAndBalance(address _user, bool _sync) external;
}

contract FraxVaultV2Test is BaseTest {
    address public multiSig;
    address public acc;
    address public veSdtFeeProxy;

    // Vault V2
    // SDT_FRAXBP
    address SDT_FRAXBP_GAUGE = 0x9C8d9667d5726aEcA4d24171958BeE9F46861bed;
    address SDT_FRAXBP_CONVEX_STAKING_TOKEN =
        0xE6Aa75F98e6c105b821a2dba9Fbbd886b421F06b;
    address SDT_FRAXBP_CURVE_LP_TOKEN =
        address(0x893DA8A02b487FEF2F7e3F35DF49d7625aE549a3);
    // OHM_FRAXBP
    address public constant OHM_FRAXBP_GAUGE =
        0xc96e1a26264D965078bd01eaceB129A65C09FFE7;
    address public constant OHM_FRAXBP_CONVEX_STAKING_TOKEN =
        0x81b0dCDa53482A2EA9eb496342dC787643323e95;
    address public constant OHM_FRAXBP_CURVE_LP_TOKEN =
        0x5271045F7B73c17825A7A7aee6917eE46b0B7520;
    // Vault V2_1
    // ALCX_FRAXBP
    address public constant ALCX_FRAXBP_GAUGE = 0xA0657642224Fc53dAB4a3d2069430afe157BEc5D;
    address public constant ALCX_FRAXBP_CONVEX_STAKING_TOKEN = 0xAF1b82809296E52A42B3452c52e301369Ce20554;
    address public constant ALCX_FRAXBP_CURVE_LP_TOKEN = 0xf985005a3793DbA4cCe241B3C19ddcd3Fe069ff4;

    address public constant FRAX_GOVERNANCE =
        0xB1748C79709f4Ba2Dd82834B8c82D4a505003f27;

    address public fxs;
    address public crv;
    address public constant CVX = 0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B;
    uint256 public sdtFraxBPPid;
    uint256 public ohmFraxBPPid;
    uint256 public alcxFraxBPPid;
    VaultV2 vaultImpl;
    VaultV2_1 newVaultImpl;
    FraxStrategy strategy;
    FeeRegistry feeRegistry;
    PoolRegistry registry;
    Booster booster;

    function setUp() public {
        uint256 forkId = vm.createFork(vm.rpcUrl("mainnet"), 16816754);
        vm.selectFork(forkId);
        fxs = AddressBook.FXS;
        crv = AddressBook.CRV;
        strategy = FraxStrategy(AddressBook.FRAX_STRATEGY);
        registry = PoolRegistry(AddressBook.FXS_POOL_REGISTRY);
        booster = Booster(AddressBook.FXS_BOOSTER);
        vaultImpl = new VaultV2();
        newVaultImpl = new VaultV2_1();
        feeRegistry = FeeRegistry(vaultImpl.FEE_REGISTRY());
        multiSig = feeRegistry.multiSig();
        acc = feeRegistry.accumulator();
        veSdtFeeProxy = feeRegistry.veSDTFeeProxy();
        // VaultV2
        vm.prank(AddressBook.SDTNEWDEPLOYER);
        booster.addPool(
            address(vaultImpl),
            SDT_FRAXBP_GAUGE,
            SDT_FRAXBP_CONVEX_STAKING_TOKEN
        );
        uint256 poolLength = registry.poolLength();
        sdtFraxBPPid = poolLength - 1;
        vm.prank(FRAX_GOVERNANCE);
        FraxGauge(SDT_FRAXBP_GAUGE).toggleValidVeFXSProxy(AddressBook.FXS_LOCKER);
        // VaultV2
        vm.prank(AddressBook.SDTNEWDEPLOYER);
        booster.addPool(
            address(vaultImpl),
            OHM_FRAXBP_GAUGE,
            OHM_FRAXBP_CONVEX_STAKING_TOKEN
        );
        poolLength = registry.poolLength();
        ohmFraxBPPid = poolLength - 1;
        vm.prank(FRAX_GOVERNANCE);
        FraxGauge(OHM_FRAXBP_GAUGE).toggleValidVeFXSProxy(AddressBook.FXS_LOCKER);
        // VaultV2_1
        // Already toggled the proxy for this gauge
        vm.prank(AddressBook.SDTNEWDEPLOYER);
        booster.addPool(
            address(newVaultImpl),
            ALCX_FRAXBP_GAUGE,
            ALCX_FRAXBP_CONVEX_STAKING_TOKEN
            
        );
        poolLength = registry.poolLength();
        alcxFraxBPPid = poolLength - 1;
        vm.prank(FRAX_GOVERNANCE);
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
        address rewardsContract = vault.rewards();
        uint256 veFXSMultiplier = FraxGauge(SDT_FRAXBP_GAUGE).veFXSMultiplier(
            vaultAddress
        );
        FraxGauge.LockedStake memory lockedStake = FraxGauge(SDT_FRAXBP_GAUGE)
            .lockedStakesOf(vaultAddress)[0];

        uint256 boost = (lockedStake.lock_multiplier + veFXSMultiplier);
        uint256 rewardsContractStaked = ILiquidityGaugeStratFrax(
            rewardsContract
        ).balanceOf(address(this));
        assertEq(rewardsContractStaked, amount);
        assertEq(boost, 4e18); // Max boost is 4x
    }

    function testVaultV2_1() public {
        uint256 amount = 10000e18;
        deal(ALCX_FRAXBP_CURVE_LP_TOKEN, address(this), amount);
        booster.createVault(alcxFraxBPPid);
        address vaultAddress = registry.vaultMap(alcxFraxBPPid, address(this));
        VaultV2_1 vault = VaultV2_1(vaultAddress);
        IERC20(ALCX_FRAXBP_CURVE_LP_TOKEN).approve(vaultAddress, amount);
        vault.stakeLockedCurveLp(amount, 31536000);
        address rewardsContract = vault.rewards();
        uint256 veFXSMultiplier = FraxGauge(ALCX_FRAXBP_GAUGE).veFXSMultiplier(
            vaultAddress
        );
        FraxGauge.LockedStake memory lockedStake = FraxGauge(ALCX_FRAXBP_GAUGE)
            .lockedStakesOf(vaultAddress)[0];
        uint256 boost = (lockedStake.lock_multiplier + veFXSMultiplier);
        uint256 rewardsContractStaked = ILiquidityGaugeStratFrax(
            rewardsContract
        ).balanceOf(address(this));
        assertEq(rewardsContractStaked, amount);
        assertEq(boost, 4e18); // Max boost is 4x

        skip(1 days);
        // update balance to include boost on fxs reward 
        FraxGauge(ALCX_FRAXBP_GAUGE).updateRewardAndBalance(address(vault), false);
        (address[] memory tokenAddresses, uint256[] memory totalEarned) = vault.earned();
        uint256 fxsEarned = totalEarned[0];
        uint256 crvEarned = totalEarned[2];
        uint256 cvxEarned = totalEarned[3]; 
        assertEq(IERC20(crv).balanceOf(address(this)), 0);
        assertEq(IERC20(fxs).balanceOf(address(this)), 0);
        assertEq(IERC20(CVX).balanceOf(address(this)), 0);
        uint256 msPartBefore = IERC20(fxs).balanceOf(multiSig);
        uint256 accPartBefore = IERC20(fxs).balanceOf(acc);
        uint256 veSdtFeeProxyPartBefore = IERC20(fxs).balanceOf(veSdtFeeProxy);
        vault.getReward();
        uint256 crvBalanceAfter = IERC20(crv).balanceOf(address(this));
        uint256 fxsBalanceAfter = IERC20(fxs).balanceOf(address(this));
        uint256 cvxBalanceAfter = IERC20(CVX).balanceOf(address(this));
        assertGt(crvBalanceAfter, 0);
        assertGt(cvxBalanceAfter, 0); 
        uint256 msPart = IERC20(fxs).balanceOf(multiSig) - msPartBefore;
        uint256 accPart = IERC20(fxs).balanceOf(acc) - accPartBefore;
        uint256 veSdtFeeProxyPart = IERC20(fxs).balanceOf(veSdtFeeProxy) - veSdtFeeProxyPartBefore;

        assertEq(crvBalanceAfter, crvEarned);
        assertGt(fxsBalanceAfter + msPart + accPart + veSdtFeeProxyPart, fxsEarned);
    }

    function testGetRewards() public {
        uint256 amount = 10000e18;
        deal(SDT_FRAXBP_CURVE_LP_TOKEN, address(this), amount);
        booster.createVault(sdtFraxBPPid);
        address vaultAddress = registry.vaultMap(sdtFraxBPPid, address(this));
        VaultV2 vault = VaultV2(vaultAddress);
        IERC20(SDT_FRAXBP_CURVE_LP_TOKEN).approve(vaultAddress, amount);
        vault.stakeLockedCurveLp(amount, 94608000);
        skip(1 days);
        // update balance to include boost on fxs reward 
        FraxGauge(SDT_FRAXBP_GAUGE).updateRewardAndBalance(address(vault), false);
        (address[] memory tokenAddresses, uint256[] memory totalEarned) = vault.earned();
        uint256 fxsEarned = totalEarned[0];
        uint256 crvEarned = totalEarned[2];
        uint256 cvxEarned = totalEarned[3]; 
        assertEq(IERC20(crv).balanceOf(address(this)), 0);
        assertEq(IERC20(fxs).balanceOf(address(this)), 0);
        assertEq(IERC20(CVX).balanceOf(address(this)), 0);
        uint256 msPartBefore = IERC20(fxs).balanceOf(multiSig);
        uint256 accPartBefore = IERC20(fxs).balanceOf(acc);
        uint256 veSdtFeeProxyPartBefore = IERC20(fxs).balanceOf(veSdtFeeProxy);
        vault.getReward();
        uint256 crvBalanceAfter = IERC20(crv).balanceOf(address(this));
        uint256 fxsBalanceAfter = IERC20(fxs).balanceOf(address(this));
        uint256 cvxBalanceAfter = IERC20(CVX).balanceOf(address(this));
        assertGt(crvBalanceAfter, 0);
        assertGt(cvxBalanceAfter, 0); 
        uint256 msPart = IERC20(fxs).balanceOf(multiSig) - msPartBefore;
        uint256 accPart = IERC20(fxs).balanceOf(acc) - accPartBefore;
        uint256 veSdtFeeProxyPart = IERC20(fxs).balanceOf(veSdtFeeProxy) - veSdtFeeProxyPartBefore;
        
        assertEq(crvBalanceAfter, crvEarned);
        assertGt(fxsBalanceAfter + msPart + accPart + veSdtFeeProxyPart, fxsEarned);
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
