// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Vm.sol";
import "forge-std/Test.sol";
import "forge-std/console.sol";

import {AddressBook} from "addressBook/AddressBook.sol";
import {FpisLocker} from "contracts/lockers/FpisLocker.sol";
import {IVeFPIS} from "contracts/interfaces/IVeFPIS.sol";
import {IYieldDistributor} from "contracts/interfaces/IYieldDistributor.sol";
import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {SmartWalletWhitelist} from "contracts/dao/SmartWalletWhitelist.sol";

contract FpisLockerTest is Test {
    ////////////////////////////////////////////////////////////////
    /// --- TEST STORAGE
    ///////////////////////////////////////////////////////////////

    IERC20 internal FPIS;
    IVeFPIS internal veFPIS;
    FpisLocker internal fpisLocker;
    IYieldDistributor internal yieldDistributor;
    SmartWalletWhitelist internal sww;

    uint256 public DAY = AddressBook.DAY;
    uint256 public WEEK = AddressBook.WEEK;
    uint256 public YEAR = AddressBook.YEAR;

    function setUp() public virtual {
        uint256 forkId = vm.createFork(vm.rpcUrl("mainnet"));
        vm.selectFork(forkId);
        
        FPIS = IERC20(AddressBook.FPIS);
        veFPIS = IVeFPIS(AddressBook.VE_FPIS);
        yieldDistributor = IYieldDistributor(AddressBook.FPIS_YIELD_DISTRIBUTOR);

        sww = new SmartWalletWhitelist(address(this));

        // Deploy and Intialize the FpisLocker contract
        fpisLocker = new FpisLocker(address(this), address(this));

        // Mint FPIS to the YearnLocker contract
        deal(address(FPIS), address(fpisLocker), 100e18);

        // set smart_wallet_checker as sww
        bytes32 swwBytes32 = bytes32(uint256(uint160((address(sww)))));
        vm.store(address(veFPIS), bytes32(uint256(500000000000000009942312419356)), swwBytes32);
        // whitelist fpis locker contract to lock fpis 
        sww.approveWallet(address(fpisLocker));        
    }

    function testCreateLock() public {
        fpisLocker.createLock(100e18, block.timestamp + 4 * YEAR);
        // 4 years lock -> 4 times the amount locked like for FXS
        assertApproxEqRel(veFPIS.balanceOf(address(fpisLocker)), 400e18, 1e16); // 1% Margin of Error
    }

    function testIncreaseLockAmount() public {
        fpisLocker.createLock(100e18, block.timestamp + YEAR);

        IVeFPIS.LockedBalance memory lockedBalance = veFPIS.locked(address(fpisLocker));
        assertEq(lockedBalance.amount, 100e18);

        deal(address(FPIS), address(fpisLocker), 100e18);
        fpisLocker.increaseAmount(100e18);

        lockedBalance = veFPIS.locked(address(fpisLocker));
        assertEq(lockedBalance.amount, 200e18);
    }

    function testIncreaseLockDuration() public {
        uint256 initialUnlockTime = block.timestamp + YEAR;
        uint256 newUnlockTime = block.timestamp + 2 * YEAR;

        fpisLocker.createLock(100e18, initialUnlockTime);
        IVeFPIS.LockedBalance memory lockedBalance = veFPIS.locked(address(fpisLocker));

        // Assert that the Locked End Timestamp is equal to the initialUnlockTime rounded down to week.
        assertEq(lockedBalance.end, (initialUnlockTime / WEEK) * WEEK);

        fpisLocker.increaseUnlockTime(newUnlockTime);

        lockedBalance = veFPIS.locked(address(fpisLocker));

        // Assert that the new Locked End Timestamp is equal to the newUnlockTime rounded down to week.
        assertEq(lockedBalance.end, (newUnlockTime / WEEK) * WEEK);
    }

    function testClaimRewards() public {
        uint256 balanceBefore = FPIS.balanceOf(address(this));
        deal(address(FPIS), address(fpisLocker), 200e18);
        fpisLocker.createLock(200e18, block.timestamp + YEAR);

        vm.warp(block.timestamp + 2 * DAY); //extend 2 days

        fpisLocker.claimFPISRewards(address(this));
        uint256 balanceAfterClaim = FPIS.balanceOf(address(this));

        assertEq(balanceBefore, 0);
        assertGt(balanceAfterClaim, balanceBefore);
    }

    function testStakerSetProxy() public {
        // test the correctness of the function signature
        vm.recordLogs();
        fpisLocker.stakerSetProxy(AddressBook.ZERO_ADDRESS);
        Vm.Log[] memory entries = vm.getRecordedLogs();
        assertEq(entries[0].topics[0], keccak256("StakerProxySet(address)"));
    }
}
