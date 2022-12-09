// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

// Base Tests
import "./baseTest/Base.t.sol";

import "../../contracts/strategies/balancer/BalancerStrategy.sol";
import "../../contracts/strategies/balancer/BalancerVault.sol";
import "../../contracts/accumulators/BalancerAccumulator.sol";
import "../../contracts/external/TransparentUpgradeableProxy.sol";
import "../../contracts/external/ProxyAdmin.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

import "../../contracts/interfaces/ILiquidityGaugeStrat.sol";

interface IVault {
	struct JoinPoolRequest {
		address[] assets;
		uint256[] maxAmountsIn;
		bytes userData;
		bool fromInternalBalance;
	}
}

interface IBalancerHelper {
	function queryJoin(
		bytes32 poolId,
		address sender,
		address recipient,
		IVault.JoinPoolRequest memory request
	) external returns (uint256 bptOut, uint256[] memory amountsIn);
}

contract BalancerVaultTest is BaseTest {
	address public constant STETH_STABLE_POOL = 0x32296969Ef14EB0c6d29669C550D4a0449130230;
	address public constant OHM_DAI_WETH_POOL = 0xc45D42f801105e861e86658648e3678aD7aa70f9;
	address public constant STRATEGY = 0x873b031Ea6E4236E44d933Aae5a66AF6d4DA419d;
	address public constant LOCAL_DEPLOYER = address(0xDE);
	address public constant ALICE = address(0xAA);

	bytes32 public constant STETH_STABLE_POOL_ID = 0x32296969ef14eb0c6d29669c550d4a0449130230000200000000000000000080;
	bytes32 public constant OHM_DAI_WETH_POOL_ID = 0xc45d42f801105e861e86658648e3678ad7aa70f900010000000000000000011e;

	IBalancerHelper public helper;
	ILiquidityGaugeStrat public liquidityGaugeImpl;
	ILiquidityGaugeStrat public liquidityGauge;
	ILiquidityGaugeStrat public weightedPoolLiquidityGauge;
	ProxyAdmin internal proxyAdmin;
	BalancerAccumulator public accumulator;
	BalancerStrategy public strategy;
	BalancerVault public vault;
	BalancerVault public weightedPoolVault;
	TransparentUpgradeableProxy internal proxy;

	function setUp() public {
		uint256 forkId = vm.createFork(vm.rpcUrl("mainnet"));
		vm.selectFork(forkId);

		vm.startPrank(LOCAL_DEPLOYER);
		proxyAdmin = new ProxyAdmin();
		helper = IBalancerHelper(Constants.BALANCER_HELPER);
		accumulator = BalancerAccumulator(IBaseLocker(Constants.BALANCER_LOCKER).accumulator());
		strategy = new BalancerStrategy(
			ILocker(Constants.BALANCER_LOCKER),
			LOCAL_DEPLOYER,
			LOCAL_DEPLOYER,
			accumulator,
			LOCAL_DEPLOYER,
			LOCAL_DEPLOYER
		);
		vault = new BalancerVault();
		weightedPoolVault = new BalancerVault();
		vault.init(ERC20Upgradeable(STETH_STABLE_POOL), LOCAL_DEPLOYER, "vaultToken", "vaultToken", strategy);
		weightedPoolVault.init(ERC20Upgradeable(OHM_DAI_WETH_POOL), LOCAL_DEPLOYER, "vaultToken", "vaultToken", strategy);

		// Deploy Liquidity Gauge V4
		bytes memory lgData = abi.encodeWithSignature(
			"initialize(address,address,address,address,address,address,address,string)",
			address(vault),
			LOCAL_DEPLOYER,
			Constants.SDT,
			Constants.VE_SDT,
			Constants.VE_SDT_BOOST_PROXY,
			LOCAL_DEPLOYER,
			address(vault),
			"gauge"
		);
		liquidityGaugeImpl = ILiquidityGaugeStrat(
			deployCode("artifacts/contracts/staking/LiquidityGaugeV4Strat.vy/LiquidityGaugeV4Strat.json")
		);
		proxy = new TransparentUpgradeableProxy(address(liquidityGaugeImpl), address(proxyAdmin), lgData);
		liquidityGauge = ILiquidityGaugeStrat(address(proxy));

		// Deploy Liquidity Gauge V4 for wieghted vault
		lgData = abi.encodeWithSignature(
			"initialize(address,address,address,address,address,address,address,string)",
			address(weightedPoolVault),
			LOCAL_DEPLOYER,
			Constants.SDT,
			Constants.VE_SDT,
			Constants.VE_SDT_BOOST_PROXY,
			LOCAL_DEPLOYER,
			address(weightedPoolVault),
			"gauge"
		);
		proxy = new TransparentUpgradeableProxy(address(liquidityGaugeImpl), address(proxyAdmin), lgData);
		weightedPoolLiquidityGauge = ILiquidityGaugeStrat(address(proxy));

		vault.setLiquidityGauge(address(liquidityGauge));
		weightedPoolVault.setLiquidityGauge(address(weightedPoolLiquidityGauge));
		vm.stopPrank();

		deal(Constants.WSTETH, LOCAL_DEPLOYER, 1_000e18);
		deal(Constants.WETH, LOCAL_DEPLOYER, 1_000e18);
        deal(Constants.DAI, LOCAL_DEPLOYER, 1_000e18);
        deal(Constants.OHM, LOCAL_DEPLOYER, 1_000e18);
	}

	function testDepositWithUnderlyingToken() public {
		vm.startPrank(LOCAL_DEPLOYER);
		IERC20(Constants.WSTETH).approve(address(vault), type(uint256).max);
		IERC20(Constants.WETH).approve(address(vault), type(uint256).max);
		address[] memory array1 = new address[](2);
		uint256[] memory array2 = new uint256[](2);
		array1[0] = address(Constants.WSTETH);
		array1[1] = address(Constants.WETH);
		array2[0] = 1e18;
		array2[1] = 1e18;
		(uint256 bptOut, ) = IBalancerHelper(Constants.BALANCER_HELPER).queryJoin(
			STETH_STABLE_POOL_ID,
			LOCAL_DEPLOYER,
			LOCAL_DEPLOYER,
			IVault.JoinPoolRequest(array1, array2, abi.encode(1, array2, 1e18), false)
		);

		vault.provideLiquidityAndDeposit(LOCAL_DEPLOYER, array2, false, bptOut);

		uint256 keeperCut = (bptOut * 10) / 10000;
		uint256 expectedLiquidityGaugeTokenAmount = bptOut - keeperCut;
		uint256 lpBalanceAfter = IERC20(STETH_STABLE_POOL).balanceOf(address(vault));
		uint256 gaugeTokenBalanceAfter = liquidityGauge.balanceOf(LOCAL_DEPLOYER);
		uint256 wETHBalanceOfVault = IERC20(Constants.WETH).balanceOf(address(vault));
		uint256 wstETHBalanceOfVault = IERC20(Constants.WSTETH).balanceOf(address(vault));

		assertEq(lpBalanceAfter, bptOut, "ERROR_010");
		assertEq(gaugeTokenBalanceAfter, expectedLiquidityGaugeTokenAmount, "ERROR_011");
		assertEq(wETHBalanceOfVault, 0, "ERROR_012");
		assertEq(wstETHBalanceOfVault, 0, "ERROR_013");
	}

	function testDepositWithUnderlyingTokenToWeightedPool() public {
        vm.startPrank(LOCAL_DEPLOYER);
		IERC20(Constants.OHM).approve(address(weightedPoolVault), type(uint256).max);
		IERC20(Constants.DAI).approve(address(weightedPoolVault), type(uint256).max);
		IERC20(Constants.WETH).approve(address(weightedPoolVault), type(uint256).max);
		address[] memory array1 = new address[](3);
		uint256[] memory array2 = new uint256[](3);
		array1[0] = address(Constants.OHM);
		array1[1] = address(Constants.DAI);
		array1[2] = address(Constants.WETH);
		array2[0] = 10e18;
		array2[1] = 170e18;
		array2[2] = 1e18;
		(uint256 bptOut, ) = IBalancerHelper(Constants.BALANCER_HELPER).queryJoin(
			OHM_DAI_WETH_POOL_ID,
			LOCAL_DEPLOYER,
			LOCAL_DEPLOYER,
			IVault.JoinPoolRequest(array1, array2, abi.encode(1, array2, 1e18), false)
		);
		weightedPoolVault.provideLiquidityAndDeposit(LOCAL_DEPLOYER, array2, false, bptOut);
        vm.stopPrank();

		uint256 keeperCut = (bptOut * 10) / 10000;
		uint256 expectedLiquidityGaugeTokenAmount = bptOut - keeperCut;
		uint256 gaugeTokenBalanceAfter = weightedPoolLiquidityGauge.balanceOf(LOCAL_DEPLOYER);

		uint256 lpBalanceAfter = IERC20(OHM_DAI_WETH_POOL).balanceOf(address(weightedPoolVault));
		uint256 wETHBalanceOfVault = IERC20(Constants.WETH).balanceOf(address(weightedPoolVault));
		uint256 daiBalanceOfVault = IERC20(Constants.DAI).balanceOf(address(weightedPoolVault));
        uint256 ohmBalanceOfVault = IERC20(Constants.OHM).balanceOf(address(weightedPoolVault));

		assertEq(lpBalanceAfter, bptOut, "ERROR_020");
		assertEq(gaugeTokenBalanceAfter, expectedLiquidityGaugeTokenAmount, "ERROR_021");
		assertEq(wETHBalanceOfVault, 0, "ERROR_022");
		assertEq(daiBalanceOfVault, 0, "ERROR_023");
        assertEq(ohmBalanceOfVault, 0, "ERROR_023");
	}

    function testDepositWithSingleUnderlyingToken() public {
        vm.startPrank(LOCAL_DEPLOYER);
		IERC20(Constants.OHM).approve(address(weightedPoolVault), type(uint256).max);
		address[] memory array1 = new address[](3);
		uint256[] memory array2 = new uint256[](3);
		array1[0] = address(Constants.OHM);
		array1[1] = address(Constants.DAI);
		array1[2] = address(Constants.WETH);
		array2[0] = 10e18;
		array2[1] = 0;
		array2[2] = 0;
		(uint256 bptOut, ) = IBalancerHelper(Constants.BALANCER_HELPER).queryJoin(
			OHM_DAI_WETH_POOL_ID,
			LOCAL_DEPLOYER,
			LOCAL_DEPLOYER,
			IVault.JoinPoolRequest(array1, array2, abi.encode(1, array2, 1e18), false)
		);
		weightedPoolVault.provideLiquidityAndDeposit(LOCAL_DEPLOYER, array2, false, bptOut);
        vm.stopPrank();

		uint256 lpBalanceAfter = IERC20(OHM_DAI_WETH_POOL).balanceOf(address(weightedPoolVault));
        uint256 ohmBalanceOfVault = IERC20(Constants.OHM).balanceOf(address(weightedPoolVault));

        assertEq(ohmBalanceOfVault, 0, "ERROR_030");
        assertEq(lpBalanceAfter, bptOut, "ERROR_031");

    }
}
