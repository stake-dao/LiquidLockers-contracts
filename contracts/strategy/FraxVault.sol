//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/ILiquidityGaugeStrat.sol";
import "./FraxStrategy.sol";

contract FraxVault is ERC20Upgradeable {
	using SafeERC20Upgradeable for ERC20Upgradeable;
	using AddressUpgradeable for address;

	struct LockInformations {
		address owner;
		uint256 amount;
		uint256 shares;
		uint256 start;
		uint256 duration;
	}

	IERC20 public token;
	address public governance;
	uint256 public withdrawalFee;
	address public liquidityGauge;
	uint256 public accumulatedFee;
	address public locker = 0xCd3a267DE09196C48bbB1d9e842D7D7645cE448f;
	FraxStrategy public fraxStrategy;

	mapping(address => bytes32[]) public kekIdPerUser;
	mapping(bytes32 => LockInformations) public infosPerKekId;
	mapping(address => uint256) public liveDepositCounter; 
	

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
		fraxStrategy = _fraxStrategy;
	}

	function deposit(uint256 _amount, uint256 _sec) public {
		require(address(liquidityGauge) != address(0), "Gauge not yet initialized");

		token.transferFrom(msg.sender, address(this), _amount);
		token.approve(address(fraxStrategy), _amount);

		uint256 _sdAmount = (_amount * _sec) / (60 * 60 * 24 * 364);
		_mint(address(this), _sdAmount);
		
		ERC20Upgradeable(address(this)).approve(liquidityGauge, _sdAmount);
		ILiquidityGaugeStrat(liquidityGauge).deposit(_sdAmount, msg.sender);

		if (liveDepositCounter[msg.sender] == 0) {
			fraxStrategy.proxyToggleStaker(address(token), abi.encodeWithSignature("proxyToggleStaker(address)", msg.sender));
		}
		liveDepositCounter[msg.sender] ++ ;

		bytes32 _kekId = fraxStrategy.deposit(
			address(token),
			msg.sender,
			_amount,
			abi.encodeWithSignature("migrator_stakeLocked_for(address,uint256,uint256,uint256)", msg.sender, _amount, _sec, block.timestamp)
		);
		// Not needed for Frax Gauge V2
		// kekIdPerUser[msg.sender].push(_kekId);
		// infosPerKekId[_kekId] = LockInformations(msg.sender, _amount, _sdAmount, block.timestamp, _sec);

		emit Deposit(msg.sender, _amount);
	}

	
	function withdraw(bytes32 _kekId) public {
		//require(infosPerKekId[_kekId].owner == msg.sender, "not owner of this kekid");
		//LockInformations memory _infos = infosPerKekId[_kekId];

		/* Shares calculation */
		uint256 _shares = ILiquidityGaugeStrat(liquidityGauge).balanceOf(msg.sender);//_infos.shares;
		uint256 userTotalShares = ILiquidityGaugeStrat(liquidityGauge).balanceOf(msg.sender);
		require(_shares <= userTotalShares, "Not enough staked");

		/* Liquidity Gauge Strat */
		ILiquidityGaugeStrat(liquidityGauge).withdraw(_shares, msg.sender, true);
		_burn(address(this), _shares);

		/* Update kekId mapping */
		//resetLockedInfos(_kekId);
		//remove(getIndexKekId(msg.sender, _kekId), msg.sender);

		liveDepositCounter[msg.sender]--;
		if(liveDepositCounter[msg.sender] == 0){
			fraxStrategy.proxyToggleStaker(address(token), abi.encodeWithSignature("proxyToggleStaker(address)", msg.sender));
		}

		/* Withdraw from Frax gauge */
		uint256 _before = token.balanceOf(address(this));
		fraxStrategy.withdraw(address(token), abi.encodeWithSignature("migrator_withdraw_locked(address,bytes32)", msg.sender, _kekId));
		uint256 _net = token.balanceOf(address(this)) - _before;
		uint256 _withdrawFee = (_net * withdrawalFee) / 10000;

		/* Transfer */
		token.transfer(governance, _withdrawFee);
		token.transfer(msg.sender, _net - _withdrawFee);
		emit Withdraw(msg.sender, _net - _withdrawFee);
	}

	function getLockedInformations(bytes32 _kekId) public view returns (LockInformations memory) {
		return (infosPerKekId[_kekId]);
	}

	function getKekIdUser(address _address) public view returns (bytes32[] memory) {
		return (kekIdPerUser[_address]);
	}

	function getIndexKekId(address _address, bytes32 _kekId) public view returns (uint256) {
		uint256 _position;
		bytes32[] memory arr = kekIdPerUser[_address];
		for (uint256 i; i < arr.length; i++) {
			if (arr[i] == _kekId) {
				_position = i;
				break;
			}
		}
		return (_position);
	}

	function remove(uint256 _index, address _address) private {
		kekIdPerUser[_address][_index] = kekIdPerUser[_address][kekIdPerUser[_address].length - 1];
		kekIdPerUser[_address].pop();
	}

	function resetLockedInfos(bytes32 _kekId) private {
		require(infosPerKekId[_kekId].owner != address(0), "LockedInfos not exist");
		infosPerKekId[_kekId] = LockInformations(address(0), 0, 0, 0, 0);
	}

	function setGovernance(address _governance) external {
		require(msg.sender == governance, "!governance");
		governance = _governance;
	}

	function setLiquidityGauge(address _liquidityGauge) external {
		require(msg.sender == governance, "!governance");
		liquidityGauge = _liquidityGauge;
	}

	function setAngleStrategy(FraxStrategy _newStrat) external {
		require(msg.sender == governance, "!governance");
		fraxStrategy = _newStrat;
	}

	function decimals() public pure override returns (uint8) {
		return 18;
	}

	function setWithdrawnFee(uint256 _newFee) external {
		require(msg.sender == governance, "!governance");
		withdrawalFee = _newFee;
	}
}
