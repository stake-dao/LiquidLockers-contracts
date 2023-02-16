// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;
import "../../interfaces/IFeeRegistry.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../../interfaces/ILiquidityGaugeStratFrax.sol";
import "../../interfaces/IPoolRegistry.sol";

interface ICurveConvex {
    function earmarkRewards(uint256 _pid) external returns (bool);

    function earmarkFees() external returns (bool);

    function poolInfo(uint256 _pid)
        external
        returns (
            address _lptoken,
            address _token,
            address _gauge,
            address _crvRewards,
            address _stash,
            bool _shutdown
        );
}

interface IConvexWrapperV2 {
    struct EarnedData {
        address token;
        uint256 amount;
    }

    function collateralVault() external view returns (address vault);

    function convexPoolId() external view returns (uint256 _poolId);

    function balanceOf(address _account) external view returns (uint256);

    function totalBalanceOf(address _account) external view returns (uint256);

    function deposit(uint256 _amount, address _to) external;

    function stake(uint256 _amount, address _to) external;

    function withdraw(uint256 _amount) external;

    function withdrawAndUnwrap(uint256 _amount) external;

    function getReward(address _account) external;

    function getReward(address _account, address _forwardTo) external;

    function rewardLength() external view returns (uint256);

    function earned(address _account)
        external
        returns (EarnedData[] memory claimable);

    function earnedView(address _account)
        external
        view
        returns (EarnedData[] memory claimable);

    function setVault(address _vault) external;

    function user_checkpoint(address[2] calldata _accounts)
        external
        returns (bool);
}

interface IFraxFarmBase {
    function totalLiquidityLocked() external view returns (uint256);

    function lockedLiquidityOf(address account) external view returns (uint256);

    function toggleValidVeFXSProxy(address proxy_address) external;

    function proxyToggleStaker(address staker_address) external;

    function stakerSetVeFXSProxy(address proxy_address) external;

    function getReward(address destination_address)
        external
        returns (uint256[] memory);
}

