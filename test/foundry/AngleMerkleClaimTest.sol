// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "forge-std/Vm.sol";

import { AngleVoter } from "../../contracts/dao/AngleVoter.sol";
import { AngleVoterV2 } from "../../contracts/dao/AngleVoterV2.sol";
import { AngleStrategy } from "../../contracts/strategy/AngleStrategy.sol";

interface ILGV4 {
	function set_reward_distributor(address, address) external;
}

contract AngleMerkleClaimTest is Test {

	address public multisig = 0xF930EBBd05eF8b25B1797b9b2109DDC9B0d43063;
	address public constant ANGLE = 0x31429d1856aD1377A8A0079410B297e1a9e214c2;
	address public constant ANGLE_LOCKER = 0xD13F8C25CceD32cdfA79EB5eD654Ce3e484dCAF5;

	ILGV4 public guniAgEurEthLG = ILGV4(0x125FC0b592Db2a21fea8a5f6B2F86b1D6417Bf66);
	ILGV4 public guniAgEurUsdcLG = ILGV4(0x61542F1086ddADa25661ca0A7f2f801d76499136);
	AngleStrategy public strategy = AngleStrategy(0x22635427C72e8b0028FeAE1B5e1957508d9D7CAF);
	AngleVoter public voterV1 = AngleVoter(0x103A24aDF3c60E29eCF4D05ee742cAdc7BA3fAb8);
	AngleVoterV2 internal voterV2;
	
	address public alice = makeAddr("alice");
	address public bob = makeAddr("bob");
	
	function setUp() public {
		// deploy new angle voter
		voterV2 = new AngleVoterV2();
		
		address oldGov = strategy.governance();
		require(oldGov == address(voterV1), "wrong gov");

		// change strategy's governance with the new AngleVoterV2
		bytes memory setGovernanceData = abi.encodeWithSignature("setGovernance(address)", address(voterV2));
		// impersonate ms
		vm.prank(multisig);
		voterV1.execute(address(strategy), 0, setGovernanceData);

		address newGov = strategy.governance();
		require(newGov == address(voterV2), "wrong gov"); 

		// change notifier for guni LGV4s
		vm.prank(multisig);
		guniAgEurEthLG.set_reward_distributor(ANGLE, ANGLE_LOCKER);
		vm.prank(multisig);
		guniAgEurUsdcLG.set_reward_distributor(ANGLE, ANGLE_LOCKER);

		// change voterV2 governance
		voterV2.setGovernance(multisig);
	}

	function testClaim() public {
		// // total ANGLE amount to claim for all guni gauges
		// uint256 totalAmount = 153388051999170600000000;
		// // merkle tree proof (fetched from Angle UI)
		// bytes32[] memory proofs = new bytes32[](5);
		// proofs[0] = 0x6f6fca37df78dce7d2e5b49769ea7c8a6c367b58c84fd96ecc67087a2b840152;
		// proofs[1] = 0x6f6fca37df78dce7d2e5b49769ea7c8a6c367b58c84fd96ecc67087a2b840152;
		// proofs[2] =	0x6f6fca37df78dce7d2e5b49769ea7c8a6c367b58c84fd96ecc67087a2b840152;
		// proofs[3] = 0x6f6fca37df78dce7d2e5b49769ea7c8a6c367b58c84fd96ecc67087a2b840152;
		// proofs[4] = 0x6f6fca37df78dce7d2e5b49769ea7c8a6c367b58c84fd96ecc67087a2b840152;

		// // amount to notify as reward for each LGV$
		// uint256[] memory amountsToNotify = new uint256[](2);
		// amountsToNotify[0] = 0;
		// amountsToNotify[1] = 0;

		// // LGV4 addresses
		// address[] memory gauges = new address[](2);
		// gauges[0] = address(guniAgEurEthLG);
		// gauges[1] = address(guniAgEurUsdcLG);
		// voterv2.claimRewardFromMerkle(totalAmount, proofs, amountsToNotify, gauges);
	}

	function testMigration() public {
		// change voterV2 governance
		vm.prank(multisig);
		voterV2.setGovernance(alice);

		// change strategy's governance with the new AngleVoterV2
		bytes memory setGovernanceData = abi.encodeWithSignature("setGovernance(address)", bob);
		vm.prank(alice);
		voterV2.execute(address(strategy), 0, setGovernanceData);

		address governance = strategy.governance();
		require(governance == bob, "wrong gov!");
	}
}