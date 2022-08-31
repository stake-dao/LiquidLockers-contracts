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
	address public constant SDT = 0x73968b9a57c6E53d41345FD57a6E6ae27d6CDB2F;
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
		uint256 totalAmount = 448265229291772000000000;
		// merkle tree proof (fetched from Angle UI)
		bytes32[][] memory proofs = new bytes32[][](1);
		proofs[0] = new bytes32[](6);
		proofs[0][0] = bytes32(0xedc62f28e3fcf032331b4479d1d7d6f27f93988e715c412841ee197565588dd7);
		proofs[0][1] = bytes32(0xfa64d6467608f1b2e19cb71a09ec7dd02d3998abfdad107fb4b6de4104fa2951);
		proofs[0][2] = bytes32(0x6db857b72bc4e3fd57fab1a4ab08d2c8817a96cac4b44346941952860379ca24);
		proofs[0][3] = bytes32(0x97a04a4822d1e3337b7b2891b78a0f9ffbda26bc85b665ae3a34d870b727eec9);
		proofs[0][4] = bytes32(0x42549ba36c0e7f9bcc4284ddcc7d257e81a09b0f08b02ec4efe18b3d351a9a00);
		proofs[0][5] = bytes32(0xf514c28734b2bcedc16ab63718842c0e9b19843f6c7fc2189cccd44c8f05a70e);

		// amount to notify as reward for each LGV$
		uint256[] memory amountsToNotify = new uint256[](2);
		amountsToNotify[0] = 297664340000000000000000; // AgEurEth reward
		amountsToNotify[1] = 150600889291772000000000; // AgEurUsdc reward

		// LGV4 addresses
		address[] memory gauges = new address[](2);
		gauges[0] = address(guniAgEurEthLG);
		gauges[1] = address(guniAgEurUsdcLG);
		
		// LGV4 balance
		uint256 balanceAngleBeforeAgEurEthLG =  IERC20(ANGLE).balanceOf(address(guniAgEurEthLG));
		uint256 balanceSdtBeforeAgEurEthLG = IERC20(SDT).balanceOf(address(guniAgEurEthLG));
		uint256 balanceAngleBeforeAgEurUsdcLG =  IERC20(ANGLE).balanceOf(address(guniAgEurUsdcLG));
		uint256 balanceSdtBeforeAgEurUsdcLG = IERC20(SDT).balanceOf(address(guniAgEurEthLG));
		vm.prank(multisig);
		voterV2.claimRewardFromMerkle(totalAmount, proofs, amountsToNotify, gauges);
		uint256 balanceAngleAfterAgEurEthLG =  IERC20(ANGLE).balanceOf(address(guniAgEurEthLG));
		uint256 balanceSdtAfterAgEurEthLG = IERC20(SDT).balanceOf(address(guniAgEurEthLG));
		uint256 balanceAngleAfterAgEurUsdcLG =  IERC20(ANGLE).balanceOf(address(guniAgEurUsdcLG));
		uint256 balanceSdtAfterAgEurUsdcLG = IERC20(SDT).balanceOf(address(guniAgEurEthLG));
		require(balanceAngleAfterAgEurEthLG - balanceAngleBeforeAgEurEthLG == amountsToNotify[0], "wrong amount received");
		require(balanceAngleAfterAgEurUsdcLG - balanceAngleBeforeAgEurUsdcLG == amountsToNotify[1], "wrong amount received");
		require(balanceSdtAfterAgEurEthLG - balanceSdtBeforeAgEurEthLG > 0, "wrong amount received");
		require(balanceSdtAfterAgEurUsdcLG - balanceSdtBeforeAgEurUsdcLG > 0, "wrong amount received"); 
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