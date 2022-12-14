// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "forge-std/Vm.sol";

import { Constants } from "./fixtures/Constants.sol";
import { CurveStrategy } from "../../contracts/strategies/curve/CurveStrategy.sol";
import { VeSDTFeeCurveProxyV2 } from "../../contracts/accumulators/VeSDTFeeCurveProxyV2.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract VeSDTFeeCurveProxyV2Test is Test {

	address public crv;
	address public usdc;
	address public frax;
	CurveStrategy public curveStrategy;
    address[] public crvUsdcSushiPath;
	address public feeD;
	address public constant USDC_FRAX_POOL = 0xDcEF968d416a41Cdac0ED8702fAC8128A64241A2;

	VeSDTFeeCurveProxyV2 public proxyV2;
	
	address public alice = makeAddr("alice");
	address public bob = makeAddr("bob");
	
	function setUp() public {
		uint256 forkId = vm.createFork(vm.rpcUrl("mainnet"));
        vm.selectFork(forkId);
		crv = Constants.CRV;
		usdc = Constants.USDC;
		frax = Constants.FRAX;
		feeD = Constants.FEE_D_SD;
        crvUsdcSushiPath = [crv, Constants.WETH, usdc];
		curveStrategy = CurveStrategy(Constants.CURVE_STRATEGY);
        proxyV2 = new VeSDTFeeCurveProxyV2(crvUsdcSushiPath);
		// set new fee proxy
		vm.prank(curveStrategy.governance());
		curveStrategy.setVeSDTProxy(address(proxyV2));
	}

	function testSendRewards() public {
		vm.startPrank(alice);
		// harvest agEur/Angle gauge
		address sdFrax3Crv = 0x5af15DA84A4a6EDf2d9FA6720De921E1026E37b7;
		address sdCrvLP = 0xf7b55C3732aD8b2c2dA7c24f30A69f55c54FB717;
		uint256 proxyCurveBalanceBefore = IERC20(crv).balanceOf(address(proxyV2));
		assertEq(proxyCurveBalanceBefore, 0);
		curveStrategy.claim(sdCrvLP);
		uint256 claimableByKeeper = proxyV2.claimableByKeeper();
		uint256 proxyCurveBalanceAfter = IERC20(crv).balanceOf(address(proxyV2));
		// check that CRV tokens have been received by the proxyV2
		assertGt(proxyCurveBalanceAfter, proxyCurveBalanceBefore);
		// Send SdFRAX3CRV to feeD
		uint256 callerFraxBalanceBefore = IERC20(frax).balanceOf(alice);
		uint256 feeDBalanceBefore = IERC20(sdFrax3Crv).balanceOf(feeD);
		proxyV2.sendRewards();
		uint256 fraxClaimedByKeeper = IERC20(frax).balanceOf(alice);
		assertEq(claimableByKeeper, fraxClaimedByKeeper);
		uint256 callerFraxBalanceAfter = IERC20(frax).balanceOf(alice);
		uint256 crvBalance = IERC20(crv).balanceOf(address(proxyV2));
		uint256 usdcBalance = IERC20(usdc).balanceOf(address(proxyV2));
		uint256 fraxBalance = IERC20(frax).balanceOf(address(proxyV2));
		uint256 feeDBalanceAfter = IERC20(sdFrax3Crv).balanceOf(feeD);
		assertEq(crvBalance, 0);
		assertEq(usdcBalance, 0);
		assertEq(fraxBalance, 0);
		assertGt(feeDBalanceAfter, feeDBalanceBefore);
		assertGt(callerFraxBalanceAfter, callerFraxBalanceBefore);
		vm.stopPrank();
	}
}