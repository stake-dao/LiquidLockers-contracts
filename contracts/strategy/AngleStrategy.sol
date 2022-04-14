// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./BaseStrategy.sol";
import "../accumulator/AngleAccumulator.sol";
import "../interfaces/ILiquidityGauge.sol";
import "../interfaces/IMultiRewards.sol";

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

	function withdraw(address _token, uint256 _amount) public override onlyApprovedVault {
		uint256 _before = IERC20(_token).balanceOf(address(locker));
		address gauge = gauges[_token];
		require(gauge != address(0), "!gauge");
		(bool success, ) = locker.execute(gauge, 0, abi.encodeWithSignature("withdraw(uint256)", _amount));
		require(success, "Transfer failed!");
		uint256 _after = IERC20(_token).balanceOf(address(locker));

		uint256 _net = _after - _before;
		(success, ) = locker.execute(_token, 0, abi.encodeWithSignature("transfer(address,uint256)", msg.sender, _net));
		require(success, "Transfer failed!");
		emit Withdrawn(gauge, _token, _amount);
	}

	function sendToAccumulator(address _token, uint256 _amount) external onlyGovernance {
		IERC20(_token).approve(address(accumulator), _amount);
		accumulator.depositToken(_token, _amount);
	}

	function claim(address _token) external override {
		address gauge = gauges[_token];
		require(gauge != address(0), "!gauge");
		(bool success, ) = locker.execute(
			gauge,
			0,
			abi.encodeWithSignature("claim_rewards(address,address)", address(locker), address(this))
		);
		require(success, "Claim failed!");
		for (uint8 i = 0; i < 8; i++) {
			address rewardToken = ILiquidityGauge(gauge).reward_tokens(i);
			if (rewardToken == address(0)) {
				break;
			}
			uint256 rewardsBalance = IERC20(rewardToken).balanceOf(address(this));
			uint256 performanceFee = (rewardsBalance * perfFee[gauge]) / BASE_FEE;
			uint256 accumulatorPart = (performanceFee * 800) / BASE_FEE;
			IERC20(rewardToken).transfer(address(accumulator), accumulatorPart);
			IERC20(rewardToken).transfer(rewardsReceiver, performanceFee - accumulatorPart);
			IMultiRewards(multiGauges[gauge]).notifyRewardAmount(rewardToken, rewardsBalance - performanceFee);
			emit Claimed(gauge, rewardToken, rewardsBalance);
		}
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

	function setMultiGauge(address _gauge, address _multiGauge) external override onlyGovernance {
		multiGauges[_gauge] = _multiGauge;
	}

	function setPerfFee(address _gauge, uint256 _newFee) external override onlyGovernance {
		perfFee[_gauge] = _newFee;
	}
}
