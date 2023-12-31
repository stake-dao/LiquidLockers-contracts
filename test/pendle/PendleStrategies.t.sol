// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Vm.sol";
import "forge-std/Test.sol";
import "forge-std/console.sol";

import {AddressBook} from "addressBook/AddressBook.sol";
import {Constants} from "test/fixtures/Constants.sol";

import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {PendleLocker} from "contracts/lockers/PendleLocker.sol";
import {ILocker} from "contracts/interfaces/ILocker.sol";
import {ILiquidityGaugeStrat} from "contracts/interfaces/ILiquidityGaugeStrat.sol";
import {PendleVaultFactory} from "contracts/factories/PendleVaultFactory.sol";
import {PendleStrategy} from "contracts/strategies/pendle/PendleStrategy.sol";
import {PendleVault} from "contracts/strategies/pendle/PendleVault.sol";

interface ILpt {
    function redeemRewards(address) external;
}

contract PendleStrategiesTest is Test {
    IERC20 internal PENDLE = IERC20(0x808507121B80c02388fAd14726482e061B8da827);
    ILocker public constant LOCKER = ILocker(0xD8fa8dC5aDeC503AcC5e026a98F32Ca5C1Fa289A);
    PendleVaultFactory public factory;
    PendleStrategy public strategy;

    address public stEth25Dec2025Lpt = 0xC374f7eC85F8C7DE3207a10bB1978bA104bdA3B2;
    PendleVault public stEth25Dec2025LptVault;
    ILiquidityGaugeStrat public stEth25Dec2025LptGauge;
    uint256 forkId;

    address public ms = 0xF930EBBd05eF8b25B1797b9b2109DDC9B0d43063;

    function setUp() public virtual {
        forkId = vm.createFork(vm.rpcUrl("mainnet"), 17564158);
        vm.selectFork(forkId);

        // deploy pendle strategy
        strategy = new PendleStrategy(
            address(this), 
            address(this), 
            address(this), 
            address(this), 
            AddressBook.SDT_DISTRIBUTOR_STRAT
        );
        // deploy factory
        factory = new PendleVaultFactory(address(strategy), AddressBook.SDT_DISTRIBUTOR_STRAT);

        strategy.setVaultGaugeFactory(address(factory));

        // set strategy as governance into the locker
        vm.prank(ms);
        LOCKER.setGovernance(address(strategy));

        // clone a vault
        vm.recordLogs();
        factory.cloneAndInit(stEth25Dec2025Lpt);
        Vm.Log[] memory entries = vm.getRecordedLogs();
        assertEq(entries.length, 9);
        (address vault,,) = abi.decode(entries[0].data, (address, address, address));
        (address gauge,,) = abi.decode(entries[2].data, (address, address, address));
        stEth25Dec2025LptVault = PendleVault(vault);
        stEth25Dec2025LptGauge = ILiquidityGaugeStrat(gauge);

        deal(stEth25Dec2025Lpt, address(this), 1e18);
    }

    function testVaultCreation() public {}

    function testDepositAndWithdraw() public {
        uint256 amountToDeposit = 1e18;
        uint256 lockerBalanceBefore = IERC20(stEth25Dec2025Lpt).balanceOf(address(LOCKER));
        IERC20(stEth25Dec2025Lpt).approve(address(stEth25Dec2025LptVault), amountToDeposit);
        stEth25Dec2025LptVault.deposit(address(this), amountToDeposit);
        uint256 lockerBalanceAfter = IERC20(stEth25Dec2025Lpt).balanceOf(address(LOCKER));
        assertEq(amountToDeposit, lockerBalanceAfter - lockerBalanceBefore);
        stEth25Dec2025LptVault.withdraw(amountToDeposit);
        assertEq(lockerBalanceBefore, IERC20(stEth25Dec2025Lpt).balanceOf(address(LOCKER)));
    }

    function testClaimReward() public {
        uint256 amountToDeposit = 1e18;
        uint256 lockerBalanceBefore = IERC20(stEth25Dec2025Lpt).balanceOf(address(LOCKER));
        IERC20(stEth25Dec2025Lpt).approve(address(stEth25Dec2025LptVault), amountToDeposit);
        stEth25Dec2025LptVault.deposit(address(this), amountToDeposit);
        vm.roll(block.number + 4);
        deal(address(PENDLE), address(this), 10_000e18);
        IERC20(PENDLE).transfer(stEth25Dec2025Lpt, 1_000e18);
        uint256 gaugeBalanceBefore = IERC20(PENDLE).balanceOf(address(stEth25Dec2025LptGauge));
        strategy.claim(stEth25Dec2025Lpt);
        uint gaugeBalanceAfter = IERC20(PENDLE).balanceOf(address(stEth25Dec2025LptGauge));
        assertEq(gaugeBalanceBefore, 0);
        assertGt(gaugeBalanceAfter, 0);
    }

    function testClaim() public {
        address lptHolder = 0x63f6D9E7d3953106bCaf98832BD9C88A54AfCc9D;
        uint256 pendleBefore = IERC20(PENDLE).balanceOf(lptHolder);

        vm.startPrank(lptHolder);
        IERC20(stEth25Dec2025Lpt).transfer(address(LOCKER), IERC20(stEth25Dec2025Lpt).balanceOf(lptHolder));
        vm.stopPrank();

        uint256 pendleAfter = IERC20(PENDLE).balanceOf(lptHolder);

        ILpt(stEth25Dec2025Lpt).redeemRewards(lptHolder);
        uint256 pendleAfterReward = IERC20(PENDLE).balanceOf(lptHolder);

        assertEq(pendleBefore, pendleAfter);
        assertGt(pendleAfterReward, pendleAfter);
    }

    function testSetGovernance() public {
        (bool success,) = strategy.execute(
            address(LOCKER), 0, abi.encodeWithSignature("setGovernance(address)", ms)
        );
        require(success);
        address gov = LOCKER.governance();
        assertEq(gov, ms);
        vm.prank(ms);
        LOCKER.setGovernance(address(strategy));
    }
}
