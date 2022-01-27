// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "../external/AccessControlUpgradeable.sol";

import "../interfaces/IMasterchef.sol";
import "../interfaces/IGaugeController.sol";
import "../interfaces/ILiquidityGauge.sol";
import "../interfaces/IStakingRewards.sol";

import "./MasterchefMasterToken.sol";
import "hardhat/console.sol";

contract SdtDistributor2 is ReentrancyGuardUpgradeable, AccessControlUpgradeable {
	using SafeERC20 for IERC20;

	event RewardDistributed(address indexed gaugeAddr, uint256 sdtDistributed);

	uint256 public constant DAY = 3600 * 24;

	/// @notice Role for governors only
	bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");
	/// @notice Role for the guardian
	bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

	/// @notice Address of the SDT token given as a reward
	IERC20 public rewardToken;

	/// @notice Address of the token that will be deposited in masterchef
	IERC20 public masterchefToken;

	/// @notice Address of the masterchef
	IMasterchef public masterchef;

	/// @notice Address of the `GaugeController` contract
	IGaugeController public controller;

	/// @notice Address responsible for pulling rewards of type >= 2 gauges and distributing it to the
	/// associated contracts if there is not already an address delegated for this specific contract
	address public delegateGauge;

	/// @notice Whether SDT distribution through this contract is on or no
	bool public distributionsOn;

	/// @notice masterchef pid
	uint256 public masterchefPID;

	uint256 public lastMasterchefPull;

	mapping(uint256 => uint256) public pulls; // day => SDT amount

	function initialize(
		address _rewardToken,
		address _controller,
		address _masterchef,
		address governor,
		address guardian,
		address _delegateGauge
	) external initializer {
		require(
			_controller != address(0) && _rewardToken != address(0) && guardian != address(0) && governor != address(0),
			"0"
		);
		rewardToken = IERC20(_rewardToken);
		controller = IGaugeController(_controller);
		delegateGauge = _delegateGauge;
		masterchef = IMasterchef(_masterchef);
		masterchefToken = IERC20(address(new MasterchefMasterToken()));
		distributionsOn = false;

		_setRoleAdmin(GOVERNOR_ROLE, GOVERNOR_ROLE);
		_setRoleAdmin(GUARDIAN_ROLE, GOVERNOR_ROLE);
		_setupRole(GUARDIAN_ROLE, guardian);
		_setupRole(GOVERNOR_ROLE, governor);
		_setupRole(GUARDIAN_ROLE, governor);
	}

	/// @custom:oz-upgrades-unsafe-allow constructor
	constructor() initializer {}

	function initializeMasterchef(uint256 _pid) external onlyRole(GOVERNOR_ROLE) {
		masterchefPID = _pid;
		masterchefToken.approve(address(masterchef), 1e18);
		masterchef.deposit(_pid, 1e18);
	}

	function distributeMulti(address[] memory gauges) external nonReentrant {
		require(distributionsOn == true, "not allowed");

		if (block.timestamp > lastMasterchefPull + DAY) {
			console.log("DISTRIBUTION");

			uint256 sdtBefore = rewardToken.balanceOf(address(this));
			_pullSDT();
			pulls[block.timestamp] = rewardToken.balanceOf(address(this)) - sdtBefore;
			lastMasterchefPull = block.timestamp;
		}

		for (uint256 i = 0; i < gauges.length; i++) {
			_distributeReward(gauges[i]);
		}
	}

	function _distributeReward(address gaugeAddr) internal {
		int128 gaugeType = controller.gauge_types(gaugeAddr);
		uint256 sdtBalance = pulls[lastMasterchefPull];

		console.log("sdtBalance", sdtBalance);

		uint256 gaugeRelativeWeight = controller.gauge_relative_weight(gaugeAddr);
		uint256 totalWeight = controller.get_total_weight();

		console.log("gaugeAddr", gaugeAddr);
		console.log("gaugeRelativeWeight", gaugeRelativeWeight);
		console.log("totalWeight", totalWeight);

		//uint256 sdtDistributed = (sdtBalance * ((gaugeRelativeWeight * 1e36) / totalWeight)) / 1e18;
		uint256 sdtDistributed = sdtBalance * gaugeRelativeWeight / 1e18;

		console.log("sdtDistributed", sdtDistributed);

		if (gaugeType == 1) {
			rewardToken.safeTransfer(gaugeAddr, sdtDistributed);
			IStakingRewards(gaugeAddr).notifyRewardAmount(sdtDistributed);
		} else if (gaugeType >= 2) {
			// TODO need to be implemented
		} else {
			if (IERC20(rewardToken).allowance(address(this), gaugeAddr) == 0) {
				rewardToken.safeApprove(gaugeAddr, type(uint256).max);
			}
			ILiquidityGauge(gaugeAddr).deposit_reward_token(address(rewardToken), sdtDistributed);
		}

		emit RewardDistributed(gaugeAddr, sdtDistributed);
	}

	function _pullSDT() internal {
		masterchef.withdraw(masterchefPID, 0);
	}

	function setDistribution(bool _state) external onlyRole(GOVERNOR_ROLE) {
		distributionsOn = _state;
	}
}
