// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

// Base Tests
import "./baseTest/Base.t.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "contracts/accumulators/VeSDTFeeBalancerProxy.sol";

contract BalancerFeeProxyTest is BaseTest {
    address public constant LOCAL_DEPLOYER = address(0xDE);
    address public constant ALICE = address(0xAA);

    uint256 public constant AMOUNT = 100e18;

    VeSDTFeeBalancerProxy public veSDTFeeProxy;

    function setUp() public {
        uint256 forkId = vm.createFork(vm.rpcUrl("mainnet"));
        vm.selectFork(forkId);
        vm.prank(LOCAL_DEPLOYER);
        veSDTFeeProxy = new VeSDTFeeBalancerProxy();
    }

    function testZapp() public {
        deal(address(Constants.BAL), address(veSDTFeeProxy), AMOUNT);

        uint256 claimerFee = veSDTFeeProxy.claimerFee();
        uint256 baseFee = veSDTFeeProxy.BASE_FEE();
        uint256 balanceClaimerBefore = IERC20(Constants.BAL).balanceOf(ALICE);
        uint256 balanceFeeDistBefore = IERC20(Constants.SDFRAX3CRV).balanceOf(Constants.FEE_D_SD);

        vm.prank(ALICE);
        veSDTFeeProxy.sendRewards();

        uint256 balanceClaimerAfter = IERC20(Constants.BAL).balanceOf(ALICE);
        uint256 balanceFeeDistAfter = IERC20(Constants.SDFRAX3CRV).balanceOf(Constants.FEE_D_SD);

        assertEq(balanceClaimerAfter - balanceClaimerBefore, AMOUNT * claimerFee / baseFee, "ERROR_01");
        assertGt(balanceFeeDistAfter - balanceFeeDistBefore, 350e18, "ERROR_02");
        assertEq(IERC20(Constants.BAL).balanceOf(address(veSDTFeeProxy)), 0, "ERROR_03");
    }
}
