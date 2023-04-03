// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Vm.sol";
import "forge-std/Test.sol";
import "forge-std/console.sol";

import {IVePendle} from "contracts/interfaces/IVePendle.sol";
import {Constants} from "test/fixtures/Constants.sol";

import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {PendleLocker} from "contracts/lockers/PendleLocker.sol";
import {IVePendle} from "contracts/interfaces/IVePendle.sol";

contract PendleLockerTest is Test {
    IERC20 internal PENDLE;
    PendleLocker internal pendleLocker;
    IVePendle internal vePendle;

    function setUp() public virtual {
        uint256 forkId = vm.createFork(vm.rpcUrl("mainnet"));
        vm.selectFork(forkId);

        PENDLE = IERC20(Constants.PENDLE);
        vePendle = IVePendle(Constants.VE_PENDLE);

        // Deploy and Intialize the FpisLocker contract
        pendleLocker = new PendleLocker(address(this));

        // Mint PENDLE to the PendleLocker contract
        deal(address(PENDLE), address(pendleLocker), 100e18);
    }

    function testCreateLock() public {
        uint128 lockTime = (uint128(block.timestamp + 2 * Constants.YEAR) /
            uint128(Constants.WEEK)) * uint128(Constants.WEEK);
        pendleLocker.createLock(100e18, lockTime);
        assertApproxEqRel(
            vePendle.balanceOf(address(pendleLocker)),
            100e18,
            1e16
        ); // 1% Margin of Error
    }

    function testIncreaseLockAmount() public {
        uint128 lockTime = (uint128(block.timestamp + 2 * Constants.YEAR) /
            uint128(Constants.WEEK)) * uint128(Constants.WEEK);
        pendleLocker.createLock(100e18, lockTime);

        (uint256 lockedBalance, ) = vePendle.positionData(
            address(pendleLocker)
        );

        assertEq(lockedBalance, 100e18);

        deal(address(PENDLE), address(pendleLocker), 100e18);
        pendleLocker.increaseAmount(100e18);

        (lockedBalance, ) = vePendle.positionData(address(pendleLocker));
        assertEq(lockedBalance, 200e18);
    }

    function testIncreaseLockDuration() public {
        uint128 initialUnlockTime = (uint128(block.timestamp + Constants.YEAR) /
            uint128(Constants.WEEK)) * uint128(Constants.WEEK);
        uint128 newUnlockTime = (uint128(block.timestamp + Constants.YEAR) /
            uint128(Constants.WEEK)) * uint128(Constants.WEEK);

        pendleLocker.createLock(100e18, initialUnlockTime);
        (, uint128 end) = vePendle.positionData(address(pendleLocker));

        assertEq(end, initialUnlockTime);

        pendleLocker.increaseUnlockTime(newUnlockTime);

        (, end) = vePendle.positionData(address(pendleLocker));

        assertEq(end, newUnlockTime);
    }
}
