// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "../interfaces/ILiquidityGauge.sol";
import "../interfaces/IDepositor.sol";
import "../interfaces/IVeSDT.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";

// Claim rewards contract:
// 1) Users can claim rewards from pps gauge and directly receive all tokens collected.
// 2) Users can choose to direcly lock tokens supported by lockers (FXS, ANGLE) and receive the others not supported.
// 3) Users can choose to direcly lock tokens supported by lockers (FXS, ANGLE) and stake sdToken into the gauge, then receives the others not supported.
contract ClaimRewards {
	using SafeERC20 for IERC20;
	address constant public SDT = 0x73968b9a57c6E53d41345FD57a6E6ae27d6CDB2F;
	address public governance;

	mapping(address => address) public depositors;
	mapping(address => uint256) public depositorsIndex;
	mapping(address => bool) public gauges;

	struct LockStatus {
		bool[] locked;
		bool[] staked;
		bool lockSDT;
	}

	uint256 public depositorsCount;

	uint256 private immutable MAX_REWARDS = 8;

	event GaugeEnabled(address gauge);
	event GaugeDisabled(address gauge);
	event DepositorEnabled(address token, address depositor);
	event DepositorDisabled(address token, address depositor);
	event Recovered(address token, uint256 amount);
	event RewardsClaimed(address claimer, address[] gauges);
	event RewardClaimedAndLocked(address[] gauges, bool locks, bool stake);
	event RewardClaimedAndSent(address user, address[] gauges);

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
		emit RewardsClaimed(msg.sender, _gauges);
	}

	/// @notice A function that allows the user to claim, lock and stake tokens retrieved from gauges
	/// @param _gauges Gauges from which rewards are to be claimed
	/// @param _lockStatus Status of locks for each reward token suppported by depositors and for SDT
	function claimAndLock(
		address[]  memory _gauges,
		LockStatus memory _lockStatus
	) public {
		LockStatus memory lockStatus = _lockStatus;
		require(lockStatus.locked.length == lockStatus.staked.length, "different length");
		require(lockStatus.locked.length == depositorsCount, "different length");

		// Claim rewards token from gauges
		for (uint256 index = 0; index < _gauges.length; index++) {
			address gauge = _gauges[index];
			require(gauges[gauge], "Gauge not enabled");
			ILiquidityGauge(gauge).claim_rewards_for(msg.sender, address(this));
			// skip the first reward token, it is SDT for any LGV4
			// it loops at ost until max rewards hardcoded on LGV4
			for (uint256 i = 1; i < MAX_REWARDS; i++) {
				address token = ILiquidityGauge(gauge).reward_tokens(i);
				if(token == address(0)) {
					break;
				}
				address depositor = depositors[token];
				uint256 balance = IERC20(token).balanceOf(address(this));
				if(balance > 0) {
					if (depositor != address(0) && lockStatus.locked[depositorsIndex[token]]) {
						IERC20(token).approve(depositor, balance);
						IDepositor(depositor).deposit(balance, false);
						address sdToken = IDepositor(depositor).minter();
						uint256 sdTokenBalance = IERC20(sdToken).balanceOf(address(this)); 
						if (lockStatus.staked[depositorsIndex[token]]) {
							ILiquidityGauge(gauge).deposit(sdTokenBalance, msg.sender);
						} else {
							IERC20(sdToken).safeTransfer(msg.sender, sdTokenBalance);
						}
					} else {
						IERC20(token).safeTransfer(msg.sender, balance);
					}
				}
			}
		}

		// Lock SDT for veSDT or send to the user if any
		uint256 balanceBefore = IERC20(SDT).balanceOf(address(this));
		if (balanceBefore > 0) {
			if (lockStatus.lockSDT) {
				IERC20(SDT).approve(depositors[SDT], balanceBefore);
				IVeSDT(depositors[SDT]).deposit_for_from(msg.sender, balanceBefore);
			} else {
				IERC20(SDT).safeTransfer(msg.sender, balanceBefore);
			}
			require(IERC20(SDT).balanceOf(address(this)) == 0, "wrong amount sent");
		}
		//emit RewardClaimedAndLocked(_gauges, _lock, _stake);
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
		require(_recipient != address(0), "can't be zero address");
		IERC20(_token).safeTransfer(_recipient, _amount);
		emit Recovered(_token, _amount);
	}

	/// @notice A function that enable a gauge
	/// @param _gauge gauge address to enable
	function enableGauge(address _gauge) external onlyGovernance {
		require(_gauge != address(0), "can't be zero address");
		require(gauges[_gauge] == false, "already enabled");
		emit GaugeEnabled(_gauge);
	}

	/// @notice A function that disable a gauge
	/// @param _gauge gauge address to disable
	function disableGauge(address _gauge) external onlyGovernance {
		require(_gauge != address(0), "can't be zero address");
		require(gauges[_gauge], "already disabled");
		emit GaugeDisabled(_gauge);
	}

	/// @notice A function that add a new depositor for a specific token
	/// @param _token token address  
	/// @param _depositor depositor address 
	function addDepositor(address _token, address _depositor) public onlyGovernance {
		require(_token != address(0), "can't be zero address");
		require(_depositor != address(0), "can't be zero address");
		require(depositors[_token] == address(0), "already added");
		depositors[_token] = _depositor;
		depositorsIndex[_depositor] = depositorsCount;
		depositorsCount++;
		emit DepositorEnabled(_token, _depositor);
	}

	/// @notice A function that set the governance address 
	/// @param _governance governance address  
	function setGovernance(address _governance) public onlyGovernance {
		require(_governance != address(0), "can't be zero address");
		governance = _governance;
	}
}