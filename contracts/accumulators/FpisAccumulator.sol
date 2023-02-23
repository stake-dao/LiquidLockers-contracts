// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "./BaseAccumulator.sol";

/// @title A contract that accumulates FPIS rewards and notifies them to the LGV4
/// @author StakeDAO
contract FpisAccumulator is BaseAccumulator {

    error FEE_TOO_HIGH();
    error NOT_ALLOWED();

    address public bribeRecipient;
    address public daoRecipient;
    uint256 public bribeFee;
    uint256 public daoFee;
    /* ========== CONSTRUCTOR ========== */
    constructor(address _tokenReward, address _gauge) BaseAccumulator(_tokenReward, _gauge) {}

    /* ========== MUTATIVE FUNCTIONS ========== */
    /// @notice Claims rewards from the locker and notifies it to the LGV4
    /// @param _amount amount to notify
    function claimAndNotify(uint256 _amount) external {
        require(locker != address(0), "locker not set");
        ILocker(locker).claimFPISRewards(address(this));
        uint256 gaugeAmount = _chargeFee(_amount);
        _notifyReward(tokenReward, gaugeAmount);
        _distributeSDT();
    }

    /// @notice Claims rewards from the locker and notify all to the LGV4
    function claimAndNotifyAll() external {
        require(locker != address(0), "locker not set");
        ILocker(locker).claimFPISRewards(address(this));
        uint256 amount = IERC20(tokenReward).balanceOf(address(this));
        uint256 gaugeAmount = _chargeFee(amount);
        _notifyReward(tokenReward, gaugeAmount);
        _distributeSDT();
    }

    function _chargeFee(uint256 _amount) internal returns(uint256) {
        // dao part
        uint256 daoAmount = (_amount * daoFee) / 10_000;
        IERC20(tokenReward).transfer(daoRecipient, daoAmount);
        // bribe part
        uint256 bribeAmount = (_amount * bribeFee) / 10_000;
        IERC20(tokenReward).transfer(bribeRecipient, bribeAmount);
        return _amount - daoAmount - bribeAmount;
    }

    /// @notice Set DAO recipient
    /// @param _daoRecipient recipient address
    function setDaoRecipient(address _daoRecipient) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        daoRecipient = _daoRecipient;

    }

    /// @notice Set Bribe recipient
    /// @param _bribeRecipient recipient address
    function setBribeRecipient(address _bribeRecipient) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        bribeRecipient = _bribeRecipient;
    }

    /// @notice Set fees reserved to the DAO at every claim
    /// @param _daoFee fee (100 = 1%)
    function setDaoFee(uint256 _daoFee) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        if (_daoFee > 10_000) revert FEE_TOO_HIGH();
        daoFee = _daoFee;
    }

    /// @notice Set fees reserved to bribes at every claim
    /// @param _bribeFee fee (100 = 1%)
    function setBribeFee(uint256 _bribeFee) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        if (_bribeFee > 10_000) revert FEE_TOO_HIGH();
        bribeFee = _bribeFee;
    }
}
