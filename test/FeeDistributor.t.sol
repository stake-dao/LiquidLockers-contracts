// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

// Base Tests
import "./baseTest/Base.t.sol";

import "contracts/dao/SmartWalletWhitelist.sol";
import "contracts/external/ProxyAdmin.sol";
import "contracts/external/TransparentUpgradeableProxy.sol";

// Interface
import "contracts/interfaces/IFeeDistributor.sol";
import "contracts/interfaces/IVeSDT.sol";

contract FeeDistributorTest is BaseTest {
    address internal constant LOCAL_DEPLOYER = address(0xDE);
    address internal constant ALICE = address(0xAA);
    address internal token = AddressBook.SDT;
    address internal reward = AddressBook.SD3CRV;

    uint256 internal constant INIITIAL_AMOUNT_TO_LOCK = 1_000e18;

    ProxyAdmin internal proxyAdmin;
    SmartWalletWhitelist internal smartWalletWhitelist;
    TransparentUpgradeableProxy internal proxy;

    IFeeDistributor internal feeDistributor;
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
        vm.prank(ALICE);
        IERC20(token).approve(address(veSDT), INIITIAL_AMOUNT_TO_LOCK);
    }

    function test01ClaimAfterFeeAreAdded() public {
        deployFeeDistributor();

        deal(reward, address(feeDistributor), 10e18);
        timeJump(1 weeks);
        vm.prank(ALICE);
        veSDT.create_lock(INIITIAL_AMOUNT_TO_LOCK, block.timestamp + 3 weeks);
        timeJump(5 weeks);
        uint256 rewardBalanceBeforeUser = IERC20(reward).balanceOf(ALICE);

        vm.prank(ALICE);
        feeDistributor.claim();

        assertEq(rewardBalanceBeforeUser, 0, "ERROR_010");
        assertEq(IERC20(reward).balanceOf(ALICE), 0, "ERROR_011");
        // Same as before because fees are added before user lock
    }

    function test02ClaimDuringDepositingFees() public {
        timeJump(1 weeks);
        vm.prank(ALICE);
        veSDT.create_lock(INIITIAL_AMOUNT_TO_LOCK, block.timestamp + 8 weeks);
        timeJump(1 weeks);

        deployFeeDistributor();

        vm.startPrank(LOCAL_DEPLOYER);
        for (uint8 i = 0; i < 3; ++i) {
            for (uint8 j = 0; j < 7; ++j) {
                deal(reward, address(feeDistributor), 1e18);
                IFeeDistributor(address(feeDistributor)).checkpoint_token();
                IFeeDistributor(address(feeDistributor)).checkpoint_total_supply();
                timeJump(1 days);
            }
        }
        timeJump(1 weeks);
        IFeeDistributor(address(feeDistributor)).checkpoint_token();
        IFeeDistributor(address(feeDistributor)).checkpoint_total_supply();
        vm.stopPrank();

        uint256 rewardBalanceBeforeUser = IERC20(reward).balanceOf(ALICE);
        vm.prank(ALICE);
        feeDistributor.claim();
        assertLt(IERC20(reward).balanceOf(ALICE) - rewardBalanceBeforeUser, 21e18, "ERROR_021");
    }

    function test03ClaimBeforeFeeAreAdded() public {
        vm.prank(ALICE);
        veSDT.create_lock(INIITIAL_AMOUNT_TO_LOCK, block.timestamp + 8 weeks);
        timeJump(1 weeks);

        timeJump(5 weeks);

        deployFeeDistributor();
        vm.startPrank(LOCAL_DEPLOYER);
        deal(reward, address(feeDistributor), 10e18);
        IFeeDistributor(address(feeDistributor)).checkpoint_token();
        timeJump(1 weeks);
        IFeeDistributor(address(feeDistributor)).checkpoint_token();
        vm.stopPrank();

        uint256 rewardBalanceBeforeUser = IERC20(reward).balanceOf(ALICE);
        vm.prank(ALICE);
        feeDistributor.claim();
        assertEq(IERC20(reward).balanceOf(ALICE) - rewardBalanceBeforeUser, 10e18, "ERROR_031");
    }

    function test04KillCheck() public {
        deployFeeDistributor();
        deal(reward, address(feeDistributor), 1e18);
        address receiver = IFeeDistributor(address(feeDistributor)).emergency_return();

        uint256 balanceBefore = IERC20(reward).balanceOf(receiver);
        vm.prank(LOCAL_DEPLOYER);
        IFeeDistributor(address(feeDistributor)).kill_me();
        assertEq(IERC20(reward).balanceOf(receiver) - balanceBefore, 1e18, "ERROR_041");
    }

    function test05Recovery() public {
        deployFeeDistributor();
        deal(token, address(feeDistributor), 1e18);
        address receiver = IFeeDistributor(address(feeDistributor)).emergency_return();

        uint256 balanceBefore = IERC20(token).balanceOf(receiver);
        vm.prank(LOCAL_DEPLOYER);
        IFeeDistributor(address(feeDistributor)).recover_balance(token);
        assertEq(IERC20(token).balanceOf(receiver) - balanceBefore, 1e18, "ERROR_051");
    }

    ////////////////////////////////////////////////////////////////
    /// --- HELPERS
    ///////////////////////////////////////////////////////////////
    function deployFeeDistributor() public {
        vm.prank(LOCAL_DEPLOYER);
        feeDistributor = IFeeDistributor(
            deployCode(
                "artifacts/vyper-contracts/FeeDistributor.vy/FeeDistributor.json",
                abi.encode(address(veSDT), block.timestamp, reward, LOCAL_DEPLOYER, AddressBook.STAKE_DAO_MULTISIG)
            )
        );
    }
}
