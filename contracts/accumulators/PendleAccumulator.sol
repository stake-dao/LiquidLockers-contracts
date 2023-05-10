// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import {PendleLocker} from "../lockers/PendleLocker.sol";
import "../interfaces/ILiquidityGauge.sol";
import {ISDTDistributor} from "../interfaces/ISDTDistributor.sol";
import "openzeppelin-contracts/token/ERC20/IERC20.sol";

interface IWeth {
    function deposit() external payable;
}

/// @title A contract that accumulates PENDLE rewards and notifies them to the LGV4
/// @author StakeDAO
contract PendleAccumulator {
    error FEE_TOO_HIGH();
    error NOT_ALLOWED();
    error ZERO_ADDRESS();
    error WRONG_CLAI();
    error NO_REWARD();

    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public bribeRecipient;
    address public daoRecipient;
    address public veSdtFeeProxy;
    address public votesRewardRecipient;
    uint256 public bribeFee;
    uint256 public daoFee;
    uint256 public veSdtFeeProxyFee;
    address public vePendle = 0x4f30A9D41B80ecC5B94306AB4364951AE3170210;
    address public governance;
    address public locker;
    address public gauge;
    address public sdtDistributor;
    uint256 public claimerFee;
    mapping (uint256 => uint256) rewards; // period -> reward amount

    event DaoRecipientSet(address _old, address _new);
    event BribeRecipientSet(address _old, address _new);
    event VeSdtFeeProxySet(address _old, address _new);
    event DaoFeeSet(uint256 _old, uint256 _new);
    event BribeFeeSet(uint256 _old, uint256 _new);
    event VeSdtFeeProxyFeeSet(uint256 _old, uint256 _new);
    event LockerSet(address oldLocker, address newLocker);
    event GovernanceSet(address oldGov, address newGov);
    event SdtDistributorUpdated(address oldDistributor, address newDistributor);
    event GaugeSet(address oldGauge, address newGauge);
    event ERC20Rescued(address token, uint256 amount);
    event RewardNotified(address gauge, address tokenReward, uint256 amountNotified, uint256 claimerFee);


    /* ========== CONSTRUCTOR ========== */
    constructor(
        address _locker,
        address _gauge,
        address _daoRecipient,
        address _bribeRecipient,
        address _veSdtFeeProxy
    ) {
        locker = _locker;
        gauge = _gauge;
        daoRecipient = _daoRecipient;
        bribeRecipient = _bribeRecipient;
        veSdtFeeProxy = _veSdtFeeProxy;
        daoFee = 500; // 5%
        bribeFee = 1000; // 10%
    }

    /* ========== MUTATIVE FUNCTIONS ========== */
    /// @notice Claims rewards from the locker and notify all to the LGV4
    function claimAndNotifyAll() external {
        //if (locker == address(0)) revert ZERO_ADDRESS();
        //if (gauge == address(0)), revert GAUGE_NOT_SET();
        // reward for 1 months
        address[] memory pools = new address[](1);
        pools[0] = vePendle;
        PendleLocker(locker).claimRewards(address(this), pools);
        if (address(this).balance == 0) revert NO_REWARD();
        // Wrap Eth to WETH
        IWeth(WETH).deposit{value: address(this).balance}();
        // split the reward in 4 weekly period
        // charge fees once from the whole month reward
        uint256 gaugeAmount = _chargeFee(WETH, address(this).balance);
        uint256 weekAmount = gaugeAmount / 4;
        uint256 currentPeriod = block.timestamp / 1 weeks * 1 weeks;
        rewards[currentPeriod + 1 weeks] = weekAmount;
        rewards[currentPeriod + (2 weeks)] = weekAmount;
        rewards[currentPeriod + (3 weeks)] = weekAmount;
        _notifyReward(WETH, weekAmount);
        _distributeSDT();
    }

    /// @notice Claims rewards for the voters and send to a recipient
    function claimForVoters(address[] calldata pools) external {
        if (locker == address(0)) revert ZERO_ADDRESS();
        for (uint256 i; i < pools.length;) {
            if (pools[i] == vePendle) revert WRONG_CLAI();
            unchecked {
                ++i;
            }
        }
        PendleLocker(locker).claimRewards(address(this), pools);
        if (address(this).balance == 0) revert NO_REWARD();
        // Wrap Eth to WETH
        IWeth(WETH).deposit{value: address(this).balance}();
        uint256 votesAmount = _chargeFee(WETH, address(this).balance);
        IERC20(WETH).transfer(votesRewardRecipient, votesAmount);
        _distributeSDT();
    }

    /// @notice Notify the reward already claimed for the current period
    function notifyReward() external {
        uint256 currentPeriod = block.timestamp / 1 weeks * 1 weeks;
        if (rewards[currentPeriod] == 0) revert NO_REWARD();
        _notifyReward(WETH, rewards[currentPeriod]);
        _distributeSDT();
        rewards[currentPeriod] = 0;
    }

    /// @notice Reserve fees for dao, bribe and veSdtFeeProxy
    /// @param _amount amount to charge fees
    function _chargeFee(
        address _token,
        uint256 _amount
    ) internal returns (uint256) {
        uint256 gaugeAmount = _amount;
        // dao part
        if (daoFee > 0) {
            uint256 daoAmount = (_amount * daoFee) / 10_000;
            IERC20(_token).transfer(daoRecipient, daoAmount);
            gaugeAmount -= daoAmount;
        }

        // bribe part
        if (bribeFee > 0) {
            uint256 bribeAmount = (_amount * bribeFee) / 10_000;
            IERC20(_token).transfer(bribeRecipient, bribeAmount);
            gaugeAmount -= bribeAmount;
        }

        // veSDTFeeProxy part
        if (veSdtFeeProxyFee > 0) {
            uint veSdtFeeProxyAmount = (_amount * veSdtFeeProxyFee) / 10_000;
            IERC20(_token).transfer(veSdtFeeProxy, veSdtFeeProxyAmount);
            gaugeAmount -= veSdtFeeProxyAmount;
        }
        return gaugeAmount;
    }

    /// @notice Distribute SDT if there is any 
    function _distributeSDT() internal {
        if (sdtDistributor != address(0)) {
            ISDTDistributor(sdtDistributor).distribute(gauge);
        }
    }

    /// @notice Notify the new reward to the LGV4
    /// @param _tokenReward token to notify
    /// @param _amount amount to notify
    function _notifyReward(address _tokenReward, uint256 _amount) internal {
        
        if (_amount == 0) {
            return;
        }
        uint256 balanceBefore = IERC20(_tokenReward).balanceOf(address(this));
        if (ILiquidityGauge(gauge).reward_data(_tokenReward).distributor == address(this)) {
            uint256 claimerReward = (_amount * claimerFee) / 10_000;
            IERC20(_tokenReward).transfer(msg.sender, claimerReward);
            _amount -= claimerReward;
            IERC20(_tokenReward).approve(gauge, _amount);
            ILiquidityGauge(gauge).deposit_reward_token(_tokenReward, _amount);

            uint256 balanceAfter = IERC20(_tokenReward).balanceOf(address(this));

            require(balanceBefore - balanceAfter == _amount + claimerReward, "wrong amount notified");

            emit RewardNotified(gauge, _tokenReward, _amount, claimerReward);
        }
    }

    /// @notice Set DAO recipient
    /// @param _daoRecipient recipient address
    function setDaoRecipient(address _daoRecipient) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        if (_daoRecipient == address(0)) revert ZERO_ADDRESS();
        emit DaoRecipientSet(daoRecipient, _daoRecipient);
        daoRecipient = _daoRecipient;
    }

    /// @notice Set Bribe recipient
    /// @param _bribeRecipient recipient address
    function setBribeRecipient(address _bribeRecipient) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        if (_bribeRecipient == address(0)) revert ZERO_ADDRESS();
        emit BribeRecipientSet(bribeRecipient, _bribeRecipient);
        bribeRecipient = _bribeRecipient;
    }

    /// @notice Set VeSdtFeeProxy
    /// @param _veSdtFeeProxy proxy address
    function setVeSdtFeeProxy(address _veSdtFeeProxy) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        if (_veSdtFeeProxy == address(0)) revert ZERO_ADDRESS();
        emit VeSdtFeeProxySet(veSdtFeeProxy, _veSdtFeeProxy);
        veSdtFeeProxy = _veSdtFeeProxy;
    }

    /// @notice Set fees reserved to the DAO at every claim
    /// @param _daoFee fee (100 = 1%)
    function setDaoFee(uint256 _daoFee) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        if (_daoFee > 10_000 || _daoFee + bribeFee + veSdtFeeProxyFee > 10_000)
            revert FEE_TOO_HIGH();
        emit DaoFeeSet(daoFee, _daoFee);
        daoFee = _daoFee;
    }

    /// @notice Set fees reserved to bribes at every claim
    /// @param _bribeFee fee (100 = 1%)
    function setBribeFee(uint256 _bribeFee) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        if (
            _bribeFee > 10_000 || _bribeFee + daoFee + veSdtFeeProxyFee > 10_000
        ) revert FEE_TOO_HIGH();
        emit BribeFeeSet(bribeFee, _bribeFee);
        bribeFee = _bribeFee;
    }

    /// @notice Set fees reserved to bribes at every claim
    /// @param _veSdtFeeProxyFee fee (100 = 1%)
    function setVeSdtFeeProxyFee(uint256 _veSdtFeeProxyFee) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        if (
            _veSdtFeeProxyFee > 10_000 ||
            _veSdtFeeProxyFee + daoFee + bribeFee > 10_000
        ) revert FEE_TOO_HIGH();
        emit VeSdtFeeProxyFeeSet(veSdtFeeProxyFee, _veSdtFeeProxyFee);
        veSdtFeeProxyFee = _veSdtFeeProxyFee;
    }

    /// @notice Sets gauge for the accumulator which will receive and distribute the rewards
    /// @dev Can be called only by the governance
    /// @param _gauge gauge address
    function setGauge(address _gauge) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        if (_gauge == address(0)) revert ZERO_ADDRESS();
        emit GaugeSet(gauge, _gauge);
        gauge = _gauge;
    }

    /// @notice Sets SdtDistributor to distribute from the Accumulator SDT Rewards to Gauge.
    /// @dev Can be called only by the governance
    /// @param _sdtDistributor gauge address
    function setSdtDistributor(address _sdtDistributor) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        if (_sdtDistributor == address(0)) revert ZERO_ADDRESS();

        emit SdtDistributorUpdated(sdtDistributor, _sdtDistributor);
        sdtDistributor = _sdtDistributor;
    }

    /// @notice Allows the governance to set the new governance
    /// @dev Can be called only by the governance
    /// @param _governance governance address
    function setGovernance(address _governance) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        if (_governance == address(0)) revert ZERO_ADDRESS();
        emit GovernanceSet(governance, _governance);
        governance = _governance;
    }

    /// @notice Allows the governance to set the locker
    /// @dev Can be called only by the governance
    /// @param _locker locker address
    function setLocker(address _locker) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        if (_locker != address(0)) revert ZERO_ADDRESS();
        emit LockerSet(locker, _locker);
        locker = _locker;
    }

    /// @notice Allows the governance to set the claimer fee
    /// @dev Can be called only by the governance
    /// @param _claimerFee claimer fee 
    function setClaimerFee(uint256 _claimerFee) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        if (_claimerFee > 10_000) revert FEE_TOO_HIGH();
        claimerFee = _claimerFee;
    }

    /// @notice A function that rescue any ERC20 token
    /// @param _token token address
    /// @param _amount amount to rescue
    /// @param _recipient address to send token rescued
    function rescueERC20(address _token, uint256 _amount, address _recipient) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        if (_recipient == address(0)) revert ZERO_ADDRESS();
        IERC20(_token).transfer(_recipient, _amount);
        emit ERC20Rescued(_token, _amount);
    }

    receive() payable external {}
}
