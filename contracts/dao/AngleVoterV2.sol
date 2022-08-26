// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "../strategy/AngleStrategy.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMerkle {
	function claim(address[] memory, address[] memory, uint256[] memory, bytes32[][] memory) external;
}

contract AngleVoterV2 {
	address public angleStrategy = 0x22635427C72e8b0028FeAE1B5e1957508d9D7CAF;
	address public constant ANGLE_LOCKER = 0xD13F8C25CceD32cdfA79EB5eD654Ce3e484dCAF5;
	address public constant ANGLE_GC = 0x9aD7e7b0877582E14c17702EecF49018DD6f2367;
    address public constant ANGLE = 0x31429d1856aD1377A8A0079410B297e1a9e214c2;
    IMerkle public merkleReward = IMerkle(0x5a93D504604fB57E15b0d73733DDc86301Dde2f1);
	address public governance;

	constructor() {
		governance = msg.sender;
	}

	/// @notice claim ANGLE rewards for guni gauges
	/// @param _totalAmount total amount to claim
	/// @param _proofs merkle tree proof
	/// @param _amountsToNotify amounts to notify for each LGV4
	/// @param _gauges gauges to notify the related amount
    function claimRewardFromMerkle(
		uint256 _totalAmount, 
		bytes32[][] memory _proofs, 
		uint256[] memory _amountsToNotify, 
		address[] memory _gauges
	) external {
        require(msg.sender == governance, "!governance");
		require(_amountsToNotify.length == _gauges.length, "different length");

		// define merkle claims parameters
        address[] memory users = new address[](1);
        users[0] = ANGLE_LOCKER;
        address[] memory tokens = new address[](1);
        tokens[0] = ANGLE;
		uint256[] memory amounts = new uint256[](1);
		amounts[0] = _totalAmount;

		// claim merkle reward
		uint256 angleBeforeClaim = IERC20(ANGLE).balanceOf(ANGLE_LOCKER);
		// the angle locker will receive ANGLE rewards
		merkleReward.claim(users, tokens, amounts, _proofs);

		// notify amounts to the related gauges
		uint256 gaugeslength = _gauges.length;
		for (uint256 i; i < gaugeslength; ) {
			bytes memory notifyData = abi.encodeWithSignature("deposit_reward_token(address,uint256)", ANGLE, _amountsToNotify[i]);
			(bool success, ) = AngleStrategy(angleStrategy).execute(
				ANGLE_LOCKER,
				0,
				abi.encodeWithSignature("execute(address,uint256,bytes)", _gauges[i], 0, notifyData)
			);
			require(success, "Notify failed!");
			unchecked {
				++i;
			}
		}
		//Check if all ANGLE rewards have been distributed
		require(IERC20(ANGLE).balanceOf(ANGLE_LOCKER) == angleBeforeClaim, "wrong amount left");
    }

    /// @notice vote for angle gauges
	/// @param _gauges gauges to vote for
	/// @param _weights vote weight for each gauge
	function voteGauges(address[] calldata _gauges, uint256[] calldata _weights) external {
		require(msg.sender == governance, "!governance");
		require(_gauges.length == _weights.length, "!length");
		uint256 length = _gauges.length;
		for (uint256 i; i < length; i++) {
			bytes memory voteData = abi.encodeWithSignature(
				"vote_for_gauge_weights(address,uint256)",
				_gauges[i],
				_weights[i]
			);
			(bool success, ) = AngleStrategy(angleStrategy).execute(
				ANGLE_LOCKER,
				0,
				abi.encodeWithSignature("execute(address,uint256,bytes)", ANGLE_GC, 0, voteData)
			);
			require(success, "Voting failed!");
		}
	}

	/// @notice execute a function
	/// @param _to Address to sent the value to
	/// @param _value Value to be sent
	/// @param _data Call function data
	function execute(
		address _to,
		uint256 _value,
		bytes calldata _data
	) external returns (bool, bytes memory) {
		require(msg.sender == governance, "!governance");
		(bool success, bytes memory result) = _to.call{ value: _value }(_data);
		return (success, result);
	}

	/* ========== SETTERS ========== */
    /// @notice set new governance
	/// @param _newGovernance governance address
	function setGovernance(address _newGovernance) external {
		require(msg.sender == governance, "!governance");
		governance = _newGovernance;
	}

    /// @notice change strategy
	/// @param _newStrategy strategy address
	function changeStrategy(address _newStrategy) external {
		require(msg.sender == governance, "!governance");
		angleStrategy = _newStrategy;
	}
}