contract StakingProxyBase {
    using SafeERC20 for IERC20;

    enum VaultType {
        Erc20Basic,
        UniV3,
        Convex,
        Erc20Joint
    }

    address public constant FXS =
        address(0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0);
    address public constant vefxsProxy =
        address(0x59CFCD384746ec3035299D90782Be065e466800B);
    address public constant FEE_REGISTRY =
        address(0x0f1dc3Bd5fE8a3034d6Df0A411Efc7916830d19c);
    address public constant POOL_REGISTRY =
        address(0xd4525E29111edD74eAA425AB4c0Bc507bE3aC69F);

    address public owner; //owner of the vault
    address public stakingAddress; //farming contract
    address public stakingToken; //farming token
    address public rewards; //extra rewards on convex
    address public usingProxy; //address of proxy being used

    uint256 public constant FEE_DENOMINATOR = 10000;

    constructor() {}

    function vaultType() external pure virtual returns (VaultType) {
        return VaultType.Erc20Basic;
    }

    function vaultVersion() external pure virtual returns (uint256) {
        return 1;
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "!auth");
        _;
    }

    modifier onlyAdmin() {
        require(vefxsProxy == msg.sender, "!auth_admin");
        _;
    }

    //initialize vault
    function initialize(
        address _owner,
        address _stakingAddress,
        address _stakingToken,
        address _rewardsAddress
    ) external virtual {}

    /// @notice help to change stake dao liquidity gauge address for reward
    /// @dev need to be called by each user for each personal vault
    /// @dev when a pool change the Liquidity gauge reward address
    function changeRewards() external onlyOwner {
        // check if new reward address has been set on the pool registry for this pid
        uint256 pid = IPoolRegistry(POOL_REGISTRY).vaultPid(address(this));
        (, , , address newRewards, ) = IPoolRegistry(POOL_REGISTRY).poolInfo(
            pid
        );
        require(newRewards != rewards, "!rewardsAddress");

        //remove from old rewards and claim
        uint256 bal = ILiquidityGaugeStratFrax(rewards).balanceOf(owner);
        if (bal > 0) {
            ILiquidityGaugeStratFrax(rewards).withdraw(bal, owner, false);
            ILiquidityGaugeStratFrax(newRewards).deposit(bal, owner, false);
        }
        ILiquidityGaugeStratFrax(rewards).claim_rewards(owner);

        //set to new rewards
        rewards = newRewards;
    }

    //checkpoint weight on farm by calling getReward as its the lowest cost thing to do.
    function checkpointRewards() external onlyAdmin {
        //checkpoint the frax farm
        _checkpointFarm();
    }

    function _checkpointFarm() internal {
        //claim rewards to local vault as a means to checkpoint
        IFraxFarmBase(stakingAddress).getReward(address(this));
    }

    function setVeFXSProxy(address _proxy) external virtual onlyAdmin {
        //set the vefxs proxy
        _setVeFXSProxy(_proxy);
    }

    function _setVeFXSProxy(address _proxyAddress) internal {
        //set proxy address on staking contract
        IFraxFarmBase(stakingAddress).stakerSetVeFXSProxy(_proxyAddress);
        usingProxy = _proxyAddress;
    }

    function getReward() external virtual {}

    function getReward(bool _claim) external virtual {}

    function getReward(bool _claim, address[] calldata _rewardTokenList)
        external
        virtual
    {}

    function earned()
        external
        view
        virtual
        returns (
            address[] memory token_addresses,
            uint256[] memory total_earned
        )
    {}

    //checkpoint and add/remove weight to convex rewards contract
    function _checkpointRewards() internal {
        //using liquidity shares from staking contract will handle rebasing tokens correctly
        uint256 userLiq = IFraxFarmBase(stakingAddress).lockedLiquidityOf(
            address(this)
        );
        //get current balance of reward contract
        uint256 bal = ILiquidityGaugeStratFrax(rewards).balanceOf(
            address(this)
        );
        if (userLiq >= bal) {
            //add the difference to reward contract
            ILiquidityGaugeStratFrax(rewards).deposit(
                userLiq - bal,
                owner,
                false
            );
        } else {
            //remove the difference from the reward contract
            ILiquidityGaugeStratFrax(rewards).withdraw(
                bal - userLiq,
                owner,
                false
            );
        }
    }

    /// @notice internal function to apply fees to fxs and send remaining to owner
    function _processFxs() internal {
        //get fee rate from booster
        uint256 multisigFee = IFeeRegistry(FEE_REGISTRY).multisigPart();
        uint256 accumulatorFee = IFeeRegistry(FEE_REGISTRY).accumulatorPart();
        uint256 veSDTFee = IFeeRegistry(FEE_REGISTRY).veSDTPart();

        //send fxs fees to fee deposit
        uint256 fxsBalance = IERC20(FXS).balanceOf(address(this));
        uint256 sendMulti = (fxsBalance * multisigFee) / FEE_DENOMINATOR;
        uint256 sendAccum = (fxsBalance * accumulatorFee) / FEE_DENOMINATOR;
        uint256 sendveSDT = (fxsBalance * veSDTFee) / FEE_DENOMINATOR;

        if (sendMulti > 0) {
            IERC20(FXS).transfer(
                IFeeRegistry(FEE_REGISTRY).multiSig(),
                sendMulti
            );
        }
        if (sendveSDT > 0) {
            IERC20(FXS).transfer(
                IFeeRegistry(FEE_REGISTRY).veSDTFeeProxy(),
                sendveSDT
            );
        }
        if (sendAccum > 0) {
            IERC20(FXS).transfer(
                IFeeRegistry(FEE_REGISTRY).accumulator(),
                sendAccum
            );
        }

        //transfer remaining fxs to owner
        uint256 sendAmount = IERC20(FXS).balanceOf(address(this));
        if (sendAmount > 0) {
            IERC20(FXS).transfer(owner, sendAmount);
        }
    }

    //get extra rewards
    function _processExtraRewards() internal {
        //check if there is a balance because the reward contract could have be activated later
        //dont use _checkpointRewards since difference of 0 will still call deposit() and cost gas
        uint256 bal = ILiquidityGaugeStratFrax(rewards).balanceOf(
            address(this)
        );
        uint256 userLiq = IFraxFarmBase(stakingAddress).lockedLiquidityOf(
            address(this)
        );
        if (bal == 0 && userLiq > 0) {
            //bal == 0 and liq > 0 can only happen if rewards were turned on after staking
            ILiquidityGaugeStratFrax(rewards).deposit(userLiq, owner, false);
        }
        ILiquidityGaugeStratFrax(rewards).claim_rewards(owner);
    }

    //transfer other reward tokens besides fxs(which needs to have fees applied)
    function _transferTokens(address[] memory _tokens) internal {
        //transfer all tokens
        for (uint256 i = 0; i < _tokens.length; i++) {
            if (_tokens[i] != FXS) {
                uint256 bal = IERC20(_tokens[i]).balanceOf(address(this));
                if (bal > 0) {
                    IERC20(_tokens[i]).safeTransfer(owner, bal);
                }
            }
        }
    }
}

