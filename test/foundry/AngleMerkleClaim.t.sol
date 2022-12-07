// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "forge-std/Vm.sol";

import { AngleVoter } from "../../contracts/dao/voters/AngleVoter.sol";
import { AngleVoterV2 } from "../../contracts/dao/voters/AngleVoterV2.sol";
import { AngleStrategy } from "../../contracts/strategies/angle/AngleStrategy.sol";
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

	uint256 public constant BASE_FEE = 10000;
	uint256 public constant MS_FEE = 200;
	uint256 public constant ACC_FEE = 800;
	uint256 public constant VESDT_PROXY_FEE = 500;
	
	function setUp() public {
		uint256 forkId = vm.createFork(vm.rpcUrl("mainnet"), 15514425);
		vm.selectFork(forkId);

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
		uint256 totalAmount = 768323052279494300000000;
		// merkle tree proof (fetched from Angle UI)
		bytes32[][] memory proofs = new bytes32[][](1);
		proofs[0] = new bytes32[](6);
		proofs[0][0] = bytes32(0x2a09844018b8c01a95bb547cc67e73efc85d77555ce7e8fba882e30bbf0e8fee);
		proofs[0][1] = bytes32(0x6d5671085e73ea1b6b227891c0217ce9d2706c9b3971495d9b6ee297df24838b);
		proofs[0][2] = bytes32(0xcaf7c76bfcf0cd723ebe3f04ba3aee76d6a6658ea38c8134582fbbee1e3d02dc);
		proofs[0][3] = bytes32(0x1af3e78e4127ec2ea37cfdaf0a79a9bff9019cce7fd53e5834d759041a582c0b);
		proofs[0][4] = bytes32(0xcea8f208561df64186a30350124b4d57a974662c7cc7c096111c9672074cec17);
		proofs[0][5] = bytes32(0x968a20655b3ed42dd5c0b9a2f46c7a097f639ac2b3a19074a1e5129397f9eb8e);

		// amount to notify as reward for each LGV$
		uint256[] memory amountsToNotify = new uint256[](2);
		amountsToNotify[0] = 587199560000000000000000; // AgEurEth reward
		amountsToNotify[1] = 181123492279494300000000; // AgEurUsdc reward

		// LGV4 addresses
		address[] memory gauges = new address[](2);
		gauges[0] = address(guniAgEurEthLG);
		gauges[1] = address(guniAgEurUsdcLG);

		uint256[] memory feeAmounts = new uint256[](3);

		uint256 msFeeAgEurEth = (amountsToNotify[0] * MS_FEE / BASE_FEE);
		uint256 accFeeAgEurEth = (amountsToNotify[0] * ACC_FEE / BASE_FEE);
		uint256 veSdtProxyFeeAgEurEth = (amountsToNotify[0] * VESDT_PROXY_FEE / BASE_FEE);
		uint256 msFeeAgEurUsdc = (amountsToNotify[1] * MS_FEE / BASE_FEE);
		uint256 accFeeAgEurUsdc = (amountsToNotify[1] * ACC_FEE / BASE_FEE);
		uint256 veSdtProxyFeeAgEurUsdc = (amountsToNotify[1] * VESDT_PROXY_FEE / BASE_FEE);

		feeAmounts[0] = msFeeAgEurEth + msFeeAgEurUsdc;
		feeAmounts[1] = accFeeAgEurEth + accFeeAgEurUsdc;
		feeAmounts[2] = veSdtProxyFeeAgEurEth + veSdtProxyFeeAgEurUsdc;

		emit log_uint(feeAmounts[0]); // ms
		emit log_uint(feeAmounts[1]); // accumulator
		emit log_uint(feeAmounts[2]); // veSDTFeeProxy
		
		amountsToNotify[0] -= msFeeAgEurEth + accFeeAgEurEth + veSdtProxyFeeAgEurEth;
		amountsToNotify[1] -= msFeeAgEurUsdc + accFeeAgEurUsdc + veSdtProxyFeeAgEurUsdc;

		emit log_uint(amountsToNotify[0]); // AgEurEth reward - fees
		emit log_uint(amountsToNotify[1]); // AgEurUsdc reward - fees

		address[] memory feeRecipients = new address[](3);
		feeRecipients[0] = 0xF930EBBd05eF8b25B1797b9b2109DDC9B0d43063; // ms
		feeRecipients[1] = 0x8cc02F4f383A11b989708437DbA6BB0628d7eE78; // accumulator
		feeRecipients[2] = 0xE92Aa77c3D8c7347950B2a8d4B2A0AdBF0c31054; // veSDTFeeProxy

		// define Claim structure
		AngleVoterV2.Claim memory claim = AngleVoterV2.Claim(gauges, amountsToNotify, feeAmounts, feeRecipients);
		claimReward(totalAmount, proofs, claim, amountsToNotify);
	}

	function claimReward(
		uint256 _totalAmount, 
		bytes32[][] memory _proofs, 
		AngleVoterV2.Claim memory _claim, 
		uint256[] memory _amountsToNotify
	) internal {
		// LGV4 balance
		uint256 balanceAngleBeforeAgEurEthLG =  IERC20(ANGLE).balanceOf(address(guniAgEurEthLG));
		uint256 balanceSdtBeforeAgEurEthLG = IERC20(SDT).balanceOf(address(guniAgEurEthLG));
		uint256 balanceAngleBeforeAgEurUsdcLG =  IERC20(ANGLE).balanceOf(address(guniAgEurUsdcLG));
		uint256 balanceSdtBeforeAgEurUsdcLG = IERC20(SDT).balanceOf(address(guniAgEurEthLG));
		vm.prank(multisig);
		voterV2.claimRewardFromMerkle(_totalAmount, _proofs, _claim);
		uint256 balanceAngleAfterAgEurEthLG =  IERC20(ANGLE).balanceOf(address(guniAgEurEthLG));
		uint256 balanceSdtAfterAgEurEthLG = IERC20(SDT).balanceOf(address(guniAgEurEthLG));
		uint256 balanceAngleAfterAgEurUsdcLG =  IERC20(ANGLE).balanceOf(address(guniAgEurUsdcLG));
		uint256 balanceSdtAfterAgEurUsdcLG = IERC20(SDT).balanceOf(address(guniAgEurEthLG));
		require(balanceAngleAfterAgEurEthLG - balanceAngleBeforeAgEurEthLG == _amountsToNotify[0], "wrong amount received");
		require(balanceAngleAfterAgEurUsdcLG - balanceAngleBeforeAgEurUsdcLG == _amountsToNotify[1], "wrong amount received");
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