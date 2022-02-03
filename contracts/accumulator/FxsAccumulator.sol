// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ILiquidityGauge.sol";
import "../interfaces/ILocker.sol";

/// @title A contract that accumulates FXS rewards and notifies them to the LGV4
/// @author StakeDAO
contract FxsAccumulator {
    /* ========== STATE VARIABLES ========== */
    address public governance;
    address public locker;
    address public tokenReward = 0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0; // fxs
    address public gauge;

    /* ========== EVENTS ========== */
    event GaugeSet(address oldGauge, address newGauge);
    event RewardNotified(address gauge, uint256 amount);
    event LockerSet(address oldLocker, address newLocker);
    event GovernanceSet(address oldGov, address newGov);
    event TokenRewardSet(address oldTr, address newTr);

    /* ========== CONSTRUCTOR ========== */
    constructor() {
        governance = msg.sender;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */
    /// @notice Claims rewards from the locker and notifies it to the LGV4
    function claimAndNotify() external {
        require(locker != address(0));
        ILocker(locker).claimFXSRewards(address(this));
        _notifyReward();
    }

    /// @notice Notify the new reward to the LGV4
    function _notifyReward() internal {
        require(gauge != address(0));
        uint256 balanceBefore = IERC20(tokenReward).balanceOf(address(this));
        IERC20(tokenReward).approve(gauge, balanceBefore);
        ILiquidityGauge(gauge).deposit_reward_token(tokenReward, balanceBefore);
        uint256 balanceAfter = IERC20(tokenReward).balanceOf(address(this));
        require(balanceAfter == 0);
        emit RewardNotified(gauge, balanceBefore);
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