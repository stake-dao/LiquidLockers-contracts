//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IMultiRewards.sol";
import "./AngleStrategy.sol";

contract AngleVault is ERC20 {
	using SafeERC20 for ERC20;
	using Address for address;

	ERC20 public token;
	address public governance;
	address public multiRewardsGauge;
	AngleStrategy public angleStrategy;

	event Earn(address _token, uint256 _amount);
	event Deposit(address _depositor, uint256 _amount);

	constructor(
		address _token,
		string memory name_,
		string memory symbol_
	) ERC20(name_, symbol_) {
		token = ERC20(_token);
		governance = msg.sender;
	}

	function deposit(uint256 _amount) public {
		require(address(multiRewardsGauge) != address(0), "Gauge not yet initialized");
		token.safeTransferFrom(msg.sender, address(this), _amount);
		_mint(address(this), _amount);
		IERC20(address(this)).approve(multiRewardsGauge, _amount);
		IMultiRewards(multiRewardsGauge).stakeFor(msg.sender, _amount);
		IMultiRewards(multiRewardsGauge).mintFor(msg.sender, _amount);
		emit Deposit(msg.sender, _amount);
	}

	function depositAll() external {
		deposit(token.balanceOf(msg.sender));
	}

	function withdraw(uint256 _shares) public {
		uint256 userTotalShares = IMultiRewards(multiRewardsGauge).balanceOf(msg.sender);
		require(_shares <= userTotalShares, "Not enough staked");
		IMultiRewards(multiRewardsGauge).withdrawFor(msg.sender, _shares);
		_burn(address(this), _shares);
		uint256 tokenBalance = token.balanceOf(address(this));
		if (_shares > tokenBalance) {
			angleStrategy.withdraw(address(token), _shares);
		}
		IMultiRewards(multiRewardsGauge).burnFrom(msg.sender, _shares);
		token.safeTransfer(msg.sender, _shares);
	}

	function withdrawAll() external {
		withdraw(balanceOf(msg.sender));
	}

	function setGovernance(address _governance) public {
		require(msg.sender == governance, "!governance");
		governance = _governance;
	}

	function setGaugeMultiRewards(address _multiRewardsGauge) public {
		require(msg.sender == governance, "!governance");
		multiRewardsGauge = _multiRewardsGauge;
	}

	function setAngleStrategy(AngleStrategy _newStrat) public {
		require(msg.sender == governance, "!governance");
		angleStrategy = _newStrat;
	}

	function decimals() public view override returns (uint8) {
		return token.decimals();
	}

	function earn() external {
		require(msg.sender == governance, "!governance");
		uint256 tokenBalance = token.balanceOf(address(this));
		token.approve(address(angleStrategy), tokenBalance);
		angleStrategy.deposit(address(token), tokenBalance);
		emit Earn(address(token), tokenBalance);
	}
}
