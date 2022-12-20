// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "openzeppelin-contracts/token/ERC20/IERC20.sol";
import "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/ILiquidityGauge.sol";
import "../interfaces/ISDTDistributor.sol";

interface ILftLocker {
    function claimRewards(uint256[] calldata, address) external;
}

interface ISushiSwapRouter {
    function getAmountsOut(uint256, address[] memory) external returns (uint256[] memory);

    function swapExactTokensForTokens(uint256, uint256, address[] memory, address, uint256) external;
}

/// @title A contract that accumulates rewards and notifies them to the LGV4
/// @author StakeDAO
contract LftAccumulator {
    using SafeERC20 for IERC20;
    /* ========== STATE VARIABLES ========== */

    address public governance;
    address public locker;
    address public gauge;
    address public sdtDistributor;
    uint256 public claimerFee;
    uint256 public maxSlippage;
    address[] public tokensReward;
    mapping(uint256 => address[]) public swapPaths;

    address public constant SUSHI_ROUTER = 0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F;

    /* ========== EVENTS ========== */
    event SdtDistributorUpdated(address oldDistributor, address newDistributor);
    event GaugeSet(address oldGauge, address newGauge);
    event RewardNotified(address gauge, address tokenReward, uint256 amountNotified, uint256 claimerFee);
    event LockerSet(address oldLocker, address newLocker);
    event GovernanceSet(address oldGov, address newGov);
    event TokenDeposited(address token, uint256 amount);
    event ERC20Rescued(address token, uint256 amount);

    /* ========== CONSTRUCTOR ========== */
    constructor(address _gauge) {
        gauge = _gauge;
        governance = msg.sender;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */
    /// @notice Claims and notify rewards from the locker giving pids
    /// @param _pids lendflare pids to claim reward
    function claimAndNotify(uint256[] memory _pids) external {
        ILftLocker(locker).claimRewards(_pids, address(this));
        _swaps(_pids);
        notifyAll();
    }

    /// @notice swaps pids's token reward with a swap path stored
    /// @param _pids lendflare pids to swap the token received as reward
    function _swaps(uint256[] memory _pids) internal {
        uint256 pidsLength = _pids.length;
        for (uint256 i; i < pidsLength;) {
            address[] memory path = swapPaths[_pids[i]];
            if (path.length > 0) {
                uint256 amount = IERC20(path[0]).balanceOf(address(this));
                if (amount == 0) {
                    return;
                }
                IERC20(path[0]).safeIncreaseAllowance(SUSHI_ROUTER, amount);

                uint256[] memory amounts = ISushiSwapRouter(SUSHI_ROUTER).getAmountsOut(amount, path);
                uint256 minAmount = (amounts[path.length - 1] * (10_000 - maxSlippage)) / 10_000;

                ISushiSwapRouter(SUSHI_ROUTER).swapExactTokensForTokens(
                    amount, minAmount, path, address(this), block.timestamp + 1800
                );
            }
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Notifies tokens to the LGV4, they needs to be added before as reward
    function notifyAll() public {
        uint256 tokensLenght = tokensReward.length;
        for (uint256 i; i < tokensLenght;) {
            _notifyAllReward(tokensReward[i]);
            unchecked {
                ++i;
            }
        }
        _distributeSDT();
    }

    /// @notice Notify the new reward to the LGV4
    /// @param _tokenReward token to notify
    function _notifyAllReward(address _tokenReward) internal {
        require(gauge != address(0), "gauge not set");
        uint256 amount = IERC20(_tokenReward).balanceOf(address(this));
        if (amount == 0) {
            return;
        }
        if (ILiquidityGauge(gauge).reward_data(_tokenReward).distributor == address(this)) {
            uint256 claimerReward = (amount * claimerFee) / 10_000;
            IERC20(_tokenReward).transfer(msg.sender, claimerReward);
            uint256 amountToNotify = amount - claimerReward;
            IERC20(_tokenReward).approve(gauge, amountToNotify);
            ILiquidityGauge(gauge).deposit_reward_token(_tokenReward, amountToNotify);

            emit RewardNotified(gauge, _tokenReward, amountToNotify, claimerReward);
        }
    }

    /// @notice Internal function to distribute SDT to the gauge
    function _distributeSDT() internal {
        if (sdtDistributor != address(0)) {
            ISDTDistributor(sdtDistributor).distribute(gauge);
        }
    }

    /// @notice Deposit token into the accumulator
    /// @param _token token to deposit
    /// @param _amount amount to deposit
    function depositToken(address _token, uint256 _amount) external {
        require(_amount > 0, "set an amount > 0");
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        emit TokenDeposited(_token, _amount);
    }

    /// @notice Sets gauge for the accumulator which will receive and distribute the rewards
    /// @dev Can be called only by the governance
    /// @param _gauge gauge address
    function setGauge(address _gauge) external {
        require(msg.sender == governance, "!gov");
        require(_gauge != address(0), "can't be zero address");
        emit GaugeSet(gauge, _gauge);
        gauge = _gauge;
    }

    /// @notice Sets SdtDistributor to distribute from the Accumulator SDT Rewards to Gauge.
    /// @dev Can be called only by the governance
    /// @param _sdtDistributor gauge address
    function setSdtDistributor(address _sdtDistributor) external {
        require(msg.sender == governance, "!gov");
        require(_sdtDistributor != address(0), "can't be zero address");

        emit SdtDistributorUpdated(sdtDistributor, _sdtDistributor);
        sdtDistributor = _sdtDistributor;
    }

    /// @notice Allows the governance to set the new governance
    /// @dev Can be called only by the governance
    /// @param _governance governance address
    function setGovernance(address _governance) external {
        require(msg.sender == governance, "!gov");
        require(_governance != address(0), "can't be zero address");
        emit GovernanceSet(governance, _governance);
        governance = _governance;
    }

    /// @notice Allows the governance to set the locker
    /// @dev Can be called only by the governance
    /// @param _locker locker address
    function setLocker(address _locker) external {
        require(msg.sender == governance, "!gov");
        require(_locker != address(0), "can't be zero address");
        emit LockerSet(locker, _locker);
        locker = _locker;
    }

    /// @notice Allows the governance to set the claimer fee
    /// @dev Can be called only by the governance
    /// @param _claimerFee claimer fee (10000 is 100%)
    function setClaimerFee(uint256 _claimerFee) external {
        require(msg.sender == governance, "!gov");
        require(_claimerFee <= 10_000, ">100%");
        claimerFee = _claimerFee;
    }

    /// @notice Allows the governance to set the swap path for each pid
    /// @dev Can be called only by the governance
    /// @param _pid pid to set the swap path
    /// @param _swapPath swap path
    function setPidSwapPath(uint256 _pid, address[] memory _swapPath) external {
        require(msg.sender == governance, "!gov");
        swapPaths[_pid] = _swapPath;
    }

    /// @notice Allows the governance to set tokens to notify
    /// @dev Can be called only by the governance
    /// @param _tokens tokens to notify as rewards to the LGV4
    function setTokensToNotify(address[] memory _tokens) external {
        require(msg.sender == governance, "!gov");
        tokensReward = _tokens;
    }

    /// @notice A function that rescue any ERC20 token
    /// @param _token token address
    /// @param _amount amount to rescue
    /// @param _recipient address to send token rescued
    function rescueERC20(address _token, uint256 _amount, address _recipient) external {
        require(msg.sender == governance, "!gov");
        require(_amount > 0, "set an amount > 0");
        require(_recipient != address(0), "can't be zero address");
        IERC20(_token).safeTransfer(_recipient, _amount);
        emit ERC20Rescued(_token, _amount);
    }
}
