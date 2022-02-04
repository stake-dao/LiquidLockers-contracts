// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "../interfaces/ILiquidityGauge.sol";
import "../interfaces/IDepositor.sol";
import "../interfaces/IVeSDT.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";

// Claim rewards contract:
// 1) Users can claim rewards from pps gauge and directly receive all tokens collected.
// 2) Users can choose to direcly lock tokens supported by lockers (FXS, ANGLE) and receive the other not supported.
contract ClaimRewards {
	using SafeERC20 for IERC20;
	address constant SDT = 0x73968b9a57c6E53d41345FD57a6E6ae27d6CDB2F;
	address public governance;

	mapping(address => address) public depositors;

	struct LockStatus {
		bool[] locked;
		address[] tokens;
	}

	event Recovered(address token, uint256 amount);
	event RewardsClaimed(address[] _gauges);
	event RewardClaimedAndLocked(address[] _gauges, LockStatus[] _locks, address[] _extraTokens);
	event RewardClaimedAndSent(address _user, address[] _gauges);

	constructor() 	{
		governance = msg.sender;
	}

	modifier onlyGovernance() {
		require(msg.sender == governance, "!gov");
		_;
	}

	/// @notice A function to claim rewards from all the gauges supplied
	/// @param _gauges Gauges from which rewards are to be claimed
	function claimRewards(address[] calldata _gauges) public {
		for (uint256 index = 0; index < _gauges.length; index++) {
			ILiquidityGauge(_gauges[index]).claim_rewards_for(msg.sender, msg.sender);
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

		uint256 balance = IERC20(SDT).balanceOf(msg.sender);

		// Claim not locked to the user & the locked to contract & user(SDT)
		for (uint256 index = 0; index < _gauges.length; index++) {
			ILiquidityGauge(_gauges[index]).claim_rewards_for(msg.sender, address(this));
		}

		// Lock the SDT to the veSDT if any
		balance = IERC20(SDT).balanceOf(address(this));
		if (balance > 0) {
			IERC20(SDT).approve(depositors[SDT], balance);
			IVeSDT(depositors[SDT]).deposit_for_from(msg.sender, balance);
		}

		// If depositor is present, deposit it else send it to the user
		for (uint256 index = 0; index < _extraTokens.length; index++) {
			balance = IERC20(_extraTokens[index]).balanceOf(address(this));
			if (balance > 0) {
				address depositor = depositors[_extraTokens[index]];
				if (depositor != address(0)) {
					IERC20(_extraTokens[index]).approve(depositors[_extraTokens[index]], balance);
					IDepositor(depositors[_extraTokens[index]]).deposit(balance, false);
					address sdToken = IDepositor(depositors[_extraTokens[index]]).minter();
					uint256 sdTokenBalance = IERC20(sdToken).balanceOf(address(this)); 
					IERC20(sdToken).safeTransfer(msg.sender, sdTokenBalance);
				} else {
					IERC20(_extraTokens[index]).safeTransfer(msg.sender, balance);
				}
			}
		}

		emit RewardClaimedAndLocked(_gauges, _locks, _extraTokens);
	}

	/// @notice A function that recover any ERC20 token
	/// @param _token token address 
	/// @param _amount amount to rescue
	/// @param _recipient address to send token rescued
	function recoverERC20(
		address _token,
		uint256 _amount,
		address _recipient
	) external onlyGovernance {
		IERC20(_token).safeTransfer(_recipient, _amount);
		emit Recovered(_token, _amount);
	}

	/// @notice A function that set a depositor for a specific token
	/// @param _token token address  
	/// @param _depositor depositor address 
	function setDepositor(address _token, address _depositor) public onlyGovernance {
		depositors[_token] = _depositor;
	}

	/// @notice A function that set the governance address 
	/// @param _governance governance address  
	function setGovernance(address _governance) public onlyGovernance {
		governance = _governance;
	}
}