interface IFraxFarmERC20 {
    struct LockedStake {
        bytes32 kek_id;
        uint256 start_timestamp;
        uint256 liquidity;
        uint256 ending_timestamp;
        uint256 lock_multiplier; // 6 decimals of precision. 1x = 1000000
    }

    function owner() external view returns (address);

    function stakingToken() external view returns (address);

    function fraxPerLPToken() external view returns (uint256);

    function calcCurCombinedWeight(address account)
        external
        view
        returns (
            uint256 old_combined_weight,
            uint256 new_vefxs_multiplier,
            uint256 new_combined_weight
        );

    function lockedStakesOf(address account)
        external
        view
        returns (LockedStake[] memory);

    function lockedStakesOfLength(address account)
        external
        view
        returns (uint256);

    function lockAdditional(bytes32 kek_id, uint256 addl_liq) external;

    function lockLonger(bytes32 kek_id, uint256 new_ending_ts) external;

    function stakeLocked(uint256 liquidity, uint256 secs)
        external
        returns (bytes32);

    function withdrawLocked(bytes32 kek_id, address destination_address)
        external
        returns (uint256);

    function periodFinish() external view returns (uint256);

    function getAllRewardTokens() external view returns (address[] memory);

    function earned(address account)
        external
        view
        returns (uint256[] memory new_earned);

    function totalLiquidityLocked() external view returns (uint256);

    function lockedLiquidityOf(address account) external view returns (uint256);

    function totalCombinedWeight() external view returns (uint256);

    function combinedWeightOf(address account) external view returns (uint256);

    function lockMultiplier(uint256 secs) external view returns (uint256);

    function rewardRates(uint256 token_idx)
        external
        view
        returns (uint256 rwd_rate);

    function userStakedFrax(address account) external view returns (uint256);

    function proxyStakedFrax(address proxy_address)
        external
        view
        returns (uint256);

    function maxLPForMaxBoost(address account) external view returns (uint256);

    function minVeFXSForMaxBoost(address account)
        external
        view
        returns (uint256);

    function minVeFXSForMaxBoostProxy(address proxy_address)
        external
        view
        returns (uint256);

    function veFXSMultiplier(address account)
        external
        view
        returns (uint256 vefxs_multiplier);

    function toggleValidVeFXSProxy(address proxy_address) external;

    function proxyToggleStaker(address staker_address) external;

    function stakerSetVeFXSProxy(address proxy_address) external;

    function getReward(address destination_address)
        external
        returns (uint256[] memory);

    function vefxs_max_multiplier() external view returns (uint256);

    function vefxs_boost_scale_factor() external view returns (uint256);

    function vefxs_per_frax_for_max_boost() external view returns (uint256);

    function getProxyFor(address addr) external view returns (address);

    function sync() external;
}

