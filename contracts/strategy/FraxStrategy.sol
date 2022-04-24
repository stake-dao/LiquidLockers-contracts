// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./BaseStrategy.sol";
import "../accumulator/FxsAccumulator.sol";
import "../interfaces/ILiquidityGaugeFRAX.sol";
import "../interfaces/IMultiRewards.sol";

contract FraxStrategy is BaseStrategy {
	using SafeERC20 for IERC20;
	FxsAccumulator public accumulator;
	struct ClaimerReward {
		address rewardToken;
		uint256 amount;
	}
	enum MANAGEFEE {
		PERFFEE,
		VESDTFEE,
		ACCUMULATORFEE,
		CLAIMERREWARD
	}

	/* ========== CONSTRUCTOR ========== */
	constructor(
		ILocker _locker,
		address _governance,
		address _receiver,
		FxsAccumulator _accumulator
	) BaseStrategy(_locker, _governance, _receiver) {
		veSDTFee = 500; // %5
		accumulatorFee = 800; // %8
		claimerReward = 50; //%0.5
		accumulator = _accumulator;
	}

	function deposit(
		address _token,
		uint256 _amount,
		uint256 _sec
	) public onlyApprovedVault {
		address gauge = gauges[_token];
		require(gauge != address(0), "!gauge");
		locker.execute(_token, 0, abi.encodeWithSignature("approve(address,uint256)", gauge, 0));
		locker.execute(_token, 0, abi.encodeWithSignature("approve(address,uint256)", gauge, _amount));

		(bool success, ) = locker.execute(gauge, 0, abi.encodeWithSignature("stakeLocked(uint256,uint256)", _amount, _sec));
		require(success, "Deposit failed!");
		emit Deposited(gauge, _token, _amount);
	}

	function withdraw(address _token, bytes32 _kekid) public onlyApprovedVault {
		uint256 _before = IERC20(_token).balanceOf(address(locker));
		address gauge = gauges[_token];
		require(gauge != address(0), "!gauge");
		(bool success, ) = locker.execute(
			gauge,
			0,
			abi.encodeWithSignature("withdrawLocked(bytes32, address)", _kekid, msg.sender)
		);
		// Maybe multiple strategy for FRAX, depending of the signature function for the withdrawLocked
		require(success, "Withdraw failed!");
		uint256 _after = IERC20(_token).balanceOf(address(locker));

		uint256 _net = _after - _before;
		(success, ) = locker.execute(_token, 0, abi.encodeWithSignature("transfer(address,uint256)", msg.sender, _net));
		require(success, "Transfer failed!");
		emit Withdrawn(gauge, _token, 0);
		// Maybe modify the event to show the kekid withdrawn?
	}

	function sendToAccumulator(address _token, uint256 _amount) external onlyGovernance {
		IERC20(_token).approve(address(accumulator), _amount);
		accumulator.depositToken(_token, _amount);
	}

	function claim(address _token) external override {
		address gauge = gauges[_token];
		require(gauge != address(0), "!gauge");
		(bool success, ) = locker.execute(gauge, 0, abi.encodeWithSignature("getReward(address)", address(this)));
		require(success, "getReward failed");
		for (uint8 i = 0; i < 8; i++) {
			address rewardToken = ILiquidityGaugeFRAX(gauge).getAllRewardTokens()[i];
			if (rewardToken == address(0)) {
				break;
			}
			uint256 rewardsBalance = IERC20(rewardToken).balanceOf(address(this));
			if (rewardsBalance == 0) {
				break;
			}
			// Maybe this could be good the check if the amount is > 0 ?
			uint256 multisigFee = (rewardsBalance * perfFee[gauge]) / BASE_FEE;
			uint256 accumulatorPart = (rewardsBalance * accumulatorFee) / BASE_FEE;
			uint256 veSDTPart = (rewardsBalance * veSDTFee) / BASE_FEE;
			uint256 claimerPart = (rewardsBalance * claimerReward) / BASE_FEE;
			IERC20(rewardToken).approve(address(accumulator), accumulatorPart);
			accumulator.depositToken(rewardToken, accumulatorPart);
			IERC20(rewardToken).transfer(rewardsReceiver, multisigFee);
			IERC20(rewardToken).transfer(veSDTFeeProxy, veSDTPart);
			IERC20(rewardToken).transfer(msg.sender, claimerPart);
			uint256 netRewards = rewardsBalance - multisigFee - accumulatorPart - veSDTPart - claimerPart;
			IERC20(rewardToken).approve(multiGauges[gauge], netRewards);
			IMultiRewards(multiGauges[gauge]).notifyRewardAmount(rewardToken, netRewards);
			emit Claimed(gauge, rewardToken, rewardsBalance);
		}
	}

	function claimerPendingReward(address _token) external view returns (ClaimerReward[] memory) {
		ClaimerReward[] memory pendings = new ClaimerReward[](8);
		address gauge = gauges[_token];
		for (uint8 i; i < 8; i++) {
			address rewardToken = ILiquidityGaugeFRAX(gauge).getAllRewardTokens()[i];
			if (rewardToken == address(0)) {
				break;
			}
			uint256 rewardsBalance = ILiquidityGaugeFRAX(gauge).earned(address(locker))[i];
			uint256 pendingAmount = (rewardsBalance * claimerReward) / BASE_FEE;
			ClaimerReward memory pendingReward = ClaimerReward(rewardToken, pendingAmount);
			pendings[i] = pendingReward;
		}
		return pendings;
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

	function setVeSDTProxy(address _newVeSDTProxy) external onlyGovernance {
		veSDTFeeProxy = _newVeSDTProxy;
	}

	function setAccumulator(address _newAccumulator) external onlyGovernance {
		accumulator = FxsAccumulator(_newAccumulator);
	}

	function setRewardsReceiver(address _newRewardsReceiver) external onlyGovernance {
		rewardsReceiver = _newRewardsReceiver;
	}

	function manageFee(
		MANAGEFEE _manageFee,
		address _gauge,
		uint256 _newFee
	) external onlyGovernance {
		if (_manageFee == MANAGEFEE.PERFFEE) {
			// 0
			require(_gauge != address(0), "zero address");
			perfFee[_gauge] = _newFee;
		} else if (_manageFee == MANAGEFEE.VESDTFEE) {
			// 1
			veSDTFee = _newFee;
		} else if (_manageFee == MANAGEFEE.ACCUMULATORFEE) {
			//2
			accumulatorFee = _newFee;
		} else if (_manageFee == MANAGEFEE.CLAIMERREWARD) {
			// 3
			claimerReward = _newFee;
		}
	}
}
