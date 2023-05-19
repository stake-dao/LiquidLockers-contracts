// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Vm.sol";
import "forge-std/Test.sol";
import "forge-std/console.sol";

import {AddressBook} from "addressBook/AddressBook.sol";
import {Constants} from "test/fixtures/Constants.sol";
import {sdToken} from "contracts/tokens/sdToken.sol";
import {PendleLocker} from "contracts/lockers/PendleLocker.sol";
import {IVePendle} from "contracts/interfaces/IVePendle.sol";
import {PendleDepositor} from "contracts/depositors/PendleDepositor.sol";
import {IPendleFeeDistributor} from "contracts/interfaces/IPendleFeeDistributor.sol";
import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {ILiquidityGauge} from "contracts/interfaces/ILiquidityGauge.sol";
import {PendleAccumulator} from "contracts/accumulators/PendleAccumulator.sol";
import {TransparentUpgradeableProxy} from "contracts/external/TransparentUpgradeableProxy.sol";

contract PendleIntegrationTest is Test {
    ////////////////////////////////////////////////////////////////
    /// --- TEST STORAGE
    ///////////////////////////////////////////////////////////////

    // External Contracts
    //IPendleFeeDistributor internal yieldDistributor = IPendleFeeDistributor(Constants.PENDLE_FEE_D);
    PendleLocker internal pendleLocker;

    // Liquid Lockers Contracts
    IERC20 internal PENDLE = IERC20(Constants.PENDLE);
    IVePendle internal vePENDLE = IVePendle(Constants.VE_PENDLE);
    sdToken internal sdPendle;

    PendleDepositor internal depositor;
    ILiquidityGauge internal liquidityGauge;
    PendleAccumulator internal pendleAccumulator;

    address public daoRecipient = makeAddr("dao");
    address public bribeRecipient = makeAddr("bribe");
    address public veSdtFeeProxy = makeAddr("feeProxy");

    // Helper
    uint128 internal constant amount = 100e18;

    uint256 public DAY = AddressBook.DAY;
    uint256 public WEEK = AddressBook.WEEK;
    uint256 public YEAR = AddressBook.YEAR;

    address public WETH = AddressBook.WETH;

    function setUp() public virtual {
        uint256 forkId = vm.createFork(vm.rpcUrl("mainnet"));
        vm.selectFork(forkId);

        sdPendle = new sdToken("Stake DAO PENDLE", "sdPENDLE");

        address liquidityGaugeImpl = deployCode("artifacts/vyper-contracts/LiquidityGaugeV4.vy/LiquidityGaugeV4.json");

        // Deploy LiquidityGauge
        liquidityGauge = ILiquidityGauge(
            address(
                new TransparentUpgradeableProxy(
                liquidityGaugeImpl,
                AddressBook.PROXY_ADMIN,
                abi.encodeWithSignature(
                "initialize(address,address,address,address,address,address)",
                address(sdPendle),
                address(this),
                AddressBook.SDT,
                AddressBook.VE_SDT,
                AddressBook.VE_SDT_BOOST_PROXY,
                AddressBook.SDT_DISTRIBUTOR
                )
                )
            )
        );

        // Deploy and Intialize the PendleLocker contract
        pendleLocker = new PendleLocker(address(this), address(this));

        //Deploy Depositor Contract
        depositor = new PendleDepositor(address(PENDLE), address(pendleLocker), address(sdPendle), 104 * WEEK);
        depositor.setGauge(address(liquidityGauge));
        sdPendle.setOperator(address(depositor));
        pendleLocker.setPendleDepositor(address(depositor));

        // // Deploy Accumulator Contract
        pendleAccumulator = new PendleAccumulator( 
            address(liquidityGauge),
            daoRecipient,
            bribeRecipient,
            veSdtFeeProxy
            );
        pendleAccumulator.setLocker(address(pendleLocker));
        pendleLocker.setAccumulator(address(pendleAccumulator));

        // Add Reward to LGV4
        liquidityGauge.add_reward(WETH, address(pendleAccumulator));

        // Mint PENDLE to the locker
        deal(address(PENDLE), address(pendleLocker), amount); 

        uint128 lockTime = uint128(
            ((block.timestamp + 104 * Constants.WEEK) / Constants.WEEK) *
                Constants.WEEK
        );
        pendleLocker.createLock(amount, lockTime);

        // Mint PENDLE to the adresss(this)
        deal(address(PENDLE), address(this), amount);
    }

    function testInitialStateDepositor() public {
        (, uint256 end) = vePENDLE.positionData(
            address(pendleLocker)
        );
        assertEq(end, depositor.unlockTime());
    }

    // function testDepositThroughtDepositor() public {
    //     // Deposit PENDLE to the pendleLocker through the Depositor
    //     PENDLE.approve(address(depositor), amount);
    //     depositor.deposit(amount, true, false, address(this));

    //     assertEq(sdPendle.balanceOf(address(this)), amount);
    //     assertEq(liquidityGauge.balanceOf(address(this)), 0);
    // }

    // function testDepositThroughtDepositorWithStake() public {
    //     // Deposit PENDLE to the pendleLocker through the Depositor
    //     PENDLE.approve(address(depositor), amount);
    //     depositor.deposit(amount, true, true, address(this));

    //     assertEq(liquidityGauge.balanceOf(address(this)), amount);
    // }

    // function testDepositorIncreaseTime() public {
    //     // Deposit PENDLE to the pendleLocker through the Depositor
    //     PENDLE.approve(address(depositor), amount);
    //     depositor.deposit(amount, true, true, address(this));

    //     assertEq(liquidityGauge.balanceOf(address(this)), amount);
    //     (, uint128 oldEnd) = vePENDLE.positionData(
    //         address(pendleLocker)
    //     );
    //     // Increase Time
    //     vm.warp(block.timestamp + 2 * WEEK);
    //     uint256 newExpectedEnd = (block.timestamp + 104 * WEEK) / WEEK * WEEK;

    //     deal(address(PENDLE), address(this), amount);
    //     PENDLE.approve(address(depositor), amount);
    //     depositor.deposit(amount, true, true, address(this));

    //     (, uint128 end) = vePENDLE.positionData(
    //         address(pendleLocker)
    //     );

    //     assertGt(end, oldEnd);
    //     assertEq(end, newExpectedEnd);
    //     assertEq(liquidityGauge.balanceOf(address(this)), 2 * amount);
    // }

    // function testAccumulatorRewards() public {
    //     vm.warp(block.timestamp + 2 * DAY);

    //     // Check Dao recipient
    //     assertEq(PENDLE.balanceOf(daoRecipient), 0);

    //     // Check Bribe recipient23
    //     assertEq(PENDLE.balanceOf(bribeRecipient), 0);

    //     // Check VeSdtFeeProxy
    //     assertEq(PENDLE.balanceOf(address(veSdtFeeProxy)), 0);

    //     // Check lgv4
    //     assertEq(PENDLE.balanceOf(address(liquidityGauge)), 0);

    //     pendleAccumulator.claimAndNotifyAll();

    //     assertEq(PENDLE.balanceOf(address(pendleAccumulator)), 0);

    //     uint256 daoPart = PENDLE.balanceOf(daoRecipient);
    //     uint256 bribePart = PENDLE.balanceOf(bribeRecipient);
    //     uint256 gaugePart = PENDLE.balanceOf(address(liquidityGauge));
    //     uint256 veSdtFeePart = PENDLE.balanceOf(veSdtFeeProxy);
    //     emit log_uint(gaugePart);

    //     assertEq((daoPart + bribePart + gaugePart + veSdtFeePart) * pendleAccumulator.daoFee() / 10_000, daoPart);
    //     assertEq((daoPart + bribePart + gaugePart + veSdtFeePart) * pendleAccumulator.bribeFee() / 10_000, bribePart);
    //     assertEq((daoPart + bribePart + gaugePart + veSdtFeePart) * pendleAccumulator.veSdtFeeProxyFee() / 10_000, veSdtFeePart);

    //     assertGt(PENDLE.balanceOf(address(liquidityGauge)), 0);
    // }

    // function testAccumulatorRewardsWithClaimerFees() public {
    //     vm.warp(block.timestamp + 2 * DAY);

    //     pendleAccumulator.setClaimerFee(1000); // 10%

    //     uint256 claimerBalanceBefore = PENDLE.balanceOf(address(this));

    //     pendleAccumulator.claimAndNotifyAll();

    //     uint256 claimerBalanceEarned = PENDLE.balanceOf(address(this)) - claimerBalanceBefore;

    //     assertEq((claimerBalanceEarned + PENDLE.balanceOf(address(liquidityGauge))) * pendleAccumulator.claimerFee() / 10_000, claimerBalanceEarned);
    // }
}
