// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./BaseStrategy.sol";
import "../accumulator/AngleAccumulator.sol";
import "../interfaces/ILiquidityGauge.sol";

contract AngleStrategy is BaseStrategy {
	using SafeERC20 for IERC20;
	AngleAccumulator public accumulator;

	/* ========== CONSTRUCTOR ========== */
	constructor(
		ILocker _locker,
		address _governance,
		address _receiver
	) BaseStrategy(_locker, _governance, _receiver) {}

	/* ========== MUTATIVE FUNCTIONS ========== */
	function deposit(address _token, uint256 _amount) public override onlyApprovedVault {
		IERC20(_token).safeTransfer(address(locker), _amount);
		address gauge = gauges[_token];
		require(gauge != address(0), "!gauge");
		locker.execute(_token, 0, abi.encodeWithSignature("approve(address,uint256)", gauge, 0));
		locker.execute(_token, 0, abi.encodeWithSignature("approve(address,uint256)", gauge, _amount));

		(bool success, ) = locker.execute(gauge, 0, abi.encodeWithSignature("deposit(uint256)", _amount));
		require(success, "Deposit failed!");
		emit Deposited(gauge, _token, _amount);
	}

	function depositAll(address _token) external override onlyGovernance {
		deposit(_token, IERC20(_token).balanceOf(address(this)));
	}

	function withdraw(address _token, uint256 _amount) public override onlyApprovedVault {
		uint256 _before = IERC20(_token).balanceOf(address(locker));
		address gauge = gauges[_token];
		(bool success, ) = locker.execute(gauge, 0, abi.encodeWithSignature("withdraw(uint256)", _amount));
		require(success, "Transfer failed!");
		uint256 _after = IERC20(_token).balanceOf(address(locker));

		uint256 _net = _after - _before;
		(success, ) = locker.execute(_token, 0, abi.encodeWithSignature("transfer(address,uint256)", msg.sender, _net));
		require(success, "Transfer failed!");
		emit Withdrawn(gauge, _token, _amount);
	}

	function withdrawAll(address _token) external override onlyGovernance {
		address gauge = gauges[_token];
		withdraw(_token, ILiquidityGauge(gauge).balanceOf(address(locker)));
	}

	function sendToAccumulator(address _token, uint256 _amount) external onlyGovernance {
		IERC20(_token).approve(address(accumulator), _amount);
		accumulator.depositToken(_token, _amount);
	}

	function claim(address _gauge) external override {
		(bool success, ) = locker.execute(
			_gauge,
			0,
			abi.encodeWithSignature("claim_rewards(address,address)", address(locker), rewardsReceiver)
		);
		require(success, "Claim failed!");
		emit Claimed(_gauge);
	}

	function boost(address _gauge) external override onlyGovernance {
		(bool success, ) = locker.execute(_gauge, 0, abi.encodeWithSignature("user_checkpoint(address)", address(locker)));
		require(success, "Boost failed!");
		emit Boosted(_gauge, address(locker));
	}

	function set_rewards_receiver(address _gauge, address _receiver) external override onlyGovernance {
		(bool success, ) = locker.execute(_gauge, 0, abi.encodeWithSignature("set_rewards_receiver(address)", _receiver));
		require(success, "Set rewards receiver failed!");
		emit RewardReceiverSet(_gauge, _receiver);
	}

	function toggleVault(address _vault) external override onlyGovernance {
		vaults[_vault] = !vaults[_vault];
		emit VaultToggled(_vault, vaults[_vault]);
	}

	function setGauge(address _token, address _gauge) external override onlyGovernance {
		gauges[_token] = _gauge;
		emit GaugeSet(_gauge, _token);
	}
}
