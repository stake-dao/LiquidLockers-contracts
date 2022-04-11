pragma solidity 0.8.7;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./BaseStrategy.sol";
import "../accumulator/AngleAccumulator.sol";
import '../interfaces/ILiquidityGauge.sol';
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
	function deposit(
		address _gauge,
		address _token,
		uint256 _amount
	) public override onlyGovernance {
		IERC20(_token).safeTransfer(address(locker), _amount);

		locker.execute(_token, 0, abi.encodeWithSignature("approve(address,uint256)", _gauge, 0));
		locker.execute(_token, 0, abi.encodeWithSignature("approve(address,uint256)", _gauge, _amount));

		(bool success, ) = locker.execute(_gauge, 0, abi.encodeWithSignature("deposit(uint256)", _amount));
		require(success, "Deposit failed!");
		emit Deposited(_gauge, _token, _amount);
	}

	function depositAll(address _gauge, address _token) external override onlyGovernance {
		deposit(_gauge, _token, IERC20(_token).balanceOf(address(this)));
	}

	function withdraw(
		address _gauge,
		address _token,
		uint256 _amount
	) public override onlyGovernance {
		uint256 _before = IERC20(_token).balanceOf(address(locker));

		(bool success, ) = locker.execute(_gauge, 0, abi.encodeWithSignature("withdraw(uint256)", _amount));
		require(success, "Transfer failed!");
		uint256 _after = IERC20(_token).balanceOf(address(locker));

		uint256 _net = _after - _before;
		(success, ) = locker.execute(_token, 0, abi.encodeWithSignature("transfer(address,uint256)", msg.sender, _net));
		require(success, "Transfer failed!");
		emit Withdrawn(_gauge, _token, _amount);
	}

	function withdrawAll(address _gauge, address _token) external override onlyGovernance {
		withdraw(_gauge, _token, ILiquidityGauge(_gauge).balanceOf(address(locker)));
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

	function boost(address _gauge, address _user) external override {
		(bool success, ) = locker.execute(_gauge, 0, abi.encodeWithSignature("user_checkpoint(address)", _user));
		require(success, "Boost failed!");
		emit Boosted(_gauge, _user);
	}

	function set_rewards_receiver(address _gauge, address _receiver) external override onlyGovernance {
		(bool success, ) = locker.execute(_gauge, 0, abi.encodeWithSignature("set_rewards_receiver(address)", _receiver));
		require(success, "Set rewards receiver failed!");
		emit RewardReceiverSet(_gauge, _receiver);
	}
}
