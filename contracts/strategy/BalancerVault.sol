//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/ILiquidityGaugeStrat.sol";
import "./BalancerStrategy.sol";
import "../interfaces/BalancerVault/IBalancerVault.sol";
import "../interfaces/IBalancerPool.sol";

contract BalancerVault is ERC20Upgradeable {
	using SafeERC20Upgradeable for ERC20Upgradeable;
	using AddressUpgradeable for address;

	ERC20Upgradeable public token;
	address public governance;
	uint256 public withdrawalFee;
	uint256 public keeperFee;
	address public liquidityGauge;
	uint256 public accumulatedFee;
	bytes32 public poolId;
	address public constant BALANCER_VAULT = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;
	uint256 public min;
	uint256 public constant max = 10000;
	BalancerStrategy public balancerStrategy;
	event Earn(address _token, uint256 _amount);
	event Deposit(address _depositor, uint256 _amount);
	event Withdraw(address _depositor, uint256 _amount);

	function init(
		ERC20Upgradeable _token,
		address _governance,
		string memory name_,
		string memory symbol_,
		BalancerStrategy _balancerStrategy
	) public initializer {
		__ERC20_init(name_, symbol_);
		token = _token;
		governance = _governance;
		min = 10000;
		keeperFee = 10; // %0.1
		poolId = IBalancerPool(address(_token)).getPoolId();
		balancerStrategy = _balancerStrategy;
	}

	function deposit(
		address _staker,
		uint256 _amount,
		bool _earn,
		bool provideLiquidity,
		uint256[] calldata maxAmountsIn,
		uint256 _minAmount
	) public {
		require(address(liquidityGauge) != address(0), "Gauge not yet initialized");
		if (!provideLiquidity) {
			token.safeTransferFrom(msg.sender, address(this), _amount);
		} else {
			(IERC20[] memory tokens, , ) = IBalancerVault(BALANCER_VAULT).getPoolTokens(poolId);
			address[] memory assets = new address[](tokens.length);
			require(tokens.length == maxAmountsIn.length, "!length");
			for (uint256 i; i < tokens.length; i++) {
				tokens[i].transferFrom(msg.sender, address(this), maxAmountsIn[i]);
				tokens[i].approve(BALANCER_VAULT, maxAmountsIn[i]);
				assets[i] = address(tokens[i]);
			}
			IBalancerVault.JoinPoolRequest memory pr = IBalancerVault.JoinPoolRequest(
				assets,
				maxAmountsIn,
				abi.encode(1, maxAmountsIn, _minAmount),
				false
			);
			uint256 lpBalanceBefore = token.balanceOf(address(this));
			IBalancerVault(BALANCER_VAULT).joinPool(
				poolId, // poolId
				address(this),
				address(this),
				pr
			);
			uint256 lpBalanceAfter = token.balanceOf(address(this));
			_amount = lpBalanceAfter - lpBalanceBefore;
		}

		if (!_earn) {
			uint256 keeperCut = (_amount * keeperFee) / 10000;
			_amount -= keeperCut;
			accumulatedFee += keeperCut;
		} else {
			_amount += accumulatedFee;
			accumulatedFee = 0;
		}
		_mint(address(this), _amount);
		ERC20Upgradeable(address(this)).approve(liquidityGauge, _amount);
		ILiquidityGaugeStrat(liquidityGauge).deposit(_amount, _staker);
		if (_earn) {
			earn();
		}
		emit Deposit(_staker, _amount);
	}

	function withdraw(uint256 _shares) public {
		uint256 userTotalShares = ILiquidityGaugeStrat(liquidityGauge).balanceOf(msg.sender);
		require(_shares <= userTotalShares, "Not enough staked");
		ILiquidityGaugeStrat(liquidityGauge).withdraw(_shares, msg.sender, true);
		_burn(address(this), _shares);
		uint256 tokenBalance = token.balanceOf(address(this)) - accumulatedFee;
		uint256 withdrawFee;
		if (_shares > tokenBalance) {
			uint256 amountToWithdraw = _shares - tokenBalance;
			balancerStrategy.withdraw(address(token), amountToWithdraw);
			withdrawFee = (amountToWithdraw * withdrawalFee) / 10000;
			token.safeTransfer(governance, withdrawFee);
		}
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

	function setKeeperFee(uint256 _newFee) external {
		require(msg.sender == governance, "!governance");
		keeperFee = _newFee;
	}

	function setLiquidityGauge(address _liquidityGauge) external {
		require(msg.sender == governance, "!governance");
		liquidityGauge = _liquidityGauge;
	}

	function setBalancerStrategy(BalancerStrategy _newStrat) external {
		require(msg.sender == governance, "!governance");
		balancerStrategy = _newStrat;
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
		return ((token.balanceOf(address(this)) - accumulatedFee) * min) / max;
	}

	function earn() internal {
		uint256 tokenBalance = available();
		token.approve(address(balancerStrategy), 0);
		token.approve(address(balancerStrategy), tokenBalance);
		balancerStrategy.deposit(address(token), tokenBalance);
		emit Earn(address(token), tokenBalance);
	}
}
