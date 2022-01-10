// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./GaugeMultiRewards.sol";
import "./interfaces/IDepositor.sol";
import "./interfaces/IVeSDT.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "hardhat/console.sol";

// Cases to be covered:
// Claimed SDT & FXS goes directly to user
// Claimed & locked SDT & FXS goes to veSDT & PPS respectively
// Claimed other reward tokens goes to the user
// Claimed & locked other reward tokens are converted to FXS & goes to PPS
// Possibility: User should be able to sell other ERC20 to SDT & lock
// NOTE:
// We don't have the ability for the user wants to lock SDT & FXS and zap out sushi & avae in avae
// We don't have the ability to convert other reward token to SDT and deposit it to veSDT
contract ClaimContract {
	using SafeERC20 for IERC20;
	address constant SDT = 0x73968b9a57c6E53d41345FD57a6E6ae27d6CDB2F;
	address public governance;
	address public depositorProxy;

	mapping(address => address) public depositors;

	struct LockStatus {
		bool[] locked;
		address[] tokens;
	}

	event Recovered(address token, uint256 amount);
	event RewardsClaimed(address[] _gauges);
	event RewardClaimedAndLocked(address[] _gauges, LockStatus[] _locks, address[] _extraTokens);
	event RewardClaimedAndSent(address _user, address[] _gauges);

	constructor() public {
		governance = msg.sender;
	}

	modifier onlyGovernance() {
		require(msg.sender == governance, "!gov");
		_;
	}

	function setDepositor(address _token, address _depositor) public onlyGovernance {
		depositors[_token] = _depositor;
	}

	function setDepositorProxy(address _depositorProxy) public onlyGovernance {
		depositorProxy = _depositorProxy;
	}

	function setGovernance(address _governance) public onlyGovernance {
		governance = _governance;
	}

	/// @notice A function to claim rewards from all the gauges supplied
	/// @param _gauges Gauges from which rewards are to be claimed
	function claimRewards(address[] calldata _gauges) public {
		for (uint256 index = 0; index < _gauges.length; index++) {
			GaugeMultiRewards(_gauges[index]).getRewardFor(msg.sender);
		}
		emit RewardsClaimed(_gauges);
	}

	/// @notice A function that allows the user to claim and lock the token of choice
	/// @param _gauges Gauges from which rewards are to be claimed
	/// @param _locks Status of locks for each reward token for each gauge
	/// @param _extraTokens Tokens other than FXS & SDT being received as a reward
	function claimAndLock(
		address[] calldata _gauges,
		LockStatus[] calldata _locks,
		address[] calldata _extraTokens
	) public {
		require(_gauges.length == _locks.length, "gauges & locks count diff");

		// Claim not locked to the user & the locked to contract & user(SDT)
		for (uint256 index = 0; index < _gauges.length; index++) {
			GaugeMultiRewards(_gauges[index]).claimReward(msg.sender, _locks[index].locked);
		}

		// Lock the SDT to the veSDT if any
		uint256 balance = IERC20(SDT).balanceOf(address(this));
		if (balance > 0) {
			IERC20(SDT).approve(depositors[SDT], balance);
			IVeSDT(depositors[SDT]).deposit_for_sd(msg.sender, balance);
		}

		// If depositor is present, deposit it else send it to the user
		for (uint256 index = 0; index < _extraTokens.length; index++) {
			// Note: Improvement: Tracking individual balances for extra tokens before and after claim reward call & transfer only the difference amount to a user
			balance = IERC20(_extraTokens[index]).balanceOf(address(this));
			if (balance > 0) {
				address depositor = depositors[_extraTokens[index]];
				if (depositor != address(0)) {
					IERC20(_extraTokens[index]).approve(depositors[_extraTokens[index]], balance);
					IDepositor(depositors[_extraTokens[index]]).depositFor(msg.sender, balance);
				} else {
					IERC20(_extraTokens[index]).transfer(msg.sender, balance);
				}
			}
		}

		emit RewardClaimedAndLocked(_gauges, _locks, _extraTokens);
	}

	/// @notice A function that could be used to claim rewards and deposit them to a depositor proxy
	/// @dev This function could be called only by the depositor proxy
	/// @param _user User whose rewards are to be claimed
	/// @param _gauges Gauges from which rewards are to be claimed
	function claimAndSend(address _user, address[] calldata _gauges) public {
		require(msg.sender == depositorProxy, "!depositorProxy");
		for (uint256 index = 0; index < _gauges.length; index++) {
			GaugeMultiRewards(_gauges[index]).claimReward(_user, depositorProxy);
		}
		emit RewardClaimedAndSent(_user, _gauges);
	}

	function recoverERC20(
		address tokenAddress,
		uint256 tokenAmount,
		address destination
	) external onlyGovernance {
		IERC20(tokenAddress).safeTransfer(destination, tokenAmount);
		emit Recovered(tokenAddress, tokenAmount);
	}
}