contract VaultV2 is StakingProxyBase, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant poolRegistry =
        address(0x7413bFC877B5573E29f964d572f421554d8EDF86);
    address public constant convexCurveBooster =
        address(0xF403C135812408BFbE8713b5A23a04b3D48AAE31);
    address public constant crv =
        address(0xD533a949740bb3306d119CC777fa900bA034cd52);
    address public constant cvx =
        address(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);

    address public curveLpToken;
    address public convexDepositToken;

    constructor() {}

    function vaultType() external pure override returns (VaultType) {
        return VaultType.Convex;
    }

    function vaultVersion() external pure override returns (uint256) {
        return 4;
    }

    //initialize vault
    function initialize(
        address _owner,
        address _stakingAddress,
        address _stakingToken,
        address _rewardsAddress
    ) external override {
        require(owner == address(0), "already init");

        //set variables
        owner = _owner;
        stakingAddress = _stakingAddress;
        stakingToken = _stakingToken;
        rewards = _rewardsAddress;

        //get tokens from pool info
        (address _lptoken, address _token, , , , ) = ICurveConvex(
            convexCurveBooster
        ).poolInfo(IConvexWrapperV2(_stakingToken).convexPoolId());

        curveLpToken = _lptoken;
        convexDepositToken = _token;

        //set infinite approvals
        IERC20(_stakingToken).approve(_stakingAddress, type(uint256).max);
        IERC20(_lptoken).approve(_stakingToken, type(uint256).max);
        IERC20(_token).approve(_stakingToken, type(uint256).max);
    }

    //create a new locked state of _secs timelength with a Curve LP token
    function stakeLockedCurveLp(uint256 _liquidity, uint256 _secs)
        external
        onlyOwner
        nonReentrant
        returns (bytes32 kek_id)
    {
        if (_liquidity > 0) {
            //pull tokens from user
            IERC20(curveLpToken).safeTransferFrom(
                msg.sender,
                address(this),
                _liquidity
            );

            //deposit into wrapper
            IConvexWrapperV2(stakingToken).deposit(_liquidity, address(this));

            //stake
            kek_id = IFraxFarmERC20(stakingAddress).stakeLocked(
                _liquidity,
                _secs
            );
        }

        //checkpoint rewards
        _checkpointRewards();
    }

    //create a new locked state of _secs timelength with a Convex deposit token
    function stakeLockedConvexToken(uint256 _liquidity, uint256 _secs)
        external
        onlyOwner
        nonReentrant
        returns (bytes32 kek_id)
    {
        if (_liquidity > 0) {
            //pull tokens from user
            IERC20(convexDepositToken).safeTransferFrom(
                msg.sender,
                address(this),
                _liquidity
            );

            //stake into wrapper
            IConvexWrapperV2(stakingToken).stake(_liquidity, address(this));

            //stake into frax
            kek_id = IFraxFarmERC20(stakingAddress).stakeLocked(
                _liquidity,
                _secs
            );
        }

        //checkpoint rewards
        _checkpointRewards();
    }

    //create a new locked state of _secs timelength
    function stakeLocked(uint256 _liquidity, uint256 _secs)
        external
        onlyOwner
        nonReentrant
        returns (bytes32 kek_id)
    {
        if (_liquidity > 0) {
            //pull tokens from user
            IERC20(stakingToken).safeTransferFrom(
                msg.sender,
                address(this),
                _liquidity
            );

            //stake
            kek_id = IFraxFarmERC20(stakingAddress).stakeLocked(
                _liquidity,
                _secs
            );
        }

        //checkpoint rewards
        _checkpointRewards();
    }

    //add to a current lock
    function lockAdditional(bytes32 _kek_id, uint256 _addl_liq)
        external
        onlyOwner
        nonReentrant
    {
        if (_addl_liq > 0) {
            //pull tokens from user
            IERC20(stakingToken).safeTransferFrom(
                msg.sender,
                address(this),
                _addl_liq
            );

            //add stake
            IFraxFarmERC20(stakingAddress).lockAdditional(_kek_id, _addl_liq);
        }

        //checkpoint rewards
        _checkpointRewards();
    }

    //add to a current lock
    function lockAdditionalCurveLp(bytes32 _kek_id, uint256 _addl_liq)
        external
        onlyOwner
        nonReentrant
    {
        if (_addl_liq > 0) {
            //pull tokens from user
            IERC20(curveLpToken).safeTransferFrom(
                msg.sender,
                address(this),
                _addl_liq
            );

            //deposit into wrapper
            IConvexWrapperV2(stakingToken).deposit(_addl_liq, address(this));

            //add stake
            IFraxFarmERC20(stakingAddress).lockAdditional(_kek_id, _addl_liq);
        }

        //checkpoint rewards
        _checkpointRewards();
    }

    //add to a current lock
    function lockAdditionalConvexToken(bytes32 _kek_id, uint256 _addl_liq)
        external
        onlyOwner
        nonReentrant
    {
        if (_addl_liq > 0) {
            //pull tokens from user
            IERC20(convexDepositToken).safeTransferFrom(
                msg.sender,
                address(this),
                _addl_liq
            );

            //stake into wrapper
            IConvexWrapperV2(stakingToken).stake(_addl_liq, address(this));

            //add stake
            IFraxFarmERC20(stakingAddress).lockAdditional(_kek_id, _addl_liq);
        }

        //checkpoint rewards
        _checkpointRewards();
    }

    // Extends the lock of an existing stake
    function lockLonger(bytes32 _kek_id, uint256 new_ending_ts)
        external
        onlyOwner
        nonReentrant
    {
        //update time
        IFraxFarmERC20(stakingAddress).lockLonger(_kek_id, new_ending_ts);

        //checkpoint rewards
        _checkpointRewards();
    }

    //withdraw a staked position
    //frax farm transfers first before updating farm state so will checkpoint during transfer
    function withdrawLocked(bytes32 _kek_id) external onlyOwner nonReentrant {
        //withdraw directly to owner(msg.sender)
        IFraxFarmERC20(stakingAddress).withdrawLocked(_kek_id, msg.sender);

        //checkpoint rewards
        _checkpointRewards();
    }

    //withdraw a staked position
    //frax farm transfers first before updating farm state so will checkpoint during transfer
    function withdrawLockedAndUnwrap(bytes32 _kek_id)
        external
        onlyOwner
        nonReentrant
    {
        //withdraw
        IFraxFarmERC20(stakingAddress).withdrawLocked(_kek_id, address(this));

        //unwrap
        IConvexWrapperV2(stakingToken).withdrawAndUnwrap(
            IERC20(stakingToken).balanceOf(address(this))
        );
        IERC20(curveLpToken).transfer(
            owner,
            IERC20(curveLpToken).balanceOf(address(this))
        );

        //checkpoint rewards
        _checkpointRewards();
    }

    //helper function to combine earned tokens on staking contract and any tokens that are on this vault
    function earned()
        external
        view
        override
        returns (
            address[] memory token_addresses,
            uint256[] memory total_earned
        )
    {
        //get list of reward tokens
        address[] memory rewardTokens = IFraxFarmERC20(stakingAddress)
            .getAllRewardTokens();
        uint256[] memory stakedearned = IFraxFarmERC20(stakingAddress).earned(
            address(this)
        );
        IConvexWrapperV2.EarnedData[] memory convexrewards = IConvexWrapperV2(
            stakingToken
        ).earnedView(address(this));

        uint256 extraRewardsLength = ILiquidityGaugeStratFrax(rewards)
            .reward_count();
        token_addresses = new address[](
            rewardTokens.length + extraRewardsLength + convexrewards.length
        );
        total_earned = new uint256[](
            rewardTokens.length + extraRewardsLength + convexrewards.length
        );

        //add any tokens that happen to be already claimed but sitting on the vault
        //(ex. withdraw claiming rewards)
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            token_addresses[i] = rewardTokens[i];
            total_earned[i] =
                stakedearned[i] +
                IERC20(rewardTokens[i]).balanceOf(address(this));
        }

        for (uint256 i = 0; i < extraRewardsLength; i++) {
            address token = ILiquidityGaugeStratFrax(rewards).reward_tokens(i);
            token_addresses[i + rewardTokens.length] = token;
            total_earned[i + rewardTokens.length] = ILiquidityGaugeStratFrax(
                rewards
            ).claimable_reward(owner, token);
        }

        //add convex farm earned tokens
        for (uint256 i = 0; i < convexrewards.length; i++) {
            token_addresses[
                i + rewardTokens.length + extraRewardsLength
            ] = convexrewards[i].token;
            total_earned[
                i + rewardTokens.length + extraRewardsLength
            ] = convexrewards[i].amount;
        }
    }

    /*
    claim flow:
        claim rewards directly to the vault
        calculate fees to send to fee deposit
        send fxs to a holder contract for fees
        get reward list of tokens that were received
        send all remaining tokens to owner

    A slightly less gas intensive approach could be to send rewards directly to a holder contract and have it sort everything out.
    However that makes the logic a bit more complex as well as runs a few future proofing risks
    */
    function getReward() external override {
        getReward(true);
    }

    //get reward with claim option.
    //_claim bool is for the off chance that rewardCollectionPause is true so getReward() fails but
    //there are tokens on this vault for cases such as withdraw() also calling claim.
    //can also be used to rescue tokens on the vault
    function getReward(bool _claim) public override {
        //claim
        if (_claim) {
            //claim frax farm
            IFraxFarmERC20(stakingAddress).getReward(address(this));
            //claim convex farm and forward to owner
            IConvexWrapperV2(stakingToken).getReward(address(this), owner);

            //double check there have been no crv/cvx claims directly to this address
            uint256 b = IERC20(crv).balanceOf(address(this));
            if (b > 0) {
                IERC20(crv).safeTransfer(owner, b);
            }
            b = IERC20(cvx).balanceOf(address(this));
            if (b > 0) {
                IERC20(cvx).safeTransfer(owner, b);
            }
        }

        //process fxs fees
        _processFxs();

        //get list of reward tokens
        address[] memory rewardTokens = IFraxFarmERC20(stakingAddress)
            .getAllRewardTokens();

        //transfer
        _transferTokens(rewardTokens);

        //extra rewards
        _processExtraRewards();
    }

    //auxiliary function to supply token list(save a bit of gas + dont have to claim everything)
    //_claim bool is for the off chance that rewardCollectionPause is true so getReward() fails but
    //there are tokens on this vault for cases such as withdraw() also calling claim.
    //can also be used to rescue tokens on the vault
    function getReward(bool _claim, address[] calldata _rewardTokenList)
        external
        override
    {
        //claim
        if (_claim) {
            //claim frax farm
            IFraxFarmERC20(stakingAddress).getReward(address(this));
            //claim convex farm and forward to owner
            IConvexWrapperV2(stakingToken).getReward(address(this), owner);
        }

        //process fxs fees
        _processFxs();

        //transfer
        _transferTokens(_rewardTokenList);

        //extra rewards
        _processExtraRewards();
    }
}
