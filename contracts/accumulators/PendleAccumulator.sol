// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "./BaseAccumulator.sol";
import {PendleLocker} from "../lockers/PendleLocker.sol";

/// @title A contract that accumulates PENDLE rewards and notifies them to the LGV4
/// @author StakeDAO
contract PendleAccumulator is BaseAccumulator {
    error FEE_TOO_HIGH();
    error NOT_ALLOWED();
    error ZERO_ADDRESS();

    address public bribeRecipient;
    address public daoRecipient;
    address public veSdtFeeProxy;
    uint256 public bribeFee;
    uint256 public daoFee;
    uint256 public veSdtFeeProxyFee;
    address[] public tokens;
    address[] public pools;

    event DaoRecipientSet(address _old, address _new);
    event BribeRecipientSet(address _old, address _new);
    event VeSdtFeeProxySet(address _old, address _new);
    event DaoFeeSet(uint256 _old, uint256 _new);
    event BribeFeeSet(uint256 _old, uint256 _new);
    event VeSdtFeeProxyFeeSet(uint256 _old, uint256 _new);

    /* ========== CONSTRUCTOR ========== */
    constructor(
        address _tokenReward,
        address _gauge,
        address _daoRecipient,
        address _bribeRecipient,
        address _veSdtFeeProxy
    ) BaseAccumulator(_tokenReward, _gauge) {
        daoRecipient = _daoRecipient;
        bribeRecipient = _bribeRecipient;
        veSdtFeeProxy = _veSdtFeeProxy;
        daoFee = 500; // 5%
        bribeFee = 1000; // 10%
    }

    /* ========== MUTATIVE FUNCTIONS ========== */
    /// @notice Claims rewards from the locker and notify all to the LGV4
    function claimAndNotifyAll() external {
        if (locker == address(0)) revert ZERO_ADDRESS();
        PendleLocker(locker).claimRewards(tokens, address(this), pools);
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 tokenAmount = IERC20(tokens[i]).balanceOf(address(this));
            if (tokenAmount > 0) {
                uint256 gaugeAmount = _chargeFee(tokens[i], tokenAmount);
                _notifyReward(tokens[i], gaugeAmount);
            }
        }

        _distributeSDT();
    }

    /// @notice Reserve fees for dao, bribe and veSdtFeeProxy
    /// @param _amount amount to charge fees
    function _chargeFee(
        address _token,
        uint256 _amount
    ) internal returns (uint256) {
        uint256 gaugeAmount = _amount;
        // dao part
        if (daoFee > 0) {
            uint256 daoAmount = (_amount * daoFee) / 10_000;
            IERC20(_token).transfer(daoRecipient, daoAmount);
            gaugeAmount -= daoAmount;
        }

        // bribe part
        if (bribeFee > 0) {
            uint256 bribeAmount = (_amount * bribeFee) / 10_000;
            IERC20(_token).transfer(bribeRecipient, bribeAmount);
            gaugeAmount -= bribeAmount;
        }

        // veSDTFeeProxy part
        if (veSdtFeeProxyFee > 0) {
            uint veSdtFeeProxyAmount = (_amount * veSdtFeeProxyFee) / 10_000;
            IERC20(_token).transfer(veSdtFeeProxy, veSdtFeeProxyAmount);
            gaugeAmount -= veSdtFeeProxyAmount;
        }
        return gaugeAmount;
    }

    /// @notice Set DAO recipient
    /// @param _daoRecipient recipient address
    function setDaoRecipient(address _daoRecipient) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        if (_daoRecipient == address(0)) revert ZERO_ADDRESS();
        emit DaoRecipientSet(daoRecipient, _daoRecipient);
        daoRecipient = _daoRecipient;
    }

    /// @notice Set Bribe recipient
    /// @param _bribeRecipient recipient address
    function setBribeRecipient(address _bribeRecipient) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        if (_bribeRecipient == address(0)) revert ZERO_ADDRESS();
        emit BribeRecipientSet(bribeRecipient, _bribeRecipient);
        bribeRecipient = _bribeRecipient;
    }

    /// @notice Set VeSdtFeeProxy
    /// @param _veSdtFeeProxy proxy address
    function setVeSdtFeeProxy(address _veSdtFeeProxy) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        if (_veSdtFeeProxy == address(0)) revert ZERO_ADDRESS();
        emit VeSdtFeeProxySet(veSdtFeeProxy, _veSdtFeeProxy);
        veSdtFeeProxy = _veSdtFeeProxy;
    }

    /// @notice Set fees reserved to the DAO at every claim
    /// @param _daoFee fee (100 = 1%)
    function setDaoFee(uint256 _daoFee) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        if (_daoFee > 10_000 || _daoFee + bribeFee + veSdtFeeProxyFee > 10_000)
            revert FEE_TOO_HIGH();
        emit DaoFeeSet(daoFee, _daoFee);
        daoFee = _daoFee;
    }

    /// @notice Set fees reserved to bribes at every claim
    /// @param _bribeFee fee (100 = 1%)
    function setBribeFee(uint256 _bribeFee) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        if (
            _bribeFee > 10_000 || _bribeFee + daoFee + veSdtFeeProxyFee > 10_000
        ) revert FEE_TOO_HIGH();
        emit BribeFeeSet(bribeFee, _bribeFee);
        bribeFee = _bribeFee;
    }

    /// @notice Set fees reserved to bribes at every claim
    /// @param _veSdtFeeProxyFee fee (100 = 1%)
    function setVeSdtFeeProxyFee(uint256 _veSdtFeeProxyFee) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        if (
            _veSdtFeeProxyFee > 10_000 ||
            _veSdtFeeProxyFee + daoFee + bribeFee > 10_000
        ) revert FEE_TOO_HIGH();
        emit VeSdtFeeProxyFeeSet(veSdtFeeProxyFee, _veSdtFeeProxyFee);
        veSdtFeeProxyFee = _veSdtFeeProxyFee;
    }

    function setPools(address[] calldata _pools) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        pools = _pools;
    }

    function setTokens(address[] calldata _tokens) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        tokens = _tokens;
    }
}
