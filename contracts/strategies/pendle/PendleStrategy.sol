// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "openzeppelin-contracts/token/ERC20/IERC20.sol";
import "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import "../../interfaces/ILiquidityGauge.sol";
import "../../interfaces/IPendleMarket.sol";
import "../../interfaces/ILocker.sol";
import "../../sdtDistributor/SdtDistributorV2.sol";

contract PendleStrategy {
    using SafeERC20 for IERC20;

    ILocker public locker = ILocker(0xD8fa8dC5aDeC503AcC5e026a98F32Ca5C1Fa289A);
    address public governance;
    address public rewardsReceiver;
    address public veSDTFeeProxy;
    address public vaultGaugeFactory;
    uint256 public constant BASE_FEE = 10_000;
    mapping(address => address) public gauges;
    mapping(address => bool) public vaults;
    mapping(address => uint256) public perfFee;
    mapping(address => address) public multiGauges;
    mapping(address => uint256) public accumulatorFee; // gauge -> fee
    mapping(address => uint256) public claimerRewardFee; // gauge -> fee
    mapping(address => uint256) public veSDTFee; // gauge -> fee

    error CALL_FAILED();
    error FEE_TOO_HIGH();
    error NOT_ALLOWED();
    error WRONG_TRANSFER();
    error VAULT_NOT_APPROVED();
    error ZERO_ADDRESS();

    address public accumulator;
    address public sdtDistributor;
    address public pendle;

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

    event Claimed(address _token, uint256 _amount);
    event VaultToggled(address _vault, bool _newState);
    event Withdrawn(address _token, uint256 _amount);

    /* ========== CONSTRUCTOR ========== */
    constructor(
        address _governance,
        address _receiver,
        address _accumulator,
        address _veSDTFeeProxy,
        address _sdtDistributor
    ) {
        governance = _governance;
        rewardsReceiver = _receiver;
        accumulator = _accumulator;
        veSDTFeeProxy = _veSDTFeeProxy;
        sdtDistributor = _sdtDistributor;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */
    function withdraw(address _token, uint256 _amount) external {
        if (!vaults[msg.sender]) revert VAULT_NOT_APPROVED();
        uint256 _before = IERC20(_token).balanceOf(address(locker));
        (bool success,) = locker.execute(_token, 0, abi.encodeWithSignature("transfer(address,uint256)", msg.sender, _amount));
        uint256 _after = IERC20(_token).balanceOf(address(locker));
        if (_before - _after != _amount) revert WRONG_TRANSFER();
        if (!success) revert CALL_FAILED();
        emit Withdrawn(_token, _amount);
    }

    function claim(address _token) external {
        address[] memory rewardTokens = IPendleMarket(_token).getRewardTokens();
        uint256[] memory balancesBefore = new uint256[](rewardTokens.length);
        for (uint256 i; i < rewardTokens.length;) {
            balancesBefore[i] = IERC20(rewardTokens[i]).balanceOf(address(locker));
        }
        (bool success,) = locker.execute(address(locker), 0, abi.encodeWithSignature("redeemRewards(address)", _token));
        if (!success) revert CALL_FAILED();
        uint256 reward;
        for (uint8 i = 0; i < rewardTokens.length; i++) {
            reward = IERC20(rewardTokens[i]).balanceOf(address(this)) - balancesBefore[i];
            if (reward == 0) continue;
            uint256 multisigFee = (reward * perfFee[_token]) / BASE_FEE;
            uint256 accumulatorPart = (reward * accumulatorFee[_token]) / BASE_FEE;
            uint256 veSDTPart = (reward * veSDTFee[_token]) / BASE_FEE;
            uint256 claimerPart = (reward * claimerRewardFee[_token]) / BASE_FEE;
            IERC20(rewardTokens[i]).transfer(address(accumulator), accumulatorPart);
            IERC20(rewardTokens[i]).transfer(rewardsReceiver, multisigFee);
            IERC20(rewardTokens[i]).transfer(veSDTFeeProxy, veSDTPart);
            IERC20(rewardTokens[i]).transfer(msg.sender, claimerPart);
            uint256 netRewards = reward - multisigFee - accumulatorPart - veSDTPart - claimerPart;
            IERC20(rewardTokens[i]).approve(multiGauges[_token], netRewards);
            ILiquidityGauge(multiGauges[_token]).deposit_reward_token(rewardTokens[i], netRewards);
            emit Claimed(rewardTokens[i], reward);
        }
        // Distribute SDT
        SdtDistributorV2(sdtDistributor).distribute(multiGauges[_token]);
    }

    // function claimerPendingRewards(address _token) external view returns (ClaimerReward[] memory) {
    //     ClaimerReward[] memory pendings = new ClaimerReward[](8);
    //     address gauge = gauges[_token];
    //     for (uint8 i = 0; i < 8; i++) {
    //         address rewardToken = ILiquidityGauge(gauge).reward_tokens(i);
    //         if (rewardToken == address(0)) {
    //             break;
    //         }
    //         uint256 rewardsBalance = ILiquidityGauge(gauge).claimable_reward(address(locker), rewardToken);
    //         uint256 pendingAmount = (rewardsBalance * claimerRewardFee[gauge]) / BASE_FEE;
    //         ClaimerReward memory pendingReward = ClaimerReward(rewardToken, pendingAmount);
    //         pendings[i] = pendingReward;
    //     }
    //     return pendings;
    // }

    function toggleVault(address _vault) external {
        if (msg.sender != governance && msg.sender != vaultGaugeFactory) revert NOT_ALLOWED();
        vaults[_vault] = !vaults[_vault];
        emit VaultToggled(_vault, vaults[_vault]);
    }

    // function setGauge(address _token, address _gauge) external override onlyGovernanceOrFactory {
    //     gauges[_token] = _gauge;
    //     emit GaugeSet(_gauge, _token);
    // }

    function setMultiGauge(address _gauge, address _multiGauge) external {
        if (msg.sender != governance && msg.sender != vaultGaugeFactory) revert NOT_ALLOWED();
        multiGauges[_gauge] = _multiGauge;
    }

    function setVeSDTProxy(address _newVeSDTProxy) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        veSDTFeeProxy = _newVeSDTProxy;
    }

    function setAccumulator(address _newAccumulator) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        accumulator = _newAccumulator;
    }

    function setRewardsReceiver(address _newRewardsReceiver) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        rewardsReceiver = _newRewardsReceiver;
    }

    function setGovernance(address _newGovernance) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        if (_newGovernance == address(0)) revert ZERO_ADDRESS();
        governance = _newGovernance;
    }

    function setSdtDistributor(address _newSdtDistributor) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        sdtDistributor = _newSdtDistributor;
    }

    function setVaultGaugeFactory(address _newVaultGaugeFactory) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        vaultGaugeFactory = _newVaultGaugeFactory;
    }

    /// @notice function to set new fees
    /// @param _manageFee manageFee
    /// @param _token token address
    /// @param _newFee new fee to set
    function manageFee(MANAGEFEE _manageFee, address _token, uint256 _newFee) external {
        if (msg.sender != governance && msg.sender != vaultGaugeFactory) revert NOT_ALLOWED();
        if (_token == address(0)) revert ZERO_ADDRESS();
        if (_newFee > BASE_FEE) revert FEE_TOO_HIGH();
        if (_manageFee == MANAGEFEE.PERFFEE) {
            // 0
            perfFee[_token] = _newFee;
        } else if (_manageFee == MANAGEFEE.VESDTFEE) {
            // 1
            veSDTFee[_token] = _newFee;
        } else if (_manageFee == MANAGEFEE.ACCUMULATORFEE) {
            //2
            accumulatorFee[_token] = _newFee;
        } else if (_manageFee == MANAGEFEE.CLAIMERREWARD) {
            // 3
            claimerRewardFee[_token] = _newFee;
        }
    }

    /// @notice execute a function
    /// @param to Address to sent the value to
    /// @param value Value to be sent
    /// @param data Call function data
    function execute(address to, uint256 value, bytes calldata data)
        external
        returns (bool, bytes memory)
    {
        if (msg.sender != governance) revert NOT_ALLOWED();
        (bool success, bytes memory result) = to.call{value: value}(data);
        return (success, result);
    }
}
