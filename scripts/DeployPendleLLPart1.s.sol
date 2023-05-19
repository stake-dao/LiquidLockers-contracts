// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "forge-std/Script.sol";

import {AddressBook} from "addressBook/AddressBook.sol";
import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {sdToken} from "contracts/tokens/sdToken.sol";
import {PendleDepositor} from "contracts/depositors/PendleDepositor.sol";
import {ILiquidityGauge} from "contracts/interfaces/ILiquidityGauge.sol";
import {IRewardPool} from "contracts/interfaces/IRewardPool.sol";
import {IVePendle} from "contracts/interfaces/IVePendle.sol";
import {TransparentUpgradeableProxy} from "contracts/external/TransparentUpgradeableProxy.sol";
import {PendleAccumulator} from "contracts/accumulators/PendleAccumulator.sol";
import {PendleLocker} from "contracts/lockers/PendleLocker.sol";

contract DeployPendleLLPart1 is Script, Test {
    sdToken public sdPENDLE;
    PendleAccumulator public pendleAccumulator;
    PendleDepositor public depositor;
    PendleLocker public pendleLocker;

    ILiquidityGauge public liquidityGauge;
    address public lgv4Impl = 0x93c951D3281Cc79e9FE1B1C87e50693D202F4C17; // sdAngle impl
    address public deployer = 0x000755Fbe4A24d7478bfcFC1E561AfCE82d1ff62;
    address public ms = 0xF930EBBd05eF8b25B1797b9b2109DDC9B0d43063;

    // Pendle contracts deployed
    IERC20 public PENDLE = IERC20(0x808507121B80c02388fAd14726482e061B8da827);
    IVePendle public vePENDLE = IVePendle(0x4f30A9D41B80ecC5B94306AB4364951AE3170210);
    IRewardPool public rewardPool = IRewardPool(0xd7b34a6fDCb2A7ceD2115FF7f5fdD72aa6aA4dE2);

    function run() public {
        vm.startBroadcast();
        // deploy sdPENDLE
        sdPENDLE = new sdToken("Stake DAO PENDLE", "sdPENDLE");

        // Deploy LiquidityGauge
        liquidityGauge = ILiquidityGauge(
            address(
                new TransparentUpgradeableProxy(
                lgv4Impl,
                AddressBook.PROXY_ADMIN,
                abi.encodeWithSignature(
                "initialize(address,address,address,address,address,address)",
                address(sdPENDLE),
                deployer,
                AddressBook.SDT,
                AddressBook.VE_SDT,
                AddressBook.VE_SDT_BOOST_PROXY,
                AddressBook.SDT_DISTRIBUTOR
                )
                )
            )
        );

        // Deploy and Intialize the PendleLocker contract
        bytes32 lockerSalt = bytes32(uint256(uint160(address(PENDLE))) << 96); // PENDLE address
        pendleLocker =
        new PendleLocker{salt: lockerSalt}(deployer, ms);

        // Deploy Depositor Contract
        depositor = new PendleDepositor(address(PENDLE), address(pendleLocker), address(sdPENDLE), 104 * AddressBook.WEEK);

        // Setters
        // Depositor
        depositor.setGauge(address(liquidityGauge));

        // Locker
        pendleLocker.setPendleDepositor(address(depositor));

        // Custom part to create the lock and mint sdPENDLE manually
        // 1 PENDLE
        uint128 amountToLock = 1e18;
        IERC20(PENDLE).transfer(address(pendleLocker), amountToLock);
        uint128 lockTime = uint128(
            ((block.timestamp + 104 * AddressBook.WEEK) / AddressBook.WEEK) *
                AddressBook.WEEK
        );
        pendleLocker.createLock(amountToLock, lockTime);

        // mint 1 sdPENDLE
        sdPENDLE.mint(AddressBook.SDTNEWDEPLOYER, amountToLock);
        // sdPENDLE
        sdPENDLE.setOperator(address(depositor));

        vm.stopBroadcast();
    }
}
