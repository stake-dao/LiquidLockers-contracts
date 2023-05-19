//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "openzeppelin-contracts/token/ERC20/ERC20.sol";
import "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import "../../interfaces/ILiquidityGaugeStrat.sol";

interface IMekle {
    function claim(
        address[] calldata users, 
        address[] calldata tokens, 
        uint256[] calldata amounts, 
        bytes32[][] calldata proofs
    ) external;
}

interface IGammaVault {
    function liquidityGauge() external returns(address);
}

contract AngleGammaClaimer {
    using SafeERC20 for ERC20;

    error GAUGE_NOT_SET();
    error NOT_ENOUGH_STAKED();
    error NOT_ALLOWED();

    address public governance;
    address public constant MERKLE_DISTRIBUTOR = 0x5a93D504604fB57E15b0d73733DDc86301Dde2f1; 
    address public constant ANGLE = 0x31429d1856aD1377A8A0079410B297e1a9e214c2;

    // FEE
    uint256 constant BASE_FEE = 10_000;
    address public daoRecipient;
    uint256 public daoFee;
    address public accRecipient;
    uint256 public accFee;
    address public veSdtFeeRecipient;
    uint256 public veSdtFeeFee;

    event Earn(address _token, uint256 _amount);
    event DaoRecipientSet(address _oldR, address _newR);
    event AccRecipientSet(address _oldR, address _newR);
    event VeSdtFeeRecipientSet(address _oldR, address _newR);
    event DaoFeeSet(uint256 _oldF, uint256 _newF);
    event AccFeeSet(uint256 _oldF, uint256 _newF);
    event VeSdtFeeFeeSet(uint256 _oldF, uint256 _newF);

    constructor(address _governance) {
        governance = _governance;
    }

    function claimAndNotify(
        bytes32[][] calldata _proofs,
        address _vault, 
        uint256 _amount
    ) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        address[] memory users = new address[](1);
        users[0] = _vault;
        address[] memory tokens = new address[](1);
        tokens[0] = ANGLE;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = _amount;
        IMekle(MERKLE_DISTRIBUTOR).claim(users, tokens, amounts, _proofs);
        uint256 rewardToNotify = _chargeFees(ERC20(ANGLE).balanceOf(address(this)));
        address liquidityGauge = IGammaVault(_vault).liquidityGauge();
        ERC20(address(this)).approve(liquidityGauge, rewardToNotify);
        ILiquidityGaugeStrat(liquidityGauge).deposit_reward_token(ANGLE, rewardToNotify);
    }

    function _chargeFees(uint256 _amount) internal returns (uint256 amountToNotify) {
        uint256 daoPart = (_amount * daoFee / BASE_FEE);
        ERC20(ANGLE).safeTransfer(daoRecipient, daoPart);
        uint256 accPart = (_amount * accFee / BASE_FEE);
        ERC20(ANGLE).safeTransfer(accRecipient, accPart);
        uint256 veSdtFeePart = (_amount * veSdtFeeFee / BASE_FEE);
        ERC20(ANGLE).safeTransfer(veSdtFeeRecipient, veSdtFeePart);
        amountToNotify = _amount - daoPart - accPart - veSdtFeePart;
    }

    function setDaoRecipient(address _daoRecipient) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        emit DaoRecipientSet(daoRecipient, _daoRecipient);
        daoRecipient = _daoRecipient;
    }

    function setAccRecipient(address _accRecipient) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        emit AccRecipientSet(accRecipient, _accRecipient);
        accRecipient = _accRecipient;
    }

    function setVeSdtFeeRecipient(address _veSdtFeeRecipient) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        emit VeSdtFeeRecipientSet(veSdtFeeRecipient, _veSdtFeeRecipient);
        veSdtFeeRecipient = _veSdtFeeRecipient;
    }

    function setDaoFee(uint256 _daoFee) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        emit DaoFeeSet(daoFee, _daoFee);
        daoFee = _daoFee;
    }

    function setAccFee(uint256 _accFee) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        emit AccFeeSet(accFee, _accFee);
        accFee = _accFee;
    }

    function setVeSdtFeeFee(uint256 _veSdtFeeFee) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        emit VeSdtFeeFeeSet(veSdtFeeFee, _veSdtFeeFee);
        veSdtFeeFee = _veSdtFeeFee;
    }

    function setRewardDistributor(address _gauge, address _distributor) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        ILiquidityGaugeStrat(_gauge).set_reward_distributor(ANGLE, _distributor);
    }

    function setGovernance(address _governance) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        governance = _governance;
    }
}