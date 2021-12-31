// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./interfaces/IMasterchef.sol";
import "./MasterGaugeProxy.sol";
import "./interfaces/IGaugeMultiRewards.sol";

// Original: https://github.com/pickle-finance/protocol/blob/master/src/dill/gauge-proxy.sol
// Diff: https://diffnow.com/report/iuqjz
contract GaugeProxy {
	using SafeMath for uint256;
	using SafeERC20 for IERC20;

	/* ========== STATE VARIABLES ========== */

	IERC20 public immutable masterToken;
	IMasterchef public masterchef;
	IERC20 public SDT;
	IERC20 public veSDT;

	address public governance;
	uint256 public pid;
	uint256 public totalWeight;

	address[] internal _tokens;
	mapping(address => address) public gauges; // token => gauge
	mapping(address => uint256) public weights; // token => weight
	mapping(address => mapping(address => uint256)) public votes; // msg.sender => votes
	mapping(address => address[]) public tokenVote; // msg.sender => token
	mapping(address => uint256) public usedWeights; // msg.sender => total voting weight of user

	/* ========== EVENTS ========== */
	event GaugeAdded(address token, address gauge);
	event GovernanceSet(address indexed _governance);
	/* ========== VIEWS ========== */
	function tokens() external view returns (address[] memory) {
		return _tokens;
	}

	function getGauge(address _token) external view returns (address) {
		return gauges[_token];
	}
	
	/* ========== CONSTRUCTOR ========== */
	constructor(
		address _masterchef,
		address _SDT,
		address _veSDT
	) public {
		masterToken = IERC20(address(new MasterGaugeProxy()));
		masterchef = IMasterchef(_masterchef);
		SDT = IERC20(_SDT);
		veSDT = IERC20(_veSDT);
		governance = msg.sender;
	}

	/* ========== MUTATIVE FUNCTIONS ========== */
	function setGovernance(address _governance) public {
		require(msg.sender == governance, "!governance");
		governance = _governance;

		emit GovernanceSet(_governance);
	}

	// Reset votes to 0
	function reset() external {
		_reset(msg.sender);
	}

	// Reset votes to 0
	function _reset(address _owner) internal {
		address[] storage _tokenVote = tokenVote[_owner];
		uint256 _tokenVoteCnt = _tokenVote.length;

		for (uint256 i = 0; i < _tokenVoteCnt; i++) {
			address _token = _tokenVote[i];
			uint256 _votes = votes[_owner][_token];

			if (_votes > 0) {
				totalWeight = totalWeight.sub(_votes);
				weights[_token] = weights[_token].sub(_votes);

				votes[_owner][_token] = 0;
			}
		}

		delete tokenVote[_owner];
	}

	// Adjusts _owner's votes according to latest _owner's veSDT balance
	function poke(address _owner) public {
		address[] memory _tokenVote = tokenVote[_owner];
		uint256 _tokenCnt = _tokenVote.length;
		uint256[] memory _weights = new uint256[](_tokenCnt);

		uint256 _prevUsedWeight = usedWeights[_owner];
		uint256 _weight = veSDT.balanceOf(_owner);

		for (uint256 i = 0; i < _tokenCnt; i++) {
			uint256 _prevWeight = votes[_owner][_tokenVote[i]];
			_weights[i] = _prevWeight.mul(_weight).div(_prevUsedWeight);
		}

		_vote(_owner, _tokenVote, _weights);
	}

	/// @notice Vote for the gauges added in the proxy
	/// @param _owner The address of the user casting the vote
	/// @param _tokenVote Address of the token to vote for
	/// @param _weights Weight of the vote
	function _vote(
		address _owner,
		address[] memory _tokenVote,
		uint256[] memory _weights
	) internal {
		// _weights[i] = percentage * 100
		_reset(_owner);
		uint256 _tokenCnt = _tokenVote.length;
		uint256 _weight = veSDT.balanceOf(_owner);
		uint256 _totalVoteWeight = 0;
		uint256 _usedWeight = 0;

		for (uint256 i = 0; i < _tokenCnt; i++) {
			_totalVoteWeight = _totalVoteWeight.add(_weights[i]);
		}

		for (uint256 i = 0; i < _tokenCnt; i++) {
			address _token = _tokenVote[i];
			address _gauge = gauges[_token];
			uint256 _tokenWeight = _weights[i].mul(_weight).div(_totalVoteWeight);

			if (_gauge != address(0x0)) {
				_usedWeight = _usedWeight.add(_tokenWeight);
				totalWeight = totalWeight.add(_tokenWeight);
				weights[_token] = weights[_token].add(_tokenWeight);
				tokenVote[_owner].push(_token);
				votes[_owner][_token] = _tokenWeight;
			}
		}

		usedWeights[_owner] = _usedWeight;
	}

	// Vote with veSDT on a gauge
	function vote(address[] calldata _tokenVote, uint256[] calldata _weights) external {
		require(_tokenVote.length == _weights.length);
		_vote(msg.sender, _tokenVote, _weights);
	}

	// Add new token gauge
	function addGauge(address _token, address _gauge) external {
		require(msg.sender == governance, "!gov");
		require(gauges[_token] == address(0x0), "exists");
		gauges[_token] = _gauge;
		_tokens.push(_token);

		emit GaugeAdded(_token, _gauge);
	}

	/// @notice Deposit master token for a pool into the masterchef
	/// @param _pid Pool ID in which to deposit the masterToken
	function deposit(uint256 _pid) public {
		require(msg.sender == governance, "!gov");

		IERC20 _token = masterToken;
		uint256 _balance = _token.balanceOf(address(this));
		_token.safeApprove(address(masterchef), 0);
		_token.safeApprove(address(masterchef), _balance);
		masterchef.deposit(_pid, _balance);
		pid = _pid;
	}

	/// @notice Distribute the SDT rewards to the gauges based on their weights
	function distribute() external {
		masterchef.deposit(pid, 0);

		uint256 _balance = SDT.balanceOf(address(this));
		if (_balance > 0 && totalWeight > 0) {
			for (uint256 i = 0; i < _tokens.length; i++) {
				address _token = _tokens[i];
				address _gauge = gauges[_token];
				uint256 _reward = _balance.mul(weights[_token]).div(totalWeight);
				if (_reward > 0) {
					SDT.safeApprove(_gauge, 0);
					SDT.safeApprove(_gauge, _reward);
					IGaugeMultiRewards(_gauge).notifyRewardAmount(address(SDT), _reward);
				}
			}
		}
	}
}
