// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Vm.sol";
import "forge-std/Test.sol";
import "forge-std/console.sol";

import {AddressBook} from "addressBook/AddressBook.sol";
import {sdFPIS} from "contracts/tokens/sdFPIS.sol";
import {FpisLocker} from "contracts/lockers/FpisLocker.sol";
import {IVeFPIS} from "contracts/interfaces/IVeFPIS.sol";
import {DepositorV3} from "contracts/depositors/DepositorV3.sol";
import {IYieldDistributor} from "contracts/interfaces/IYieldDistributor.sol";
import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {ILiquidityGauge} from "contracts/interfaces/ILiquidityGauge.sol";
import {FpisAccumulator} from "contracts/accumulators/FpisAccumulator.sol";
import {TransparentUpgradeableProxy} from "contracts/external/TransparentUpgradeableProxy.sol";
import {SmartWalletWhitelist} from "contracts/dao/SmartWalletWhitelist.sol";
import {VeSDTFeeFpisProxy} from "contracts/accumulators/VeSDTFeeFpisProxy.sol";

contract FpisIntegrationTest is Test {
    ////////////////////////////////////////////////////////////////
    /// --- TEST STORAGE
    ///////////////////////////////////////////////////////////////

    // External Contracts
    IYieldDistributor internal yieldDistributor = IYieldDistributor(AddressBook.FPIS_YIELD_DISTRIBUTOR);
    FpisLocker internal fpisLocker;

    // Liquid Lockers Contracts
    IERC20 internal FPIS = IERC20(AddressBook.FPIS);
    IVeFPIS internal veFPIS = IVeFPIS(AddressBook.VE_FPIS);
    sdFPIS internal sdFpis;

    DepositorV3 internal depositor;
    ILiquidityGauge internal liquidityGauge;
    FpisAccumulator internal fpisAccumulator;
    SmartWalletWhitelist internal sww;
    VeSDTFeeFpisProxy internal veSdtFeeProxy;

    address public daoRecipient = makeAddr("dao");
    address public bribeRecipient = makeAddr("bribe");

    // Helper
    uint256 internal constant amount = 100e18;

    uint256 public DAY = AddressBook.DAY;
    uint256 public WEEK = AddressBook.WEEK;
    uint256 public YEAR = AddressBook.YEAR;

    function setUp() public virtual {
        uint256 forkId = vm.createFork(vm.rpcUrl("mainnet"));
        vm.selectFork(forkId);

        sww = new SmartWalletWhitelist(address(this));

        sdFpis = new sdFPIS(address(this), address(this));

        address liquidityGaugeImpl = deployCode("artifacts/vyper-contracts/LiquidityGaugeV4.vy/LiquidityGaugeV4.json");

        // Deploy LiquidityGauge
        liquidityGauge = ILiquidityGauge(
            address(
                new TransparentUpgradeableProxy(
                liquidityGaugeImpl,
                AddressBook.PROXY_ADMIN,
                abi.encodeWithSignature(
                "initialize(address,address,address,address,address,address)",
                address(sdFpis),
                address(this),
                AddressBook.SDT,
                AddressBook.VE_SDT,
                AddressBook.VE_SDT_BOOST_PROXY,
                AddressBook.SDT_DISTRIBUTOR
                )
                )
            )
        );

        // Deploy and Intialize the FpisLocker contract
        fpisLocker = new FpisLocker(address(this), address(this));

        // Deploy Depositor Contract
        depositor = new DepositorV3(address(FPIS), address(fpisLocker), address(sdFpis), 4 * YEAR);
        depositor.setGauge(address(liquidityGauge));
        sdFpis.setMinterOperator(address(depositor));
        fpisLocker.setFpisDepositor(address(depositor));

        // Deploy veSdtFeeProxy
        address[] memory fraxSwapPath = new address[](2);
        fraxSwapPath[0] = address(FPIS);
        fraxSwapPath[1] = AddressBook.FRAX;
        veSdtFeeProxy = new VeSDTFeeFpisProxy(fraxSwapPath);

        // Deploy Accumulator Contract
        fpisAccumulator = new FpisAccumulator(
            address(FPIS), 
            address(liquidityGauge),
            daoRecipient,
            bribeRecipient,
            address(veSdtFeeProxy)
            );
        fpisAccumulator.setLocker(address(fpisLocker));
        fpisLocker.setAccumulator(address(fpisAccumulator));

        // Add Reward to LGV4
        liquidityGauge.add_reward(address(FPIS), address(fpisAccumulator));

        // Mint FPIS to the adresss(this)
        deal(address(FPIS), address(fpisLocker), amount);

        // set smart_wallet_checker as sww
        bytes32 swwBytes32 = bytes32(uint256(uint160((address(sww)))));
        vm.store(address(veFPIS), bytes32(uint256(500000000000000009942312419356)), swwBytes32);
        // whitelist fpis locker contract to lock fpis 
        sww.approveWallet(address(fpisLocker)); 

        fpisLocker.createLock(amount, block.timestamp + 4 * YEAR);

        // Mint FPIS to the adresss(this)
        deal(address(FPIS), address(this), amount);
    }

    function testInitialStateDepositor() public {
        uint256 end = veFPIS.locked(address(fpisLocker)).end;
        assertEq(end, depositor.unlockTime());
    }

    function testDepositThroughtDepositor() public {
        // Deposit FPIS to the fpisLocker through the Depositor
        FPIS.approve(address(depositor), amount);
        depositor.deposit(amount, true, false, address(this));

        assertEq(sdFpis.balanceOf(address(this)), amount);
        assertEq(liquidityGauge.balanceOf(address(this)), 0);
    }

    function testDepositThroughtDepositorWithStake() public {
        // Deposit FPIS to the fpisLocker through the Depositor
        FPIS.approve(address(depositor), amount);
        depositor.deposit(amount, true, true, address(this));

        assertEq(liquidityGauge.balanceOf(address(this)), amount);
    }

    function testDepositorIncreaseTime() public {
        // Deposit FPIS to the fpisLocker through the Depositor
        FPIS.approve(address(depositor), amount);
        depositor.deposit(amount, true, true, address(this));

        assertEq(liquidityGauge.balanceOf(address(this)), amount);
        uint256 oldEnd = veFPIS.locked(address(fpisLocker)).end;
        // Increase Time
        vm.warp(block.timestamp + 2 * WEEK);
        uint256 newExpectedEnd = (block.timestamp + 4 * YEAR) / WEEK * WEEK;

        deal(address(FPIS), address(this), amount);
        FPIS.approve(address(depositor), amount);
        depositor.deposit(amount, true, true, address(this));

        uint256 end = veFPIS.locked(address(fpisLocker)).end;

        assertGt(end, oldEnd);
        assertEq(end, newExpectedEnd);
        assertEq(liquidityGauge.balanceOf(address(this)), 2 * amount);
    }

    function testAccumulatorRewards() public {
        vm.warp(block.timestamp + 2 * DAY);

        // Check Dao recipient
        assertEq(FPIS.balanceOf(daoRecipient), 0);

        // Check Bribe recipient23
        assertEq(FPIS.balanceOf(bribeRecipient), 0);

        // Check VeSdtFeeProxy
        assertEq(FPIS.balanceOf(address(veSdtFeeProxy)), 0);

        // Check lgv4
        assertEq(FPIS.balanceOf(address(liquidityGauge)), 0);

        fpisAccumulator.claimAndNotifyAll();

        assertGt(FPIS.balanceOf(daoRecipient), 0);

        assertGt(FPIS.balanceOf(bribeRecipient), 0);

        assertGt(FPIS.balanceOf(address(veSdtFeeProxy)), 0);

        assertGt(FPIS.balanceOf(address(liquidityGauge)), 0);
    }

    function testVeSdtFeeProxy() public {
        deal(address(FPIS), address(veSdtFeeProxy), 100e18);

        // Check FeeD
        uint256 feeDBalanceBefore = IERC20(AddressBook.SDFRAX3CRV).balanceOf(AddressBook.FEE_D_SD);

        veSdtFeeProxy.sendRewards();

        uint256 feeDBalanceAfter = IERC20(AddressBook.SDFRAX3CRV).balanceOf(AddressBook.FEE_D_SD);

        assertEq(FPIS.balanceOf(address(veSdtFeeProxy)), 0);
        assertGt(feeDBalanceAfter, feeDBalanceBefore);
    }
}
