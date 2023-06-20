// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "forge-std/Vm.sol";

import {AngleVoterV4} from "contracts/dao/voters/AngleVoterV4.sol";
import {AngleVoterV3} from "contracts/dao/voters/AngleVoterV3.sol";
import {AngleStrategy} from "contracts/strategies/angle/AngleStrategy.sol";
import {AddressBook} from "addressBook/AddressBook.sol";
import "openzeppelin-contracts/token/ERC20/IERC20.sol";

interface ILGV4 {
    function set_reward_distributor(address, address) external;
}

contract AngleVoterTest is Test {

    AngleVoterV4 public voter;
    AngleVoterV3 public oldVoter = AngleVoterV3(0xDde0F1755DED401a012617f706c66a59c6917EFD);
    AngleStrategy public strategy = AngleStrategy(0x22635427C72e8b0028FeAE1B5e1957508d9D7CAF);
    address public guniAgEurEthLG = 0x125FC0b592Db2a21fea8a5f6B2F86b1D6417Bf66;
    address public guniAgEurUsdcLG = 0x61542F1086ddADa25661ca0A7f2f801d76499136;
    address public multisig = 0xF930EBBd05eF8b25B1797b9b2109DDC9B0d43063;
    address public locker = 0xD13F8C25CceD32cdfA79EB5eD654Ce3e484dCAF5;
    address public merkleDistributor = 0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae;

    uint256 public constant BASE_FEE = 10000;
    uint256 public constant MS_FEE = 200;
    uint256 public constant ACC_FEE = 800;
    uint256 public constant VESDT_PROXY_FEE = 500;

    function setUp() public {
        uint256 forkId = vm.createFork(vm.rpcUrl("mainnet"), 17479300);
        vm.selectFork(forkId);
        voter = new AngleVoterV4();

        // change the angle strategy governance 
        bytes memory setGovernanceData = abi.encodeWithSignature("setGovernance(address)", address(voter));
        vm.startPrank(multisig);
        oldVoter.execute(address(strategy), 0, setGovernanceData);
        // toggle only operator can claim
        bytes memory toggleCanClaimData = abi.encodeWithSignature("toggleOnlyOperatorCanClaim(address)", locker);
        bytes memory executeLockerData = abi.encodeWithSignature("execute(address,uint256,bytes)", merkleDistributor, 0, toggleCanClaimData);
        bytes memory executeStrategyData = abi.encodeWithSignature("execute(address,uint256,bytes)", locker, 0, executeLockerData);
        (bool success,) = voter.execute(address(strategy), 0, executeStrategyData);
        assertEq(success, true); 
        // whitelist the operator
        bytes memory toggleOperatorData = abi.encodeWithSignature("toggleOperator(address,address)", locker, address(voter));
        bytes memory executeLockerDataOperator = abi.encodeWithSignature("execute(address,uint256,bytes)", merkleDistributor, 0, toggleOperatorData);
        bytes memory executeStrategyDataOperator = abi.encodeWithSignature("execute(address,uint256,bytes)", locker, 0, executeLockerDataOperator);
        (success,) = voter.execute(address(strategy), 0, executeStrategyDataOperator);
        assertEq(success, true); 
        vm.stopPrank();
    }

    function testAgEurWethGuniClaim() external {
        uint256 totalAmount = 4277255169373178080000;
        // merkle tree proof (fetched from Angle UI)
        bytes32[][] memory proofs = new bytes32[][](1);
        proofs[0] = new bytes32[](4);
        proofs[0][0] = bytes32(0x8546f96e1e576e1ec0eb3c254c53fa7c44920c8b39c298eabaf0797c65cad52f);
        proofs[0][1] = bytes32(0x1bc6188bcadc710f5fdde8f5977953de99cf9b5c74689000e4d71d1e7676c703);
        proofs[0][2] = bytes32(0x0d9e5519eb28713f81aa7dd5c3a5f3bccece6bc4968bfc09db348a32e0d65541);
        proofs[0][3] = bytes32(0x1d9f838a8f3ab367179f4294e8c4f00dfa872d7b04f4db5a1262f6782dcfe74b);

        uint256[] memory amountsToNotify = new uint256[](1);
        amountsToNotify[0] = 4277255169373178080000; // AgEurEth reward

        // LGV4 addresses
        address[] memory gauges = new address[](1);
        gauges[0] = address(guniAgEurEthLG);

        uint256[] memory feeAmounts = new uint256[](3);

        feeAmounts[0] = (amountsToNotify[0] * MS_FEE / BASE_FEE);
        feeAmounts[1] = (amountsToNotify[0] * ACC_FEE / BASE_FEE);
        feeAmounts[2] = (amountsToNotify[0] * VESDT_PROXY_FEE / BASE_FEE);

        amountsToNotify[0] -= feeAmounts[0] + feeAmounts[1] + feeAmounts[2];

        address[] memory feeRecipients = new address[](3);
        feeRecipients[0] = 0xF930EBBd05eF8b25B1797b9b2109DDC9B0d43063; // ms
        feeRecipients[1] = 0x8cc02F4f383A11b989708437DbA6BB0628d7eE78; // accumulator
        feeRecipients[2] = 0xE92Aa77c3D8c7347950B2a8d4B2A0AdBF0c31054; // veSDTFeeProxy

        // define Claim structure
        AngleVoterV4.Claim memory claim = AngleVoterV4.Claim(gauges, amountsToNotify, feeAmounts, feeRecipients);
        vm.prank(multisig);
        voter.claimRewardFromMerkle(AddressBook.ANGLE, totalAmount, proofs, claim);
    }
}