// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "forge-std/Vm.sol";

import { AngleVoter } from "../../contracts/dao/AngleVoter.sol";
import { AngleVoterV2 } from "../../contracts/dao/AngleVoterV2.sol";
import { AngleStrategy } from "../../contracts/strategy/AngleStrategy.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ILGV4 {
	struct Reward {
    	address token;
    	address distributor;
    	uint256 period_finish;
    	uint256 rate;
    	uint256 last_update;
    	uint256 integral;
	}
	function set_reward_distributor(address, address) external;
	function reward_data(address) external returns(Reward memory);
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
		// change voterV2 governance
		voterV2.setGovernance(multisig);
		
		address oldGov = strategy.governance();
		require(oldGov == address(voterV1), "wrong gov");

		// change strategy's governance with the new AngleVoterV2
		bytes memory setGovernanceData = abi.encodeWithSignature("setGovernance(address)", address(voterV2));
		// impersonate ms
		vm.startPrank(multisig);
		voterV1.execute(address(strategy), 0, setGovernanceData);

		address newGov = strategy.governance();
		require(newGov == address(voterV2), "wrong gov"); 

		// change notifier for guni LGV4s
		guniAgEurEthLG.set_reward_distributor(ANGLE, ANGLE_LOCKER);
		guniAgEurUsdcLG.set_reward_distributor(ANGLE, ANGLE_LOCKER);
		ILGV4.Reward memory rewardDataAgEurEth = ILGV4(address(guniAgEurEthLG)).reward_data(ANGLE);
		require(rewardDataAgEurEth.distributor == ANGLE_LOCKER, "wrong distributor");
		ILGV4.Reward memory rewardDataAgEurUsdc = ILGV4(address(guniAgEurUsdcLG)).reward_data(ANGLE);
		require(rewardDataAgEurUsdc.distributor == ANGLE_LOCKER, "wrong distributor");
		vm.stopPrank();

		// infinite approve for locker
		vm.startPrank(ANGLE_LOCKER);
		IERC20(ANGLE).approve(address(guniAgEurEthLG), type(uint256).max);
		IERC20(ANGLE).approve(address(guniAgEurUsdcLG), type(uint256).max);
		vm.stopPrank();
	}

	function testClaim() public {
		// total ANGLE amount to claim for all guni gauges
		uint256 totalAmount = 240008653919396200000000;
		// merkle tree proof (fetched from Angle UI)
		bytes32[][] memory proofs = new bytes32[][](1);
		proofs[0] = new bytes32[](6);
		proofs[0][0] = bytes32(0xdcbf8b200c282884277de54206386fe8fbab0e1dff4f2b94e19e9cf54d569338);
		proofs[0][1] = bytes32(0x433021e24ea4538b8f18c86c8173888ecfc862cade5f38418d1c4fb709872bde);
		proofs[0][2] = bytes32(0x3c021ea991224400587829219913c19e4f9c59ab48ae7b7e0a9fd4a6f389a09c);
		proofs[0][3] = bytes32(0xe56d80e6a36d3c41256685708b7c64e41c110b77f23c4daa67b9be10e51a117c);
		proofs[0][4] = bytes32(0x5228a1a3fcd990de927ab3776d38c8bc6a10ace9d78dbe23cbdd1d0aef691012);
		proofs[0][5] = bytes32(0xef7a39949475c66796971184706b4d67f754773052c751d43bce7356511fb309);

		// amount to notify as reward for each LGV$
		uint256[] memory amountsToNotify = new uint256[](2);
		amountsToNotify[0] = 153388051999170600000000; // AgEurEth reward
		amountsToNotify[1] = 86620601920225600000000; // AgEurUsdc reward

		// LGV4 addresses
		address[] memory gauges = new address[](2);
		gauges[0] = address(guniAgEurEthLG);
		gauges[1] = address(guniAgEurUsdcLG);
		
		// LGV4 balance
		uint256 balanceBeforeAgEurEthLG =  IERC20(ANGLE).balanceOf(address(guniAgEurEthLG));
		uint256 balanceBeforeAgEurUsdcLG =  IERC20(ANGLE).balanceOf(address(guniAgEurUsdcLG));
		vm.prank(multisig);
		voterV2.claimRewardFromMerkle(totalAmount, proofs, amountsToNotify, gauges);
		uint256 balanceAfterAgEurEthLG =  IERC20(ANGLE).balanceOf(address(guniAgEurEthLG));
		uint256 balanceAfterAgEurUsdcLG =  IERC20(ANGLE).balanceOf(address(guniAgEurUsdcLG));
		require(balanceAfterAgEurEthLG - balanceBeforeAgEurEthLG == amountsToNotify[0], "wrong amount received");
		require(balanceAfterAgEurUsdcLG - balanceBeforeAgEurUsdcLG == amountsToNotify[1], "wrong amount received"); 
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