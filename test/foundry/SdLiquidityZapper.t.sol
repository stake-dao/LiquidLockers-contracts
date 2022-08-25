// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;
import "forge-std/Vm.sol";
import "forge-std/Test.sol";
import "forge-std/console.sol";

import { SdLiquidityZapper } from "contracts/zappers/SdLiquidityZapper.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SdLiquidityZapperTest is Test {
	SdLiquidityZapper sdLiquidityZapper;
	///////////////////////////////////
	//////// CRV ADDRESSES
	///////////////////////////////////
	IERC20 public constant CRV = IERC20(0xD533a949740bb3306d119CC777fa900bA034cd52);
	address public constant SDCRV = 0xD1b5651E55D4CeeD36251c61c50C889B36F6abB5;
	address public constant CRVDEPOSITOR = 0xc1e3Ca8A3921719bE0aE3690A0e036feB4f69191;
	address public constant CRVSDCRVCURVEPOOL = 0xf7b55C3732aD8b2c2dA7c24f30A69f55c54FB717;
	address public constant CRVSDCRVSTRATEGYVAULT = 0xd6415fF2639835300Ab947Fe67BAd6F0B31400c1;
	address public constant CRVSDCRVSTRATGAUGE = 0x531167aBE95375Ec212f2b5417EF05a9953410C1;

	///////////////////////////////////
	//////// ANGLE ADDRESSES
	///////////////////////////////////

	IERC20 public constant ANGLE = IERC20(0x31429d1856aD1377A8A0079410B297e1a9e214c2);
	address public constant SDANGLE = 0x752B4c6e92d96467fE9b9a2522EF07228E00F87c;
	address public constant ANGLESDANGLECURVEPOOL = 0x48fF31bBbD8Ab553Ebe7cBD84e1eA3dBa8f54957;
	address public constant ANGLEDEPOSITOR = 0x8A97e8B3389D431182aC67c0DF7D46FF8DCE7121;
	address public constant ANGLESDANGLESTRATEGYVAULT = 0x2cFe0E7B0EfF280D74c2F406C05511B9B7c72549;
	address public constant ANGLESDANGLESTRATGAUGE = 0x1E3923A498de30ff8C5Ac8bfAb1De9AFa58fDE5d;

	///////////////////////////////////
	//////// BALANCER ADDRESSES
	///////////////////////////////////
	IERC20 public constant BAL = IERC20(0xba100000625a3754423978a60c9317c58a424e3D);
	address public constant BALDEPOSITOR = 0x3e0d44542972859de3CAdaF856B1a4FD351B4D2E;
	address public constant SDBALSTRATVAULT = 0x7ca0a95C96Cd34013d619EFfcb02f200A031210d;
	IERC20 public constant SDBALSTRATGAUGE = IERC20(0x76fB1951F3395031B3ec703a16567ab92E792770);

	function setUp() public {
		sdLiquidityZapper = new SdLiquidityZapper();
		sdLiquidityZapper.addDepositorForCurveBased(
			address(CRV),
			SDCRV,
			CRVDEPOSITOR,
			CRVSDCRVCURVEPOOL,
			CRVSDCRVSTRATEGYVAULT
		);
		sdLiquidityZapper.addDepositorForCurveBased(
			address(ANGLE),
			SDANGLE,
			ANGLEDEPOSITOR,
			ANGLESDANGLECURVEPOOL,
			ANGLESDANGLESTRATEGYVAULT
		);
		sdLiquidityZapper.changeDepositor(address(BAL), BALDEPOSITOR);
	}

	function testZapIntoSdCRV() public {
		uint256 balanceBeforeZap = IERC20(CRVSDCRVSTRATGAUGE).balanceOf(address(this));
		deal(address(CRV), address(this), 100e18);
		CRV.approve(address(sdLiquidityZapper), 100e18);
		sdLiquidityZapper.zapToSdCurvePool(address(CRV), 100e18, 50e18, 0, CRVSDCRVCURVEPOOL, CRVSDCRVSTRATEGYVAULT);
		uint256 balanceAfterZap = IERC20(CRVSDCRVSTRATGAUGE).balanceOf(address(this));
		assert(balanceBeforeZap == 0);
		assert(balanceAfterZap > 0);
	}

	function testZapIntoSdAngle() public {
		uint256 balanceBeforeZap = IERC20(ANGLESDANGLESTRATGAUGE).balanceOf(address(this));
		deal(address(ANGLE), address(this), 100e18);
		ANGLE.approve(address(sdLiquidityZapper), 100e18);
		sdLiquidityZapper.zapToSdCurvePool(
			address(ANGLE),
			100e18,
			50e18,
			0,
			ANGLESDANGLECURVEPOOL,
			ANGLESDANGLESTRATEGYVAULT
		);
		uint256 balanceAfterZap = IERC20(ANGLESDANGLESTRATGAUGE).balanceOf(address(this));
		assert(balanceBeforeZap == 0);
		assert(balanceAfterZap > 0);
	}

	function testZapIntoSdCRVSingleSide() public {
		uint256 balanceBeforeZap = IERC20(CRVSDCRVSTRATGAUGE).balanceOf(address(this));
		deal(address(CRV), address(this), 100e18);
		CRV.approve(address(sdLiquidityZapper), 100e18);
		sdLiquidityZapper.zapToSdCurvePool(address(CRV), 100e18, 0, 0, CRVSDCRVCURVEPOOL, CRVSDCRVSTRATEGYVAULT);
		uint256 balanceAfterZap = IERC20(CRVSDCRVSTRATGAUGE).balanceOf(address(this));
		uint256 crvBalanceAfter = CRV.balanceOf(address(this));
		assert(balanceBeforeZap == 0);
		assert(balanceAfterZap > balanceBeforeZap);
		assert(crvBalanceAfter == 0);
	}

	function testZapIntoSdBAl() public {
		uint256 balanceBeforeZap = SDBALSTRATGAUGE.balanceOf(address(this));
		deal(address(BAL), address(this), 100e18);
		BAL.approve(address(sdLiquidityZapper), 100e18);
		sdLiquidityZapper.zapToSdBalPool(100e18, 5000, 0, 0, SDBALSTRATVAULT);
		uint256 balancerAfterZap = SDBALSTRATGAUGE.balanceOf(address(this));
		assert(balanceBeforeZap == 0);
		assert(balancerAfterZap > 0);
	}

	function testZapIntoSdBalSingleSide() public {
		uint256 balanceBeforeZap = SDBALSTRATGAUGE.balanceOf(address(this));
		deal(address(BAL), address(this), 100e18);
		BAL.approve(address(sdLiquidityZapper), 100e18);
		sdLiquidityZapper.zapToSdBalPool(100e18, 0, 0, 0, SDBALSTRATVAULT);
		uint256 balancerAfterZap = SDBALSTRATGAUGE.balanceOf(address(this));
		assert(balanceBeforeZap == 0);
		assert(balancerAfterZap > 0);
	}
}
