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

contract AngleVaultGamma is ERC20 {
    using SafeERC20 for ERC20;

    ERC20 public token;
    address public governance;
    address public liquidityGauge;
    address public constant MERKLE_DISTRIBUTOR = 0x5a93D504604fB57E15b0d73733DDc86301Dde2f1; 
    address public constant ANGLE = 0x31429d1856aD1377A8A0079410B297e1a9e214c2;

    event Earn(address _token, uint256 _amount);
    event Deposit(address _depositor, uint256 _amount);
    event Withdraw(address _depositor, uint256 _amount);

    constructor(
        ERC20 _token,
        address _governance,
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) {
        token = _token;
        governance = _governance;
    }

    function deposit(address _staker, uint256 _amount) external {
        require(address(liquidityGauge) != address(0), "Gauge not yet initialized");
        token.safeTransferFrom(msg.sender, address(this), _amount);
        _mint(address(this), _amount);
        ERC20(address(this)).approve(liquidityGauge, _amount);
        ILiquidityGaugeStrat(liquidityGauge).deposit(_amount, _staker);
        emit Deposit(_staker, _amount);
    }

    function withdraw(uint256 _shares) public {
        uint256 userTotalShares = ILiquidityGaugeStrat(liquidityGauge).balanceOf(msg.sender);
        require(_shares <= userTotalShares, "Not enough staked");
        ILiquidityGaugeStrat(liquidityGauge).withdraw(_shares, msg.sender, true);
        _burn(address(this), _shares);
        token.safeTransfer(msg.sender, _shares);
        emit Withdraw(msg.sender, _shares);
    }

    function claimAndNotify(bytes32[][] calldata _proofs, uint256 _amount) external {
        address[] memory users = new address[](1);
        users[0] = address(this);
        address[] memory tokens = new address[](1);
        tokens[0] = ANGLE;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = _amount;
        IMekle(MERKLE_DISTRIBUTOR).claim(users, tokens, amounts, _proofs);
        uint256 rewardToNotify = ERC20(ANGLE).balanceOf(address(this));
        ERC20(address(this)).approve(liquidityGauge, rewardToNotify);
        ILiquidityGaugeStrat(liquidityGauge).deposit_reward_token(ANGLE, rewardToNotify);
    }

    function setRewardDistributor(address _distributor) external {
        require(msg.sender == governance, "!governance");
        ILiquidityGaugeStrat(liquidityGauge).set_reward_distributor(ANGLE, _distributor);
    }

    function setGovernance(address _governance) external {
        require(msg.sender == governance, "!governance");
        governance = _governance;
    }

    function setLiquidityGauge(address _liquidityGauge) external {
        require(msg.sender == governance, "!governance");
        liquidityGauge = _liquidityGauge;
    }

    function decimals() public view override returns (uint8) {
        return token.decimals();
    }

    function available() public view returns (uint256) {
        return token.balanceOf(address(this));
    }
}
