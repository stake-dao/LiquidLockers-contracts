// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "forge-std/Vm.sol";

import { Constants } from "./fixtures/Constants.sol";
import { AngleStrategy } from "../../contracts/strategy/AngleStrategy.sol";
import { VeSDTFeeAngleProxyV2 } from "../../contracts/accumulator/VeSDTFeeAngleProxyV2.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract VeSDTFeeAngleProxyV2Test is Test {

	address public angle;
    address public agEur;
	address public frax;
	AngleStrategy public angleStrategy;
    address[] public angleAgEurSushiPath;
	address public feeD;
	address public constant AG_EUR_FRAXBP_POOL = 0x58257e4291F95165184b4beA7793a1d6F8e7b627;

	VeSDTFeeAngleProxyV2 public proxyV2;
	
	address public alice = makeAddr("alice");
	address public bob = makeAddr("bob");
	
	function setUp() public {
		uint256 forkId = vm.createFork(vm.rpcUrl("mainnet"));
        vm.selectFork(forkId);
		angle = Constants.ANGLE;
		agEur = Constants.AG_EUR;
		frax = Constants.FRAX;
		angleAgEurSushiPath = [angle, agEur];
		feeD = Constants.FEE_D_SD;
		angleStrategy = AngleStrategy(Constants.ANGLE_STRATEGY);
		VeSDTFeeAngleProxyV2.CurveExchangeData memory curveExData = VeSDTFeeAngleProxyV2.CurveExchangeData(AG_EUR_FRAXBP_POOL, 0, 1);
        proxyV2 = new VeSDTFeeAngleProxyV2(angleAgEurSushiPath, curveExData);
		// set new fee proxy
		vm.prank(Constants.ANGLE_VOTER_V2);
		angleStrategy.setVeSDTProxy(address(proxyV2));
	}

	function testSendRewards() public {
		vm.startPrank(alice);
		// harvest agEur/Angle gauge
		address sdFrax3Crv = 0x5af15DA84A4a6EDf2d9FA6720De921E1026E37b7;
		address agEurAngleSLP = 0x1f4c763BdE1D4832B3EA0640e66Da00B98831355;
		uint256 proxyAngleBalanceBefore = IERC20(angle).balanceOf(address(proxyV2));
		assertEq(proxyAngleBalanceBefore, 0);
		angleStrategy.claim(agEurAngleSLP);
		uint256 claimableByKeeper = proxyV2.claimableByKeeper();
		uint256 proxyAngleBalanceAfter = IERC20(angle).balanceOf(address(proxyV2));
		// check that ANGLE tokens have been received by the proxyV2
		assertGt(proxyAngleBalanceAfter, proxyAngleBalanceBefore);
		// Send SdFRAX3CRV to feeD
		uint256 callerFraxBalanceBefore = IERC20(frax).balanceOf(alice);
		uint256 feeDBalanceBefore = IERC20(sdFrax3Crv).balanceOf(feeD);
		proxyV2.sendRewards();
		uint256 fraxClaimedByKeeper = IERC20(frax).balanceOf(alice);
		assertEq(claimableByKeeper, fraxClaimedByKeeper);
		uint256 callerFraxBalanceAfter = IERC20(frax).balanceOf(alice);
		uint256 angleBalance = IERC20(angle).balanceOf(address(proxyV2));
		uint256 agEurBalance = IERC20(agEur).balanceOf(address(proxyV2));
		uint256 fraxBalance = IERC20(frax).balanceOf(address(proxyV2));
		uint256 feeDBalanceAfter = IERC20(sdFrax3Crv).balanceOf(feeD);
		assertEq(angleBalance, 0);
		assertEq(agEurBalance, 0);
		assertEq(fraxBalance, 0);
		assertGt(feeDBalanceAfter, feeDBalanceBefore);
		assertGt(callerFraxBalanceAfter, callerFraxBalanceBefore);
		vm.stopPrank();
	}
}