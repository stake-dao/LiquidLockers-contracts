//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/IMultiRewards.sol";
import "./CurveStrategy.sol";

contract CurveVault is ERC20Upgradeable {
	using SafeERC20Upgradeable for ERC20Upgradeable;
	using AddressUpgradeable for address;

	ERC20Upgradeable public token;
	address public governance;
	uint256 public withdrawalFee;
	address public multiRewardsGauge;
	CurveStrategy public curveStrategy;
	uint256 public min;
	uint256 public constant max = 10000;
	event Earn(address _token, uint256 _amount);
	event Deposit(address _depositor, uint256 _amount);
	event Withdraw(address _depositor, uint256 _amount);

	function init(
		ERC20Upgradeable _token,
		address _governance,
		string memory name_,
		string memory symbol_,
		CurveStrategy _curveStrategy
	) public initializer {
		__ERC20_init(name_, symbol_);
		token = _token;
		governance = _governance;
		withdrawalFee = 50; // %0.5
		min = 10000;
		curveStrategy = _curveStrategy;
	}

	function deposit(uint256 _amount) public {
		require(address(multiRewardsGauge) != address(0), "Gauge not yet initialized");
		token.safeTransferFrom(msg.sender, address(this), _amount);
		_mint(address(this), _amount);
		ERC20Upgradeable(address(this)).approve(multiRewardsGauge, _amount);
		IMultiRewards(multiRewardsGauge).stakeFor(msg.sender, _amount);
		IMultiRewards(multiRewardsGauge).mintFor(msg.sender, _amount);
		emit Deposit(msg.sender, _amount);
	}

	function depositAll() external {
		deposit(token.balanceOf(msg.sender));
	}

	function withdraw(uint256 _shares) public {
		uint256 userTotalShares = IMultiRewards(multiRewardsGauge).stakeOf(msg.sender);
		require(_shares <= userTotalShares, "Not enough staked");
		IMultiRewards(multiRewardsGauge).withdrawFor(msg.sender, _shares);
		_burn(address(this), _shares);
		uint256 tokenBalance = token.balanceOf(address(this));
		uint256 withdrawFee;
		if (_shares > tokenBalance) {
			uint256 beforeBal = token.balanceOf(address(this));
			curveStrategy.withdraw(address(token), _shares);
			uint256 withdrawn = token.balanceOf(address(this)) - beforeBal;
			withdrawFee = (withdrawn * withdrawalFee) / 10000;
			token.safeTransfer(governance, withdrawFee);
		}
		IMultiRewards(multiRewardsGauge).burnFrom(msg.sender, _shares);
		token.safeTransfer(msg.sender, _shares - withdrawFee);
		emit Withdraw(msg.sender, _shares - withdrawFee);
	}

	function withdrawAll() external {
		withdraw(balanceOf(msg.sender));
	}

	function setGovernance(address _governance) external {
		require(msg.sender == governance, "!governance");
		governance = _governance;
	}

	function setGaugeMultiRewards(address _multiRewardsGauge) external {
		require(msg.sender == governance, "!governance");
		multiRewardsGauge = _multiRewardsGauge;
	}

	function setCurveStrategy(CurveStrategy _newStrat) external {
		require(msg.sender == governance, "!governance");
		curveStrategy = _newStrat;
	}

	function decimals() public view override returns (uint8) {
		return token.decimals();
	}

	function setWithdrawnFee(uint256 _newFee) external {
		require(msg.sender == governance, "!governance");
		withdrawalFee = _newFee;
	}

	function setMin(uint256 _min) external {
		require(msg.sender == governance, "!governance");
		min = _min;
	}

	function available() public view returns (uint256) {
		return (token.balanceOf(address(this)) * min) / max;
	}

	function earn() external {
		require(msg.sender == governance, "!governance");
		uint256 tokenBalance = available();
		token.increaseAllowance(address(curveStrategy), tokenBalance);
		curveStrategy.deposit(address(token), tokenBalance);
		emit Earn(address(token), tokenBalance);
	}
}
