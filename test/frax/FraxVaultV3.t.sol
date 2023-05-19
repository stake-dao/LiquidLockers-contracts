// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

// Base Tests
import "../baseTest/Base.t.sol";
import {VaultV3} from "contracts/strategies/frax/VaultV3.sol";
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

contract FraxVaultV3Test is BaseTest {
    address public multiSig;
    address public acc;
    address public veSdtFeeProxy;

    address EUSD_FRAXBP_GAUGE = 0x4c9AD8c53d0a001E7fF08a3E5E26dE6795bEA5ac;
    address EUSD_FRAXBP_CONVEX_STAKING_TOKEN = 0x49BF6f9B860fAF73B0b515c06Be1Bcbf4A0db3dF;
    address EUSD_FRAXBP_CURVE_LP_TOKEN = 0xAEda92e6A3B1028edc139A4ae56Ec881f3064D4F;
    address public constant FRAX_GOVERNANCE = 0xB1748C79709f4Ba2Dd82834B8c82D4a505003f27;

    address public fxs;
    address public crv;
    address public constant CVX = 0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B;
    uint256 public eusdFraxBPPid;
    VaultV3 vaultImpl;
    FraxStrategy strategy;
    FeeRegistry feeRegistry;
    PoolRegistry registry;
    Booster booster;

    function setUp() public {
        uint256 forkId = vm.createFork(vm.rpcUrl("mainnet"));
        vm.selectFork(forkId);
        fxs = AddressBook.FXS;
        crv = AddressBook.CRV;
        strategy = FraxStrategy(AddressBook.FRAX_STRATEGY);
        registry = PoolRegistry(AddressBook.FXS_POOL_REGISTRY);
        booster = Booster(AddressBook.FXS_BOOSTER);
        vaultImpl = new VaultV3();
        feeRegistry = FeeRegistry(vaultImpl.FEE_REGISTRY());
        multiSig = feeRegistry.multiSig();
        acc = feeRegistry.accumulator();
        veSdtFeeProxy = feeRegistry.veSDTFeeProxy();
        vm.prank(AddressBook.SDTNEWDEPLOYER);
        booster.addPool(
            address(vaultImpl),
            EUSD_FRAXBP_GAUGE,
            EUSD_FRAXBP_CONVEX_STAKING_TOKEN
        );
        uint256 poolLength = registry.poolLength();
        eusdFraxBPPid = poolLength - 1;
        vm.prank(FRAX_GOVERNANCE);
        FraxGauge(EUSD_FRAXBP_GAUGE).toggleValidVeFXSProxy(AddressBook.FXS_LOCKER);
    }

    function testCreateVault() public {
        address vaultAddressBefore = registry.vaultMap(
            eusdFraxBPPid,
            address(this)
        );
        booster.createVault(eusdFraxBPPid);
        address vaultAddressAfter = registry.vaultMap(
            eusdFraxBPPid,
            address(this)
        );
        assertTrue(vaultAddressBefore == address(0));
        assertTrue(vaultAddressAfter != address(0));
    }

    function testDepositVault() public {
        uint256 amount = 10000e18;
        deal(EUSD_FRAXBP_CURVE_LP_TOKEN, address(this), amount);
        booster.createVault(eusdFraxBPPid);
        address vaultAddress = registry.vaultMap(eusdFraxBPPid, address(this));
        VaultV3 vault = VaultV3(vaultAddress);
        IERC20(EUSD_FRAXBP_CURVE_LP_TOKEN).approve(vaultAddress, amount);
        vault.stakeLockedCurveLp(amount, 94608000);
        address rewardsContract = vault.rewards();
        uint256 veFXSMultiplier = FraxGauge(EUSD_FRAXBP_GAUGE).veFXSMultiplier(
            vaultAddress
        );
        FraxGauge.LockedStake memory lockedStake = FraxGauge(EUSD_FRAXBP_GAUGE)
            .lockedStakesOf(vaultAddress)[0];

        uint256 boost = (lockedStake.lock_multiplier + veFXSMultiplier);
        uint256 rewardsContractStaked = ILiquidityGaugeStratFrax(
            rewardsContract
        ).balanceOf(address(this));
        assertEq(rewardsContractStaked, amount);
        assertEq(boost, 4e18); // Max boost is 4x
    }

    function testGetRewards() public {
        uint256 amount = 10000e18;
        deal(EUSD_FRAXBP_CURVE_LP_TOKEN, address(this), amount);
        booster.createVault(eusdFraxBPPid);
        address vaultAddress = registry.vaultMap(eusdFraxBPPid, address(this));
        VaultV3 vault = VaultV3(vaultAddress);
        IERC20(EUSD_FRAXBP_CURVE_LP_TOKEN).approve(vaultAddress, amount);
        vault.stakeLockedCurveLp(amount, 94608000);
        skip(1 days);
        assertEq(IERC20(crv).balanceOf(address(this)), 0);
        assertEq(IERC20(fxs).balanceOf(address(this)), 0);
        assertEq(IERC20(CVX).balanceOf(address(this)), 0);
        uint256 msPartBefore = IERC20(fxs).balanceOf(multiSig);
        uint256 accPartBefore = IERC20(fxs).balanceOf(acc);
        uint256 veSdtFeeProxyPartBefore = IERC20(fxs).balanceOf(veSdtFeeProxy);
        vault.getReward();
        assertGt(IERC20(crv).balanceOf(address(this)), 0);
        assertGt(IERC20(fxs).balanceOf(address(this)), 0);
        assertGt(IERC20(CVX).balanceOf(address(this)), 0);
        assertGt(IERC20(fxs).balanceOf(multiSig) - msPartBefore, 0);
        assertGt(IERC20(fxs).balanceOf(acc) - accPartBefore, 0);
        assertGt(IERC20(fxs).balanceOf(veSdtFeeProxy) - veSdtFeeProxyPartBefore, 0);
    }

    function testWithdrawLocked() public {
        uint256 amount = 10000e18;
        deal(EUSD_FRAXBP_CURVE_LP_TOKEN, address(this), amount);
        booster.createVault(eusdFraxBPPid);
        address vaultAddress = registry.vaultMap(eusdFraxBPPid, address(this));
        VaultV3 vault = VaultV3(vaultAddress);
        IERC20(EUSD_FRAXBP_CURVE_LP_TOKEN).approve(vaultAddress, amount);
        bytes32 kekId = vault.stakeLockedCurveLp(amount, 1 weeks * 4);
        skip(1 weeks * 4);
        // withdraw all amount locked
        vault.withdrawLocked(kekId);
        // claim for both convex and grax rewards within the withdraw
        assertGt(IERC20(crv).balanceOf(address(this)), 0);
        assertGt(IERC20(fxs).balanceOf(address(this)), 0);
        assertGt(IERC20(CVX).balanceOf(address(this)), 0);
    }
}
