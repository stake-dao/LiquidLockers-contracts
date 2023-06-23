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

    error CALL_FAILED();
    error FEE_TOO_HIGH();
    error NOT_ALLOWED();
    error WRONG_TRANSFER();
    error VAULT_NOT_APPROVED();
    error ZERO_ADDRESS();

    ILocker public locker = ILocker(0xD8fa8dC5aDeC503AcC5e026a98F32Ca5C1Fa289A);
    address public governance;
    //address public veSDTFeeProxy;
    address public vaultGaugeFactory;

    uint256 public constant BASE_FEE = 10_000;
    address public daoRecipient;
    uint256 public daoFee = 500; // 5%
    address public accRecipient;
    uint256 public accFee = 500; // 5%
    address public veSdtFeeRecipient;
    uint256 public veSdtFeeFee = 500; // 5%
    uint256 public claimerFee = 50; // 0.5%

    mapping(address => bool) public vaults;
    mapping(address => address) public sdGauges;
    
    address public sdtDistributor;
    address public pendle;

    enum MANAGEFEE {
        DAOFEE,
        VESDTFEE,
        ACCUMULATORFEE,
        CLAIMERFEE
    }

    event Claimed(address _token, uint256 _amount);
    event VaultToggled(address _vault, bool _newState);
    event Withdrawn(address _token, uint256 _amount);
    event DaoRecipientSet(address _oldR, address _newR);
    event AccRecipientSet(address _oldR, address _newR);
    event VeSdtFeeRecipientSet(address _oldR, address _newR);

    /* ========== CONSTRUCTOR ========== */
    constructor(
        address _governance,
        address _daoRecipient,
        address _accRecipient,
        address _veSdtFeeRecipient,
        address _sdtDistributor
    ) {
        governance = _governance;
        daoRecipient = _daoRecipient;
        accRecipient = _accRecipient;
        veSdtFeeRecipient = _veSdtFeeRecipient;
        sdtDistributor = _sdtDistributor;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */
    /// @notice function to withdraw the lpt token from the locker
    /// @param _token LPT token to claim the reward
    function withdraw(address _token, uint256 _amount) external {
        if (!vaults[msg.sender]) revert VAULT_NOT_APPROVED();
        uint256 _before = IERC20(_token).balanceOf(address(locker));
        (bool success,) = locker.execute(_token, 0, abi.encodeWithSignature("transfer(address,uint256)", msg.sender, _amount));
        uint256 _after = IERC20(_token).balanceOf(address(locker));
        if (_before - _after != _amount) revert WRONG_TRANSFER();
        if (!success) revert CALL_FAILED();
        emit Withdrawn(_token, _amount);
    }

    /// @notice function to claim the reward for the pendle market token 
    /// @param _token LPT token to claim the reward
    function claim(address _token) external {
        address[] memory rewardTokens = IPendleMarket(_token).getRewardTokens();
        uint256[] memory balancesBefore = new uint256[](rewardTokens.length);
        for (uint8 i; i < rewardTokens.length;) {
            balancesBefore[i] = IERC20(rewardTokens[i]).balanceOf(address(locker));
            unchecked {
                ++i;
            }
        }
        // redeem rewards
        (bool success,) = locker.execute(address(locker), 0, abi.encodeWithSignature("redeemRewards(address)", _token));
        if (!success) revert CALL_FAILED();
        uint256 reward;
        for (uint8 i; i < rewardTokens.length;) {
            reward = IERC20(rewardTokens[i]).balanceOf(address(locker)) - balancesBefore[i];
            if (reward == 0) {
                continue;
            }
            // tranfer here only reward claimed
            (success,) = locker.execute(
                rewardTokens[i], 
                0, 
                abi.encodeWithSignature(
                    "transfer(address,uint256)", 
                    address(this), 
                    reward
                )
            );
            // charge fee
            uint256 rewardToNotify = _chargeFees(rewardTokens[i], reward);
            IERC20(rewardTokens[i]).approve(sdGauges[_token], rewardToNotify);
            ILiquidityGauge(sdGauges[_token]).deposit_reward_token(rewardTokens[i], rewardToNotify);
            emit Claimed(rewardTokens[i], rewardToNotify);
            unchecked {
                ++i;
            }
        }
        // Distribute SDT
        SdtDistributorV2(sdtDistributor).distribute(sdGauges[_token]);
    }

    /// @notice internal function to calculate fees and sent them to recipients 
    /// @param _token token to charge fees 
    /// @param _amount total amount to charge fees 
    function _chargeFees(address _token, uint256 _amount) internal returns (uint256 amountToNotify) {
        uint256 daoPart;
        uint256 accPart;
        uint256 veSdtFeePart;
        uint256 claimerPart;
        if (daoFee > 0) {
            daoPart = (_amount * daoFee) / BASE_FEE;
            IERC20(_token).safeTransfer(daoRecipient, daoPart);
        }
        if (accFee > 0) {
            accPart = (_amount * accFee) / BASE_FEE;
            IERC20(_token).safeTransfer(accRecipient, accPart);
        }
        if (veSdtFeeFee > 0) {
            veSdtFeePart = (_amount * veSdtFeeFee) / BASE_FEE;
            IERC20(_token).safeTransfer(veSdtFeeRecipient, veSdtFeePart);
        } 
        if (claimerFee > 0) {
            claimerPart = (_amount * claimerFee) / BASE_FEE;
            IERC20(_token).safeTransfer(msg.sender, claimerPart);
        }
        amountToNotify = _amount - daoPart - accPart - veSdtFeePart - claimerPart;
    }

    /// @notice function to set new fees
    /// @param _manageFee manageFee
    /// @param _newFee new fee to set
    function manageFee(MANAGEFEE _manageFee, uint256 _newFee) external {
        if (msg.sender != governance && msg.sender != vaultGaugeFactory) revert NOT_ALLOWED();
        if (_manageFee == MANAGEFEE.DAOFEE) {
            // 0
            daoFee = _newFee;
        } else if (_manageFee == MANAGEFEE.VESDTFEE) {
            // 1
            veSdtFeeFee = _newFee;
        } else if (_manageFee == MANAGEFEE.ACCUMULATORFEE) {
            //2
            accFee = _newFee;
        } else if (_manageFee == MANAGEFEE.CLAIMERFEE) {
            // 3
            claimerFee = _newFee;
        }
    }

    function toggleVault(address _vault) external {
        if (msg.sender != governance && msg.sender != vaultGaugeFactory) revert NOT_ALLOWED();
        vaults[_vault] = !vaults[_vault];
        emit VaultToggled(_vault, vaults[_vault]);
    }

    /// @notice function to set the sd gauge related to the LPT token
    /// @param _token pendle LPT token address
    /// @param _sdGauge stake dao gauge address
    function setSdGauge(address _token, address _sdGauge) external {
        if (msg.sender != governance && msg.sender != vaultGaugeFactory) revert NOT_ALLOWED();
        sdGauges[_token] = _sdGauge;
    }

    /// @notice function to set the dao fee recipient
    /// @param _daoRecipient recipient address
    function setDaoRecipient(address _daoRecipient) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        emit DaoRecipientSet(daoRecipient, _daoRecipient);
        daoRecipient = _daoRecipient;
    }

    /// @notice function to set the accumulator fee recipient
    /// @param _accRecipient recipient address
    function setAccRecipient(address _accRecipient) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        emit AccRecipientSet(accRecipient, _accRecipient);
        accRecipient = _accRecipient;
    }

    /// @notice function to set the veSdtFee fee recipient
    /// @param _veSdtFeeRecipient recipient address
    function setVeSdtFeeRecipient(address _veSdtFeeRecipient) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        emit VeSdtFeeRecipientSet(veSdtFeeRecipient, _veSdtFeeRecipient);
        veSdtFeeRecipient = _veSdtFeeRecipient;
    }

    /// @notice function to set the governance
    /// @param _governance governance address
    function setGovernance(address _governance) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        if (_governance == address(0)) revert ZERO_ADDRESS();
        governance = _governance;
    }

    /// @notice function to set the sdt Distributor
    /// @param _sdtDistributor governance address
    function setSdtDistributor(address _sdtDistributor) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        sdtDistributor = _sdtDistributor;
    }

    /// @notice function to set the vault gauge factory
    /// @param _vaultGaugeFactory vault gauge factory address
    function setVaultGaugeFactory(address _vaultGaugeFactory) external {
        if (msg.sender != governance) revert NOT_ALLOWED();
        vaultGaugeFactory = _vaultGaugeFactory;
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
