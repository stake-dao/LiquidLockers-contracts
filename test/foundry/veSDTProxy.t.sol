// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

// Base Tests
import "./baseTest/Base.t.sol";

import "../../contracts/dao/SmartWalletWhitelist.sol";
import "../../contracts/external/ProxyAdmin.sol";
import "../../contracts/external/TransparentUpgradeableProxy.sol";

// Interface
import "../../contracts/interfaces/IVeSDT.sol";

contract VeSDTProxyTest is BaseTest {
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
	IVeSDT internal veSDTImplNew;

	function setUp() public {
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
		veSDTImpl = IVeSDT(deployCode("artifacts/contracts/dao/veSDT.vy/veSDT.json"));
		veSDTImplNew = IVeSDT(deployCode("artifacts/contracts/dao/veSDT.vy/veSDT.json"));
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

	
	function test01LockBeforeUpgrade() public {
		uint256 balanceLockerBefore = IERC20(token).balanceOf(address(veSDT));
		uint256 balanceUserBefore = IERC20(token).balanceOf(ALICE);
		vm.prank(ALICE);
		veSDT.create_lock(INIITIAL_AMOUNT_TO_LOCK, block.timestamp + Constants.WEEK);
		uint256 balanceLockerAfter = IERC20(token).balanceOf(address(veSDT));
		uint256 balanceUserAfter = IERC20(token).balanceOf(ALICE);

		assertEq(balanceLockerAfter - balanceLockerBefore, INIITIAL_AMOUNT_TO_LOCK, "ERROR_010");
		assertEq(balanceUserBefore - balanceUserAfter, INIITIAL_AMOUNT_TO_LOCK, "ERROR_011");
	}

	function test02UpgradeVeSDTContract() public {
		console.log(address(veSDT));
		upgradeProxy();
	}

	function test03LockAfterUpgrade() public {
		uint256 balanceLockerBefore = IERC20(token).balanceOf(address(veSDT));
		uint256 balanceUserBefore = IERC20(token).balanceOf(ALICE);
		vm.prank(ALICE);
		veSDT.create_lock(INIITIAL_AMOUNT_TO_LOCK / 2, block.timestamp + Constants.WEEK);

		upgradeProxy();

		vm.prank(ALICE);
		veSDT.increase_amount(INIITIAL_AMOUNT_TO_LOCK / 2);
		uint256 balanceLockerAfter = IERC20(token).balanceOf(address(veSDT));
		uint256 balanceUserAfter = IERC20(token).balanceOf(ALICE);

		assertEq(balanceLockerAfter - balanceLockerBefore, INIITIAL_AMOUNT_TO_LOCK, "ERROR_010");
		assertEq(balanceUserBefore - balanceUserAfter, INIITIAL_AMOUNT_TO_LOCK, "ERROR_011");
	}

	////////////////////////////////////////////////////////////////
	/// --- HELPER
	///////////////////////////////////////////////////////////////
	function upgradeProxy() public {
		vm.prank(LOCAL_DEPLOYER);
		proxyAdmin.upgrade(TransparentUpgradeableProxy(payable(address(veSDT))), address(veSDTImplNew));
	}
}
