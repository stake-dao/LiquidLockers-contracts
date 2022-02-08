// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ILiquidityGauge.sol";
import "../interfaces/ILocker.sol";

/// @title A contract that defines the functions shared by all accumulators 
/// @author StakeDAO
contract BaseAccumulator {
    /* ========== STATE VARIABLES ========== */
    address public governance;
    address public locker;
    address public tokenReward;
    address public gauge;

    /* ========== EVENTS ========== */
    event GaugeSet(address oldGauge, address newGauge);
    event RewardNotified(address gauge, address tokenReward, uint256 amount);
    event LockerSet(address oldLocker, address newLocker);
    event GovernanceSet(address oldGov, address newGov);
    event TokenRewardSet(address oldTr, address newTr);

    /* ========== CONSTRUCTOR ========== */
    constructor(address _tokenReward) {
        tokenReward = _tokenReward;
        governance = msg.sender;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /// @notice Notify the reward with an extra token
    /// @param _tokenReward token address to notify
    function notifyExtraReward(address _tokenReward) external {
        require(msg.sender == governance, "!gov");
        _notifyReward(_tokenReward);
    }

    /// @notice Notify the new reward to the LGV4
    function _notifyReward(address _tokenReward) internal {
        require(gauge != address(0), "gauge not set");
        uint256 balanceBefore = IERC20(_tokenReward).balanceOf(address(this));
        IERC20(_tokenReward).approve(gauge, balanceBefore);
        ILiquidityGauge(gauge).deposit_reward_token(_tokenReward, balanceBefore);
        uint256 balanceAfter = IERC20(_tokenReward).balanceOf(address(this));
        require(balanceAfter == 0, "balance !0");
        emit RewardNotified(gauge, _tokenReward, balanceBefore);
    }

    /// @notice Sets gauge for the accumulator which will receive and distribute the rewards
    /// @dev Can be called only by the governance
    function setGauge(address _gauge) external {
        require(msg.sender == governance, "!gov");
        emit GaugeSet(gauge, _gauge);
        gauge = _gauge;
    }

    /// @notice Allows the governance to set the governance
    /// @dev Can be called only by the governance
    function setGovernance(address _newG) external {
        require(msg.sender == governance, "!gov");
        emit GovernanceSet(governance, _newG);
        governance = _newG;
    }

    /// @notice Allows the governance to set the locker
    /// @dev Can be called only by the governance
    function setLocker(address _newL) external {
        require(msg.sender == governance, "!gov");
        emit LockerSet(locker, _newL);
        locker = _newL;
    }

    /// @notice Allows the governance to set the locker
    /// @dev Can be called only by the governance
    function setTokenReward(address _tokenReward) external {
        require(msg.sender == governance, "!gov");
        emit TokenRewardSet(tokenReward, _tokenReward);
        tokenReward = _tokenReward;
    }
}