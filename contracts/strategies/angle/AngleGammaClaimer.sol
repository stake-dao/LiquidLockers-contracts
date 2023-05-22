//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "openzeppelin-contracts/token/ERC20/ERC20.sol";
import "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import "../../interfaces/ILiquidityGaugeStrat.sol";
import "../../interfaces/IAngleMerkleDistributor.sol";

interface IGammaVault {
    function liquidityGauge() external returns(address);
}

contract AngleGammaClaimer {
    using SafeERC20 for ERC20;

    error NOT_ALLOWED();
    error FEE_TOO_HIGH();

    address public governance;
    address public constant MERKLE_DISTRIBUTOR = 0x5a93D504604fB57E15b0d73733DDc86301Dde2f1; 
    address public constant ANGLE = 0x31429d1856aD1377A8A0079410B297e1a9e214c2;

    // FEE
    uint256 public constant BASE_FEE = 10_000;
    address public daoRecipient;
    uint256 public daoFee;
    address public accRecipient;
    uint256 public accFee;
    address public veSdtFeeRecipient;
    uint256 public veSdtFeeFee;

    event Earn(uint256 _gaugeAmount, uint256 _daoPart, uint256 _accPart, uint256 _veSdtFeePart);
    event DaoRecipientSet(address _oldR, address _newR);
    event AccRecipientSet(address _oldR, address _newR);
    event VeSdtFeeRecipientSet(address _oldR, address _newR);
    event DaoFeeSet(uint256 _oldF, uint256 _newF);
    event AccFeeSet(uint256 _oldF, uint256 _newF);
    event VeSdtFeeFeeSet(uint256 _oldF, uint256 _newF);

    constructor(address _governance) {
        governance = _governance;
    }

    /// @notice function to claim and notify the ANGLE reward via merkle
    /// @param _proofs merkle proofs
    /// @param _vault vault to claim the reward for 
    /// @param _amount amount to notify
    function claimAndNotify(
        bytes32[][] calldata _proofs,
        address _vault, 
        uint256 _amount
    ) external {
        address[] memory users = new address[](1);
        users[0] = _vault;
        address[] memory tokens = new address[](1);
        tokens[0] = ANGLE;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = _amount;
        IAngleMerkleDistributor(MERKLE_DISTRIBUTOR).claim(users, tokens, amounts, _proofs);
        uint256 rewardToNotify = _chargeFees(ERC20(ANGLE).balanceOf(address(this)));
        address liquidityGauge = IGammaVault(_vault).liquidityGauge();
        ERC20(address(this)).approve(liquidityGauge, rewardToNotify);
        ILiquidityGaugeStrat(liquidityGauge).deposit_reward_token(ANGLE, rewardToNotify);
    }

    /// @notice internal function to calculate fees and sent them to recipients 
    /// @param _amount total amount to charge fees 
    function _chargeFees(uint256 _amount) internal returns (uint256 amountToNotify) {
        uint256 daoPart = (_amount * daoFee / BASE_FEE);
        ERC20(ANGLE).safeTransfer(daoRecipient, daoPart);
        uint256 accPart = (_amount * accFee / BASE_FEE);
        ERC20(ANGLE).safeTransfer(accRecipient, accPart);
        uint256 veSdtFeePart = (_amount * veSdtFeeFee / BASE_FEE);
        ERC20(ANGLE).safeTransfer(veSdtFeeRecipient, veSdtFeePart);
        amountToNotify = _amount - daoPart - accPart - veSdtFeePart;
        emit Earn(amountToNotify, daoPart, accPart, veSdtFeePart);
    }

    /// @notice function to set the dao fee recipient
    /// @param _daoRecipient recipient address
    function setDaoRecipient(address _daoRecipient) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        emit DaoRecipientSet(daoRecipient, _daoRecipient);
        daoRecipient = _daoRecipient;
    }

    /// @notice function to set the accumulator fee recipient
    /// @param _accRecipient recipient address
    function setAccRecipient(address _accRecipient) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        emit AccRecipientSet(accRecipient, _accRecipient);
        accRecipient = _accRecipient;
    }

    /// @notice function to set the veSdtFee fee recipient
    /// @param _veSdtFeeRecipient recipient address
    function setVeSdtFeeRecipient(address _veSdtFeeRecipient) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        emit VeSdtFeeRecipientSet(veSdtFeeRecipient, _veSdtFeeRecipient);
        veSdtFeeRecipient = _veSdtFeeRecipient;
    }

    /// @notice function to set the fees reserved for the dao
    /// @param _daoFee fee amount (10000 = 100%)
    function setDaoFee(uint256 _daoFee) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        if (_daoFee > BASE_FEE) revert FEE_TOO_HIGH();
        if (_daoFee + accFee + veSdtFeeFee > BASE_FEE) revert FEE_TOO_HIGH();
        emit DaoFeeSet(daoFee, _daoFee);
        daoFee = _daoFee;
    }

    /// @notice function to set the fees reserved for the accumulator
    /// @param _accFee fee amount (10000 = 100%)
    function setAccFee(uint256 _accFee) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        if (_accFee > BASE_FEE) revert FEE_TOO_HIGH();
        if (_accFee + veSdtFeeFee + daoFee > BASE_FEE) revert FEE_TOO_HIGH();
        emit AccFeeSet(accFee, _accFee);
        accFee = _accFee;
    }

    /// @notice function to set the fees reserved for the veSdtFee
    /// @param _veSdtFeeFee fee amount (10000 = 100%)
    function setVeSdtFeeFee(uint256 _veSdtFeeFee) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        if (_veSdtFeeFee > BASE_FEE) revert FEE_TOO_HIGH();
        if (_veSdtFeeFee + accFee + daoFee > BASE_FEE) revert FEE_TOO_HIGH();
        emit VeSdtFeeFeeSet(veSdtFeeFee, _veSdtFeeFee);
        veSdtFeeFee = _veSdtFeeFee;
    }
    
    /// @notice function to set the reward distributor for an sd gauge
    /// @param _gauge gauge address
    /// @param _distributor distributor address 
    function setRewardDistributor(address _gauge, address _distributor) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        ILiquidityGaugeStrat(_gauge).set_reward_distributor(ANGLE, _distributor);
    }

    /// @notice function to set the governance
    /// @param _governance governance address
    function setGovernance(address _governance) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        governance = _governance;
    }
}