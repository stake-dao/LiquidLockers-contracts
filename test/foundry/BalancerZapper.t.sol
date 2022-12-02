// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

// Base Tests
import "./baseTest/Base.t.sol";

import "../../contracts/zappers/BalancerZapper.sol";

import "../../contracts/interfaces/ILiquidityGauge.sol";

contract BalancerZapperTest is BaseTest {
	address public constant SD_BAL = 0xF24d8651578a55b0C119B9910759a351A3458895;
	address public constant SD_BAL_GAUGE = 0x3E8C72655e48591d93e6dfdA16823dB0fF23d859;
	address public constant LOCAL_DEPLOYER = address(0xDE);
	address public constant ALICE = address(0xAA);

	uint256 public constant AMOUNT = 10e18;

	BalancerZapper public zapper;
	ILiquidityGauge public gauge;
	IERC20 public bal = IERC20(Constants.BAL);
	IERC20 public sdBal = IERC20(SD_BAL);

	function setUp() public {
		vm.prank(LOCAL_DEPLOYER);
		zapper = new BalancerZapper();
		gauge = ILiquidityGauge(SD_BAL_GAUGE);

		deal(Constants.BAL, LOCAL_DEPLOYER, AMOUNT * 100);
		deal(Constants.BAL, ALICE, AMOUNT * 100);
		vm.prank(LOCAL_DEPLOYER);
		bal.approve(address(zapper), type(uint256).max);
		vm.prank(ALICE);
		bal.approve(address(zapper), type(uint256).max);
	}

	function testZapFromBal() public {
		vm.startPrank(LOCAL_DEPLOYER);
		assertEq(sdBal.balanceOf(LOCAL_DEPLOYER), 0);

		zapper.zapFromBal(AMOUNT, false, false, 0, LOCAL_DEPLOYER);
		uint256 balance1 = sdBal.balanceOf(LOCAL_DEPLOYER);
		assertGt(balance1, 0, "ERROR_010");

		zapper.zapFromBal(AMOUNT, true, false, 0, LOCAL_DEPLOYER);
		uint256 balance2 = sdBal.balanceOf(LOCAL_DEPLOYER);
		assertGt(balance2 / 2, balance1, "ERROR_011");

		uint256 balanceBeforeGauge = gauge.balanceOf(LOCAL_DEPLOYER);

		zapper.zapFromBal(AMOUNT, true, true, 0, LOCAL_DEPLOYER);
		uint256 balance3 = sdBal.balanceOf(LOCAL_DEPLOYER);
		assertEq(balance3, balance2, "ERROR_012");

		uint256 balanceAfterGauge = gauge.balanceOf(LOCAL_DEPLOYER);
		assertGt(balanceAfterGauge, balanceBeforeGauge, "ERROR_013");

		assertEq(bal.balanceOf(address(zapper)), 0, "ERROR_014");
	}

	function testZapFromBalForOtherUser() public {
		vm.startPrank(LOCAL_DEPLOYER);

		zapper.zapFromBal(AMOUNT, false, false, 0, ALICE);
		uint256 balance1 = sdBal.balanceOf(ALICE);
		assertGt(balance1, 0, "ERROR_010");

		uint256 balanceBeforeGauge = gauge.balanceOf(ALICE);

		zapper.zapFromBal(AMOUNT, true, true, 0, ALICE);
		uint256 balance3 = sdBal.balanceOf(ALICE);
		assertEq(balance3, balance1, "ERROR_012");

		uint256 balanceAfterGauge = gauge.balanceOf(ALICE);
		assertGt(balanceAfterGauge, balanceBeforeGauge, "ERROR_013");

        assertEq(bal.balanceOf(address(zapper)), 0, "ERROR_014");
	}
}
