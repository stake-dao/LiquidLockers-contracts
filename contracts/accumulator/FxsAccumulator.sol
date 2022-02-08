// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "./BaseAccumulator.sol";

/// @title A contract that accumulates FXS rewards and notifies them to the LGV4
/// @author StakeDAO
contract FxsAccumulator is BaseAccumulator {
    /* ========== CONSTRUCTOR ========== */
    constructor(address _tokenReward) BaseAccumulator(_tokenReward) {}

    /* ========== MUTATIVE FUNCTIONS ========== */
    /// @notice Claims rewards from the locker and notifies it to the LGV4
    function claimAndNotify() external {
        require(locker != address(0), "locker not set");
        ILocker(locker).claimFXSRewards(address(this));
        _notifyReward(tokenReward);
    }
}