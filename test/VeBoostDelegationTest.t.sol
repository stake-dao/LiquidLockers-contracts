// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";

import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {IBoostDelegationV2} from "contracts/interfaces/IBoostDelegationV2.sol";
import {IBoostDelegationProxy} from "contracts/interfaces/IBoostDelegationProxy.sol";

contract VeBoostDelegationTest is Test {
    IBoostDelegationV2 boostDelegationV2;
    IBoostDelegationProxy boostDelegationProxy;
    address constant ADMIN = 0xb36a0671B3D49587236d7833B01E79798175875f;
    address constant VESDT = address(0x0C30476f66034E11782938DF8e4384970B6c9e8a);
    address constant VE_BOOST_DELEGATION_PROXY = 0xD67bdBefF01Fc492f1864E61756E5FBB3f173506;
    address constant VE_SDT_WHALE = 0xb0e83C2D71A991017e0116d58c5765Abc57384af;
    uint256 public constant WEEK = 7 * 86400;

    function setUp() public {
        uint256 forkId = vm.createFork(vm.rpcUrl("mainnet"), 16133200);
        vm.selectFork(forkId);
        boostDelegationV2 = IBoostDelegationV2(
            deployCode("artifacts/contracts/staking/BoostDelegationV2.vy/BoostDelegationV2.json", abi.encode(VESDT))
        );
        boostDelegationProxy = IBoostDelegationProxy(VE_BOOST_DELEGATION_PROXY);
        vm.prank(ADMIN);
        boostDelegationProxy.set_delegation(address(boostDelegationV2));
    }

    function testDelegationSetup() public {
        // Check that the proxy is set to the V2 contract
        assertEq(address(boostDelegationProxy.delegation()), address(boostDelegationV2));

        // Check that the V1 contract is set to the VESDT contract
        assertEq(address(boostDelegationV2.VE()), VESDT);
    }

    function testIfDelegate() public {
        vm.prank(VE_SDT_WHALE);
        boostDelegationV2.approve(address(this), type(uint256).max);
        //delegate 100000 VESDT to the other address
        boostDelegationV2.checkpoint_user(VE_SDT_WHALE);
        uint256 endTime = ((block.timestamp + 60 * 60 * 24 * 30) / WEEK) * WEEK;
        boostDelegationV2.boost(address(this), 100000e18, endTime, VE_SDT_WHALE);
        uint256 delegated = boostDelegationV2.delegated_balance(VE_SDT_WHALE);
        assertApproxEqRel(delegated, 100000e18, 1e16);
    }
}
