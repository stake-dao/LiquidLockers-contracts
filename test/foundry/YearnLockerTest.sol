// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;
import "forge-std/Vm.sol";
import "forge-std/Test.sol";
import "forge-std/console.sol";

import { YearnLocker } from "contracts/YearnLocker.sol";
import { IVeYFI } from "contracts/interfaces/IVeYFI.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract YearnLockerTest is Test {
	YearnLocker yearnLocker;
	IVeYFI veYFI;
	address public rewardPool;
	IERC20 public constant YFI = IERC20(0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e);
	uint256 constant ONE_YEAR = 60 * 60 * 24 * 365;

	function setUp() public {
		veYFI = IVeYFI(
			deployCode(
				"artifacts/contracts/external/VotingYFI.vy/VotingYFI.json",
				abi.encode(YFI, 0x185a4dc360CE69bDCceE33b3784B0282f7961aea)
			)
		);
		rewardPool = deployCode(
			"artifacts/contracts/external/RewardPool.vy/RewardPool.json",
			abi.encode(0xCe71065D4017F316EC606Fe4422e11eB2c47c246, block.timestamp)
		);

		yearnLocker = new YearnLocker(address(this), address(veYFI));
	}

	function testCreateLock() public {
		deal(address(YFI), address(yearnLocker), 100e18);
		yearnLocker.createLock(100e18, block.timestamp + ONE_YEAR);
	}

	function testIncreaseLockAmount() public {
		deal(address(YFI), address(yearnLocker), 200e18);
		yearnLocker.createLock(100e18, block.timestamp + ONE_YEAR);
		yearnLocker.increaseAmount(100e18);
	}

	function testIncreaseLockDuration() public {
		deal(address(YFI), address(yearnLocker), 100e18);
		yearnLocker.createLock(100e18, block.timestamp + ONE_YEAR);
		yearnLocker.increaseUnlockTime(block.timestamp + 2 * ONE_YEAR);
	}

	function testWithdrawWithPenalty() public {
		uint256 balanceBefore = YFI.balanceOf(address(this));
		deal(address(YFI), address(yearnLocker), 100e18);
		yearnLocker.createLock(100e18, block.timestamp + ONE_YEAR);
		yearnLocker.release(address(this));
		uint256 balanceAfter = YFI.balanceOf(address(this));
		assertEq(balanceBefore, 0);
		assertGt(balanceAfter, balanceBefore);
	}

	function testClaimRewards() public {}
}
