pragma solidity 0.8.7;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./BaseStrategy.sol";

contract AngleStrategy is BaseStrategy {
	using SafeERC20 for IERC20;

	/* ========== EVENTS ========== */
	event Deposit(address _gauge, address _token, uint256 _amount);
	event Withdraw(address _gauge, address _token, uint256 _amount);

	/* ========== CONSTRUCTOR ========== */
	constructor(ILocker _locker, address _governance) BaseStrategy(_locker, _governance) {}

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
		emit Deposit(_gauge, _token, _amount);
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

		locker.execute(_gauge, 0, abi.encodeWithSignature("withdraw(uint256)", _amount));
		uint256 _after = IERC20(_token).balanceOf(address(locker));

		uint256 _net = _after - _before;
		(bool success, ) = locker.execute(
			_token,
			0,
			abi.encodeWithSignature("transfer(address,uint256)", msg.sender, _net)
		);
		require(success, "Deposit failed!");
		emit Withdraw(_gauge, _token, _amount);
	}

	function withdrawAll(address _gauge, address _token) external override onlyGovernance {
		withdraw(_gauge, _token, IERC20(_token).balanceOf(_gauge));
	}

	function sendToAccumulator(address to, uint256 amount) external {}
}
