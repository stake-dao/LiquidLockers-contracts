//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/IMultiRewards.sol";
import "./FraxStrategy.sol";

/**
Idea :
Do we want to make the sdLPToken transferable ?
If yes, it could be usefull to generate a ERC721 instead of a ERC20 as sdLPToken
because, each deposit are differents, due to the kekid creation on each deposit.
*/

contract FraxVault is ERC20Upgradeable {
	using SafeERC20Upgradeable for ERC20Upgradeable;
	using AddressUpgradeable for address;

	IERC20 public token;
	address public governance;
	uint256 public withdrawalFee;
	address public multiRewardsGauge;
	address public constant LIQUIDLOCKER = 0xCd3a267DE09196C48bbB1d9e842D7D7645cE448f;
	FraxStrategy public fraxStrategy;

	mapping(address => bytes32[]) public kekIdPerUser;

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

	/**
	Idea :
	Do we want to send directly LP token to the liquid locker, or make it through different step ?

	Optimised path for LP token : 
	user => frax locker => frax gauge
	Multiple step path for LP token :
	user => frax vault => frax stratehy => frax locker => frax gauge

	imo optimised path will save gas
	*/

	function deposit(uint256 _amount, uint256 _sec) public {
		require(address(multiRewardsGauge) != address(0), "Gauge not yet initialized");
		token.transferFrom(msg.sender, LIQUIDLOCKER, _amount);

		uint256 _sdAmount = (_sec * _amount) / (60 * 60 * 24 * 364);
		_mint(address(this), _sdAmount);
		ERC20Upgradeable(address(this)).approve(multiRewardsGauge, _sdAmount);
		IMultiRewards(multiRewardsGauge).stakeFor(msg.sender, _sdAmount);
		IMultiRewards(multiRewardsGauge).mintFor(msg.sender, _sdAmount);

		bytes32 _kekId = fraxStrategy.deposit(address(token), _amount, _sec);
		kekIdPerUser[msg.sender].push(_kekId);
		emit Deposit(msg.sender, _amount);
	}

	function withdraw(bytes32 _kekId) public {
		require(isOwner(msg.sender, _kekId), "not owner of this kekid"); // Useless
		// Todo : deal with sdLPToken to burn and so on
		uint256 _before = token.balanceOf(address(this));
		fraxStrategy.withdraw2(address(token), _kekId);
		uint256 _after = token.balanceOf(address(this));
		uint256 _net = _after - _before;
		token.transfer(msg.sender, _net);
	}

	function getKekIdUser(address _address) public view returns (bytes32[] memory) {
		return (kekIdPerUser[_address]);
	}

	function isOwner(address _address, bytes32 _kekId) public view returns (bool) {
		bool _isOwner = false;
		for (uint256 i; i < kekIdPerUser[_address].length; i++) {
			if (kekIdPerUser[_address][i] == _kekId) {
				_isOwner = true;
			}
		}
		return (_isOwner);
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
