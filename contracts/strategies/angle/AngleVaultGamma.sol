//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "openzeppelin-contracts/token/ERC20/ERC20.sol";
import "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import "../../interfaces/ILiquidityGaugeStrat.sol";
import "../../interfaces/IAngleMerkleDistributor.sol";

contract AngleVaultGamma is ERC20 {
    using SafeERC20 for ERC20;

    error GAUGE_NOT_SET();
    error NOT_ENOUGH_STAKED();
    error NOT_ALLOWED();

    ERC20 public token;
    address public governance;
    address public liquidityGauge;
    address public constant MERKLE_DISTRIBUTOR = 0x5a93D504604fB57E15b0d73733DDc86301Dde2f1; 
    address public constant ANGLE = 0x31429d1856aD1377A8A0079410B297e1a9e214c2;

    event Earn(address _token, uint256 _amount);
    event Deposit(address indexed _depositor, uint256 _amount);
    event Withdraw(address indexed _depositor, uint256 _amount);

    constructor(
        address _token,
        address _governance,
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) {
        token = ERC20(_token);
        governance = _governance;
    }

    /// @notice function to deposit LP into the vault
    /// @param _staker user to deposit token for 
    /// @param _amount amount to deposit
    function deposit(address _staker, uint256 _amount) external {
        if (address(liquidityGauge) == address(0)) revert GAUGE_NOT_SET();
        token.safeTransferFrom(msg.sender, address(this), _amount);
        _mint(address(this), _amount);
        ERC20(address(this)).approve(liquidityGauge, _amount);
        ILiquidityGaugeStrat(liquidityGauge).deposit(_amount, _staker);
        emit Deposit(_staker, _amount);
    }

    /// @notice function to withdraw LP from the vault
    /// @param _shares amount to withdraw
    function withdraw(uint256 _shares) public {
        uint256 userTotalShares = ILiquidityGaugeStrat(liquidityGauge).balanceOf(msg.sender);
        if (_shares > userTotalShares) revert NOT_ENOUGH_STAKED();
        ILiquidityGaugeStrat(liquidityGauge).withdraw(_shares, msg.sender, true);
        _burn(address(this), _shares);
        token.safeTransfer(msg.sender, _shares);
        emit Withdraw(msg.sender, _shares);
    }

    /// @notice function to set the governance
    /// @param _governance governance address
    function setGovernance(address _governance) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        governance = _governance;
    }

    /// @notice function to set the liquidity gauge
    /// @param _liquidityGauge gauge address 
    function setLiquidityGauge(address _liquidityGauge) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        liquidityGauge = _liquidityGauge;
    }

    /// @notice function to get the token decimal (same than the underlying token's decimal)
    function decimals() public view override returns (uint8) {
        return token.decimals();
    }

    /// @notice function to get the total amount available
    function available() public view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /// @notice function to set the operator that can claim reward on behalf of the vault
    /// @param _operator operator address 
    function toggleOperator(address _operator) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        IAngleMerkleDistributor(MERKLE_DISTRIBUTOR).toggleOperator(address(this), _operator);
    }

    /// @notice function to whitelist (allow) the contract to set an operator
    function toggleWhitelist() external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        IAngleMerkleDistributor(MERKLE_DISTRIBUTOR).toggleWhitelist(address(this));
    }

    /// @notice function to give the approve to transfer ANGLE for a claimer
    /// @param _claimer claimer address  
    function approveClaimer(address _claimer) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        ERC20(ANGLE).approve(_claimer, type(uint256).max);
    }
}
