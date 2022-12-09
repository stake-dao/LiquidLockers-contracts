// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Vm.sol";
import "forge-std/Test.sol";
import "forge-std/console.sol";

import { sdToken } from "contracts/tokens/sdToken.sol";
import { YearnLocker } from "contracts/lockers/YearnLocker.sol";
import { IVeYFI } from "contracts/interfaces/IVeYFI.sol";
import { DepositorV2 } from "contracts/depositors/DepositorV2.sol";
import { Constants } from "test/foundry/fixtures/Constants.sol";
import { Constants } from "test/foundry/fixtures/Constants.sol";
import { IRewardPool } from "contracts/interfaces/IRewardPool.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ILiquidityGauge } from "contracts/interfaces/ILiquidityGauge.sol";
import { YearnAccumulator } from "contracts/accumulators/YearnAccumulator.sol";
import { TransparentUpgradeableProxy } from "contracts/external/TransparentUpgradeableProxy.sol";

contract YearnIntegrationTest is Test {

     ////////////////////////////////////////////////////////////////
    /// --- TEST STORAGE
    ///////////////////////////////////////////////////////////////

	// External Contracts
	IRewardPool internal rewardPool = IRewardPool(Constants.YFI_REWARD_POOL);
	YearnLocker internal yearnLocker;

	// Liquid Lockers Contracts
	IERC20 internal YFI = IERC20(Constants.YFI);
	IVeYFI internal veYFI = IVeYFI(Constants.VE_YFI);
	sdToken internal sdYFI;

    DepositorV2 internal depositor;
	ILiquidityGauge internal liquidityGauge;
	YearnAccumulator internal yearnAccumulator;

	// Helper
	uint internal constant amount = 100e18;

	function setUp() public virtual {
		uint256 forkId = vm.createFork(vm.rpcUrl("mainnet"));
		vm.selectFork(forkId);

		sdYFI = new sdToken("Stake DAO YFI", "sdYFI");
	
		address liquidityGaugeImpl = 
			deployCode(
				"artifacts/contracts/staking/LiquidityGaugeV4.vy/LiquidityGaugeV4.json");

		// Deploy LiquidityGauge
		liquidityGauge = ILiquidityGauge(address(new TransparentUpgradeableProxy(
			liquidityGaugeImpl,
			Constants.PROXY_ADMIN,
			abi.encodeWithSignature(
				"initialize(address,address,address,address,address,address)",
				address(sdYFI),
				address(this),
				Constants.SDT,
				Constants.VE_SDT,
				Constants.VE_SDT_BOOST_PROXY,
				Constants.SDT_DISTRIBUTOR
			)
		)));


		// Deploy and Intialize the YearnLocker contract
		yearnLocker = new YearnLocker(address(this), address(veYFI), address(rewardPool));
		yearnLocker.approveUnderlying();

        // Deploy Depositor Contract
        depositor = new DepositorV2(Constants.YFI, address(yearnLocker), address(sdYFI), 4 * Constants.YEAR);
		depositor.setGauge(address(liquidityGauge));
		sdYFI.setOperator(address(depositor));
		yearnLocker.setYFIDepositor(address(depositor));

		// Deploy Accumulator Contract
		yearnAccumulator = new YearnAccumulator(address(Constants.YFI), address(liquidityGauge));
		yearnAccumulator.setLocker(address(yearnLocker));
		yearnLocker.setAccumulator(address(yearnAccumulator));

		// Add Reward to LGV4
		liquidityGauge.add_reward(Constants.YFI, address(yearnAccumulator));

		// Mint YFI to the adresss(this)
		deal(address(YFI), address(yearnLocker), amount);

		yearnLocker.createLock(amount, block.timestamp + 4 * Constants.YEAR);

		// Mint YFI to the adresss(this)
		deal(address(YFI), address(this), amount);
	}

	function testInitialStateDepositor() public {
		uint end = veYFI.locked(address(yearnLocker)).end;
		assertEq(end, depositor.unlockTime());
	}

    function testDepositThroughtDepositor() public {
		// Deposit YFI to the YearnLocker through the Depositor
		YFI.approve(address(depositor), amount);
		depositor.deposit(amount, true, false, address(this));

		assertEq(sdYFI.balanceOf(address(this)), amount);
		assertEq(liquidityGauge.balanceOf(address(this)), 0);
    }

    function testDepositThroughtDepositorWithStake() public {
		// Deposit YFI to the YearnLocker through the Depositor
		YFI.approve(address(depositor), amount);
		depositor.deposit(amount, true, true, address(this));

		assertEq(liquidityGauge.balanceOf(address(this)), amount);
    }

    function testDepositorIncreaseTime() public {
		// Deposit YFI to the YearnLocker through the Depositor
		YFI.approve(address(depositor), amount);
		depositor.deposit(amount, true, true, address(this));

		assertEq(liquidityGauge.balanceOf(address(this)), amount);
		uint oldEnd = veYFI.locked(address(yearnLocker)).end;
		// Increase Time
		vm.warp(block.timestamp + 2 * Constants.WEEK);
		uint newExpectedEnd = (block.timestamp + 4 * Constants.YEAR) / Constants.WEEK * Constants.WEEK;

		deal(address(YFI), address(this), amount);
		YFI.approve(address(depositor), amount);
		depositor.deposit(amount, true, true, address(this));

		uint end = veYFI.locked(address(yearnLocker)).end;

		assertGt(end, oldEnd);
		assertEq(end, newExpectedEnd);
		assertEq(liquidityGauge.balanceOf(address(this)), 2 * amount);
    }

	function testAccumulatorRewards() public {
		// Fill the Reward Pool with YFI.
		deal(address(YFI), address(rewardPool), amount);

		vm.warp(block.timestamp + 2 * Constants.WEEK);
		rewardPool.checkpoint_token();

		assertEq(YFI.balanceOf(address(liquidityGauge)), 0);
		yearnAccumulator.claimAndNotifyAll();
		assertGt(YFI.balanceOf(address(liquidityGauge)), 0);
	}
}
