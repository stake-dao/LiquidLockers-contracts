// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

// Base Tests
import "./baseTest/Base.t.sol";

import "contracts/factories/BalancerVaultFactory.sol";
import "contracts/strategies/balancer/BalancerStrategy.sol";
import { VeSDTFeeBalancerProxy } from "contracts/accumulators/VeSDTFeeBalancerProxy.sol";

import "contracts/interfaces/ILiquidityGaugeStrat.sol";

contract BalancerStrategyTest is BaseTest {
	address public constant WSTETH_ETH_BPT = 0x32296969Ef14EB0c6d29669C550D4a0449130230; // 1
	address public constant WSTETH_ETH_GAUGE = 0xcD4722B7c24C29e0413BDCd9e51404B4539D14aE;
	address public constant BADGER_WBTC_BPT = 0xb460DAa847c45f1C4a41cb05BFB3b51c92e41B36; // 2
	address public constant BADGER_WBTC_GAUGE = 0xAF50825B010Ae4839Ac444f6c12D44b96819739B;

	address public constant STRATEGY = 0x873b031Ea6E4236E44d933Aae5a66AF6d4DA419d;
	address public constant LOCAL_DEPLOYER = address(0xDE);
	address public constant ALICE = address(0xAA);
	address public immutable LOCKER = Constants.BALANCER_LOCKER;
	address public balancerStrategyGov;

	uint256 public constant AMOUNT = 100e18;

	BalancerVaultFactory public factory;
	BalancerStrategy public strategy;
	VeSDTFeeBalancerProxy public feeProxy;
	BalancerVault public vault1;
	BalancerVault public vault2;

	ILiquidityGaugeStrat public gauge1;
	ILiquidityGaugeStrat public gauge2;

	function setUp() public {
		uint256 forkId = vm.createFork(vm.rpcUrl("mainnet"));
		vm.selectFork(forkId);

		// Cannot be deployed because the BALANCER_STRATEGY is hardcoded on the vault1 factory contract
		// So BALANCER_STRATEGY need to be forked from mainnet too
		strategy = BalancerStrategy(STRATEGY);
		balancerStrategyGov = strategy.governance();
		vm.startPrank(LOCAL_DEPLOYER);
		feeProxy = new VeSDTFeeBalancerProxy();
		factory = new BalancerVaultFactory();
		vm.stopPrank();

		vm.prank(balancerStrategyGov);
		strategy.setVaultGaugeFactory(address(factory));
		assertEq(IBaseLocker(LOCKER).governance(), address(strategy), "Locker gov != strategy");

		vm.startPrank(LOCAL_DEPLOYER);
		// Deploy Vault and gauge1 for WSTETH_ETH_BPT
		vm.recordLogs();
		factory.cloneAndInit(WSTETH_ETH_GAUGE);
		Vm.Log[] memory logs = vm.getRecordedLogs();
		//bytes32[] memory event1Name = logs[0].topics;
		//bytes32[] memory event2Name = logs[1].topics;
		bytes memory eventData1 = logs[0].data;
		bytes memory eventData3 = logs[2].data;
		vault1 = BalancerVault(bytesToAddressCustom(eventData1, 32));
		gauge1 = ILiquidityGaugeStrat(bytesToAddressCustom(eventData3, 32));

		// Deploy Vault and gauge1 for BADGER_WBTC_BPT
		vm.recordLogs();
		factory.cloneAndInit(BADGER_WBTC_GAUGE);
		logs = vm.getRecordedLogs();
		//bytes32[] memory event1Name = logs[0].topics;
		//bytes32[] memory event2Name = logs[1].topics;
		eventData1 = logs[0].data;
		eventData3 = logs[2].data;
		vault2 = BalancerVault(bytesToAddressCustom(eventData1, 32));
		gauge2 = ILiquidityGaugeStrat(bytesToAddressCustom(eventData3, 32));

		vm.stopPrank();

		deal(WSTETH_ETH_BPT, ALICE, AMOUNT);
		deal(BADGER_WBTC_BPT, ALICE, AMOUNT);
	}

	function testDepositingBPTsIntoVaultAndGetGaugeToken() public {
		vm.startPrank(ALICE);
		uint256 balanceBeforeVault = IERC20(WSTETH_ETH_BPT).balanceOf(address(vault1));
		uint256 balanceBeforeALICE = gauge1.balanceOf(ALICE);
		IERC20(WSTETH_ETH_BPT).approve(address(vault1), AMOUNT);
		vault1.deposit(ALICE, AMOUNT, true);
		uint256 balanceAfterVault = IERC20(WSTETH_ETH_BPT).balanceOf(address(vault1));
		uint256 balanceAfterAlice = gauge1.balanceOf(ALICE);

		assertEq(balanceBeforeVault, 0, "ERROR_010");
		assertEq(balanceAfterVault, 0, "ERROR_011");
		assertEq(balanceAfterAlice, balanceBeforeALICE + AMOUNT, "ERROR_012");

		balanceBeforeVault = IERC20(BADGER_WBTC_BPT).balanceOf(address(vault2));
		balanceBeforeALICE = gauge2.balanceOf(ALICE);
		IERC20(BADGER_WBTC_BPT).approve(address(vault2), AMOUNT);
		vault2.deposit(ALICE, AMOUNT, true);
		balanceAfterVault = IERC20(BADGER_WBTC_BPT).balanceOf(address(vault2));
		balanceAfterAlice = gauge2.balanceOf(ALICE);

		assertEq(balanceBeforeVault, 0, "ERROR_013");
		assertEq(balanceAfterVault, 0, "ERROR_014");
		assertEq(balanceAfterAlice, balanceBeforeALICE + AMOUNT, "ERROR_015");
		vm.stopPrank();
	}

	function testClaimBALRewardWithoutSDT() public {
		vm.startPrank(ALICE);
		IERC20(WSTETH_ETH_BPT).approve(address(vault1), AMOUNT);
		vault1.deposit(ALICE, AMOUNT, true);
		vm.stopPrank();

		// simulate LDO rewards
		vm.prank(0x3e40D73EB977Dc6a537aF587D48316feE66E9C8c); // Lido treasury
		IERC20(Constants.LDO).transfer(address(strategy), AMOUNT);

		// add LDO as reward token on the LGV4
		vm.prank(factory.GOVERNANCE());
		gauge1.add_reward(Constants.LDO, address(strategy));

		timeJump(6 days);

		uint256 balanceBeforeGaugeBAL = IERC20(Constants.BAL).balanceOf(address(gauge1));
		uint256 balanceBeforeGaugeSDT = IERC20(Constants.SDT).balanceOf(address(gauge1));
		uint256 balanceBeforeGaugeLDO = IERC20(Constants.LDO).balanceOf(address(gauge1));
		strategy.claim(WSTETH_ETH_BPT);
		uint256 balanceAfterGaugeBAL = IERC20(Constants.BAL).balanceOf(address(gauge1));
		uint256 balanceAfterGaugeSDT = IERC20(Constants.SDT).balanceOf(address(gauge1));
		uint256 balanceAfterGaugeLDO = IERC20(Constants.LDO).balanceOf(address(gauge1));

		assertGt(balanceAfterGaugeBAL, balanceBeforeGaugeBAL, "ERROR_020");
		assertGt(balanceAfterGaugeLDO, balanceBeforeGaugeLDO, "ERROR_021");
		assertEq(balanceAfterGaugeSDT, balanceBeforeGaugeSDT, "ERROR_022");
	}
}
