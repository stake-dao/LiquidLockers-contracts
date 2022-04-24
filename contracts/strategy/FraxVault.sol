//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/IMultiRewards.sol";
import "./FraxStrategy.sol";

// Maybe we have to create a ERC721 instead of ERC20? Because each deposit are unique
contract FraxVault is ERC20Upgradeable {
	using SafeERC20Upgradeable for ERC20Upgradeable;
	using AddressUpgradeable for address;

	IERC20 public token;
	address public governance;
	uint256 public withdrawalFee;
	address public multiRewardsGauge;
	address public constant LIQUIDLOCKER = 0xCd3a267DE09196C48bbB1d9e842D7D7645cE448f;
	FraxStrategy public fraxStrategy;

	/*
	uint256 public min; // not used anymore
	uint256 public constant max = 10000; // not used anymore
	*/

	event Earn(address _token, uint256 _amount);
	event Deposit(address _depositor, uint256 _amount);
	event Withdraw(address _depositor, uint256 _amount);

	function init(
		address _token,
		address _governance,
		string memory name_,
		string memory symbol_,
		FraxStrategy _fraxStrategy
	) public initializer {
		__ERC20_init(name_, symbol_);
		token = IERC20(_token);
		governance = _governance;
		withdrawalFee = 50; // %0.5
		//min = 10000;
		fraxStrategy = _fraxStrategy;
	}

	function deposit(uint256 _amount, uint256 _sec) public {
		require(address(multiRewardsGauge) != address(0), "Gauge not yet initialized");
		token.transferFrom(msg.sender, LIQUIDLOCKER, _amount);
		// Do we want to send directly to the liquid locker, or make it through different step like
		// first on this vault, then on the strategy, then on the LIQUIDLOCKER?
		uint256 _sdAmount = (_sec * _amount) / (60 * 60 * 24 * 364);
		_mint(address(this), _sdAmount);
		ERC20Upgradeable(address(this)).approve(multiRewardsGauge, _sdAmount);
		IMultiRewards(multiRewardsGauge).stakeFor(msg.sender, _sdAmount);
		IMultiRewards(multiRewardsGauge).mintFor(msg.sender, _sdAmount);
		fraxStrategy.deposit(address(token), _amount, _sec);
		emit Deposit(msg.sender, _amount);
	}

	// No more earn function because all deposit are differents
	/*
	function earn() external {
		require(msg.sender == governance, "!governance");
		uint256 tokenBalance = available();
		token.increaseAllowance(address(fraxStrategy), tokenBalance);
		fraxStrategy.deposit(address(token), tokenBalance);
		emit Earn(address(token), tokenBalance);
	}

	function available() public view returns (uint256) {
		return (token.balanceOf(address(this)) * min) / max;
	}*/

	function setGovernance(address _governance) public {
		require(msg.sender == governance, "!governance");
		governance = _governance;
	}

	function setGaugeMultiRewards(address _multiRewardsGauge) public {
		require(msg.sender == governance, "!governance");
		multiRewardsGauge = _multiRewardsGauge;
	}

	function setFraxStrategy(FraxStrategy _newStrat) public {
		require(msg.sender == governance, "!governance");
		fraxStrategy = _newStrat;
	}

	function decimals() public view override returns (uint8) {
		return 18; //token.decimals();
	}

	function setWithdrawnFee(uint256 _newFee) external {
		require(msg.sender == governance, "!governance");
		withdrawalFee = _newFee;
	}

	/*
	function setMin(uint256 _min) external {
		require(msg.sender == governance, "!governance");
		min = _min;
	}
	*/
}
