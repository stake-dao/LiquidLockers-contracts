//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "openzeppelin-contracts-upgradeable/utils/AddressUpgradeable.sol";
import "openzeppelin-contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "openzeppelin-contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "openzeppelin-contracts/token/ERC20/ERC20.sol";
import "../../interfaces/ILiquidityGaugeStrat.sol";
import "./PendleStrategy.sol";

contract PendleVault is ERC20Upgradeable {
    using SafeERC20Upgradeable for ERC20Upgradeable;
    using AddressUpgradeable for address;

    ERC20Upgradeable public token;
    address public locker;
    address public governance;
    uint256 public withdrawalFee;
    address public liquidityGauge;
    PendleStrategy public pendleStrategy;

    event Deposit(address _depositor, uint256 _amount);
    event Withdraw(address _depositor, uint256 _amount);

    function init(
        ERC20Upgradeable _token,
        address _governance,
        string memory name_,
        string memory symbol_,
        PendleStrategy _pendleStrategy
    ) public initializer {
        __ERC20_init(name_, symbol_);
        token = _token;
        governance = _governance;
        pendleStrategy = _pendleStrategy;
    }

    function deposit(address _staker, uint256 _amount) public {
        require(address(liquidityGauge) != address(0), "Gauge not yet initialized");
        token.safeTransferFrom(msg.sender, locker, _amount);
        _mint(address(this), _amount);
        ERC20Upgradeable(address(this)).approve(liquidityGauge, _amount);
        ILiquidityGaugeStrat(liquidityGauge).deposit(_amount, _staker);
        emit Deposit(_staker, _amount);
    }

    function withdraw(uint256 _shares) public {
        uint256 userTotalShares = ILiquidityGaugeStrat(liquidityGauge).balanceOf(msg.sender);
        require(_shares <= userTotalShares, "Not enough staked");
        ILiquidityGaugeStrat(liquidityGauge).withdraw(_shares, msg.sender, true);
        _burn(address(this), _shares);
        pendleStrategy.withdraw(address(token), _shares);
        uint256 withdrawFee = (_shares * withdrawalFee) / 10_000;
        token.safeTransfer(governance, withdrawFee);
        token.safeTransfer(msg.sender, _shares - withdrawFee);
        emit Withdraw(msg.sender, _shares - withdrawFee);
    }

    // function withdrawAll() external {
    //     withdraw(balanceOf(msg.sender));
    // }

    function setGovernance(address _governance) external {
        require(msg.sender == governance, "!governance");
        governance = _governance;
    }

    function setLiquidityGauge(address _liquidityGauge) external {
        require(msg.sender == governance, "!governance");
        liquidityGauge = _liquidityGauge;
    }

    function setPendleStrategy(PendleStrategy _newStrat) external {
        require(msg.sender == governance, "!governance");
        pendleStrategy = _newStrat;
    }

    function decimals() public view override returns (uint8) {
        return token.decimals();
    }

    function setWithdrawnFee(uint256 _newFee) external {
        require(msg.sender == governance, "!governance");
        withdrawalFee = _newFee;
    }

    // function available() public view returns (uint256) {
    //     return ((token.balanceOf(address(this)) - accumulatedFee) * min) / max;
    // }
}
