// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

// Base Tests
import "./baseTest/Base.t.sol";

import "contracts/dao/SmartWalletWhitelist.sol";
import "contracts/external/ProxyAdmin.sol";
import "contracts/external/TransparentUpgradeableProxy.sol";

// Interface
import "contracts/interfaces/IVeSDT.sol";

contract VeSDTTest is BaseTest {
    address internal constant LOCAL_DEPLOYER = address(0xDE);
    address internal constant ALICE = address(0xAA);
    address internal constant BOB = address(0xB0B);
    address internal token = Constants.SDT;

    uint256 internal constant INIITIAL_AMOUNT_TO_LOCK = 1_000e18;
    uint256 internal constant MAX_DURATION = 60 * 60 * 24 * 365 * 4;
    //uint256 internal

    ProxyAdmin internal proxyAdmin;
    SmartWalletWhitelist internal smartWalletWhitelist;
    TransparentUpgradeableProxy internal proxy;

    IVeSDT internal veSDT;
    IVeSDT internal veSDTImpl;

    function setUp() public {
        uint256 forkId = vm.createFork(vm.rpcUrl("mainnet"));
        vm.selectFork(forkId);

        ////////////////////////////////////////////////////////////////
        /// --- START DEPLOYEMENT
        ///////////////////////////////////////////////////////////////
        vm.startPrank(LOCAL_DEPLOYER);

        // Deploy Proxy Admin
        proxyAdmin = new ProxyAdmin();

        // Deploy Smart Wallet Whitelist
        smartWalletWhitelist = new SmartWalletWhitelist(LOCAL_DEPLOYER);

        // Deploy veSDT
        bytes memory veSDTData = abi.encodeWithSignature(
            "initialize(address,address,address,string,string)",
            LOCAL_DEPLOYER,
            token,
            address(smartWalletWhitelist),
            "Vote-escrowed SDT",
            "veSDT"
        );
        veSDTImpl = IVeSDT(deployCode("artifacts/vyper-contracts/veSDT.vy/veSDT.json"));
        proxy = new TransparentUpgradeableProxy(address(veSDTImpl), address(proxyAdmin), veSDTData);
        veSDT = IVeSDT(address(proxy));
        vm.stopPrank();

        ////////////////////////////////////////////////////////////////
        /// --- START SETTERS
        ///////////////////////////////////////////////////////////////
        vm.startPrank(LOCAL_DEPLOYER);
        smartWalletWhitelist.approveWallet(ALICE);
        vm.stopPrank();

        deal(token, ALICE, INIITIAL_AMOUNT_TO_LOCK);
        deal(token, BOB, INIITIAL_AMOUNT_TO_LOCK);
        vm.prank(ALICE);
        IERC20(token).approve(address(veSDT), INIITIAL_AMOUNT_TO_LOCK);
        vm.prank(BOB);
        IERC20(token).approve(address(veSDT), INIITIAL_AMOUNT_TO_LOCK);
    }

    function testNothing() public {}

    function test01LockSDT() public {
        uint256 balanceLockerBefore = IERC20(token).balanceOf(address(veSDT));
        uint256 balanceUserBefore = IERC20(token).balanceOf(ALICE);
        vm.prank(ALICE);
        veSDT.create_lock(INIITIAL_AMOUNT_TO_LOCK, block.timestamp + Constants.WEEK);
        uint256 balanceLockerAfter = IERC20(token).balanceOf(address(veSDT));
        uint256 balanceUserAfter = IERC20(token).balanceOf(ALICE);

        assertEq(balanceLockerAfter - balanceLockerBefore, INIITIAL_AMOUNT_TO_LOCK, "ERROR_010");
        assertEq(balanceUserBefore - balanceUserAfter, INIITIAL_AMOUNT_TO_LOCK, "ERROR_011");
    }

    function test02LockSDTOnBehalf() public {
        vm.prank(ALICE);
        veSDT.create_lock(INIITIAL_AMOUNT_TO_LOCK / 2, block.timestamp + Constants.WEEK);

        uint256 balanceLockerBefore = IERC20(token).balanceOf(address(veSDT));
        uint256 balanceUserBefore = IERC20(token).balanceOf(ALICE);
        uint256 balanceBobBefore = IERC20(token).balanceOf(BOB);
        vm.prank(BOB);
        veSDT.deposit_for(ALICE, INIITIAL_AMOUNT_TO_LOCK / 2);
        uint256 balanceLockerAfter = IERC20(token).balanceOf(address(veSDT));
        uint256 balanceUserAfter = IERC20(token).balanceOf(ALICE);
        uint256 balanceBobAfter = IERC20(token).balanceOf(BOB);

        assertEq(balanceLockerAfter - balanceLockerBefore, INIITIAL_AMOUNT_TO_LOCK / 2, "ERROR_020");
        assertEq(balanceUserBefore, balanceUserAfter, "ERROR_021");
        assertEq(balanceBobBefore - balanceBobAfter, INIITIAL_AMOUNT_TO_LOCK / 2, "ERROR_022");
    }

    function test03LockSDTOnBehalfAndSupplySDT() public {
        vm.prank(ALICE);
        veSDT.create_lock(INIITIAL_AMOUNT_TO_LOCK / 2, block.timestamp + Constants.WEEK);

        uint256 balanceLockerBefore = IERC20(token).balanceOf(address(veSDT));
        uint256 balanceUserBefore = IERC20(token).balanceOf(ALICE);
        uint256 balanceBobBefore = IERC20(token).balanceOf(BOB);
        vm.prank(BOB);
        veSDT.deposit_for_from(ALICE, INIITIAL_AMOUNT_TO_LOCK / 2);
        uint256 balanceLockerAfter = IERC20(token).balanceOf(address(veSDT));
        uint256 balanceUserAfter = IERC20(token).balanceOf(ALICE);
        uint256 balanceBobAfter = IERC20(token).balanceOf(BOB);

        assertEq(balanceLockerAfter - balanceLockerBefore, INIITIAL_AMOUNT_TO_LOCK / 2, "ERROR_030");
        assertEq(balanceUserBefore, balanceUserAfter, "ERROR_031");
        assertEq(balanceBobBefore - balanceBobAfter, INIITIAL_AMOUNT_TO_LOCK / 2, "ERROR_032");
    }

    function test04LockMoreWithSameDuration() public {
        vm.prank(ALICE);
        veSDT.create_lock(INIITIAL_AMOUNT_TO_LOCK / 2, block.timestamp + Constants.WEEK);

        uint256 balanceUserBefore = IERC20(token).balanceOf(ALICE);
        uint256 balanceLockerBefore = balanceUserBefore = IERC20(token).balanceOf(address(veSDT));
        vm.prank(ALICE);
        veSDT.increase_amount(INIITIAL_AMOUNT_TO_LOCK / 2);
        uint256 balanceUserAfter = IERC20(token).balanceOf(ALICE);
        uint256 balanceLockerAfter = balanceUserBefore = IERC20(token).balanceOf(address(veSDT));

        assertEq(balanceLockerAfter - balanceLockerBefore, INIITIAL_AMOUNT_TO_LOCK / 2, "ERROR_040");
        assertEq(balanceUserBefore - balanceUserAfter, INIITIAL_AMOUNT_TO_LOCK, "ERROR_041");
    }

    function test05LockForMaxPeriod() public {
        uint256 balanceLockerBefore = IERC20(token).balanceOf(address(veSDT));
        uint256 balanceUserBefore = IERC20(token).balanceOf(ALICE);
        vm.prank(ALICE);
        veSDT.create_lock(INIITIAL_AMOUNT_TO_LOCK, block.timestamp + MAX_DURATION);
        uint256 balanceLockerAfter = IERC20(token).balanceOf(address(veSDT));
        uint256 balanceUserAfter = IERC20(token).balanceOf(ALICE);

        assertEq(balanceLockerAfter - balanceLockerBefore, INIITIAL_AMOUNT_TO_LOCK, "ERROR_050");
        assertEq(balanceUserBefore - balanceUserAfter, INIITIAL_AMOUNT_TO_LOCK, "ERROR_051");
    }

    function test06RevertWhenLockLongerMaxPeriod() public {
        uint256 balanceLockerBefore = IERC20(token).balanceOf(address(veSDT));
        uint256 balanceUserBefore = IERC20(token).balanceOf(ALICE);
        vm.expectRevert(bytes("Voting lock can be 4 years max"));
        vm.prank(ALICE);
        veSDT.create_lock(INIITIAL_AMOUNT_TO_LOCK, block.timestamp + MAX_DURATION + Constants.WEEK);
        uint256 balanceLockerAfter = IERC20(token).balanceOf(address(veSDT));
        uint256 balanceUserAfter = IERC20(token).balanceOf(ALICE);

        assertEq(balanceLockerAfter, balanceLockerBefore, "ERROR_060");
        assertEq(balanceUserBefore, balanceUserAfter, "ERROR_061");
    }

    function test07IncreaseLockDuration() public {
        uint256 balanceUserBefore = IERC20(token).balanceOf(ALICE);
        vm.prank(ALICE);
        veSDT.create_lock(INIITIAL_AMOUNT_TO_LOCK, block.timestamp + Constants.WEEK);
        uint256 balanceUserAfter = IERC20(token).balanceOf(ALICE);

        vm.prank(ALICE);
        veSDT.increase_unlock_time(block.timestamp + Constants.WEEK * 2);
    }

    function test08GetLockedAmount() public {
        vm.prank(ALICE);
        veSDT.create_lock(INIITIAL_AMOUNT_TO_LOCK, block.timestamp + Constants.WEEK);
        IVeSDT.LockedBalance memory locked = veSDT.locked(ALICE);

        assertEq(locked.amount, int256(INIITIAL_AMOUNT_TO_LOCK), "ERROR_080");
    }
}
