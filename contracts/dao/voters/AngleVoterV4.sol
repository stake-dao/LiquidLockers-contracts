// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "../../strategies/angle/AngleStrategy.sol";
import "../../interfaces/ISDTDistributor.sol";
import "../../interfaces/IAngleMerkleDistributor.sol";
import "openzeppelin-contracts/token/ERC20/IERC20.sol";

contract AngleVoterV4 {

    error NOT_ALLOWED();
    error DIFFERENT_LENGTH();
    error WRONG_LEFT();
    error CALL_FAILED();

    // Addresses
    address public angleStrategy = 0x22635427C72e8b0028FeAE1B5e1957508d9D7CAF;
    address public constant ANGLE_LOCKER = 0xD13F8C25CceD32cdfA79EB5eD654Ce3e484dCAF5;
    address public constant ANGLE_GC = 0x9aD7e7b0877582E14c17702EecF49018DD6f2367;
    IAngleMerkleDistributor public merkleDistributor = IAngleMerkleDistributor(0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae);
    ISDTDistributor public constant SDT_DISTRIBUTOR = ISDTDistributor(0x9C99dffC1De1AfF7E7C1F36fCdD49063A281e18C);

    struct Claim {
        address[] gauges;
        uint256[] amountsToNotify;
        uint256[] feeAmounts;
        address[] feeRecipients;
    }

    address public governance = 0xF930EBBd05eF8b25B1797b9b2109DDC9B0d43063; // ms

    /// @notice claim the rewards for guni gauges
    /// @param _token token to claim
    /// @param _totalAmount total amount to claim
    /// @param _proofs merkle tree proof
    /// @param _claim claim structure
    function claimRewardFromMerkle(
        address _token,
        uint256 _totalAmount, 
        bytes32[][] calldata _proofs, 
        Claim calldata _claim
    )
        external
    {
        if(msg.sender != governance) revert NOT_ALLOWED();
        if(_claim.amountsToNotify.length != _claim.gauges.length) revert DIFFERENT_LENGTH();
        if(_claim.feeAmounts.length != _claim.feeRecipients.length) revert DIFFERENT_LENGTH();

        // define merkle claims parameters
        address[] memory users = new address[](1);
        users[0] = ANGLE_LOCKER;
        address[] memory tokens = new address[](1);
        tokens[0] = _token;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = _totalAmount;

        // claim merkle reward
        uint256 tokenBeforeClaim = IERC20(_token).balanceOf(ANGLE_LOCKER);
        // the angle locker will receive the rewards
        merkleDistributor.claim(users, tokens, amounts, _proofs);

        // notify amounts to the related gauges
        bytes memory data;
        bool success;
        for (uint256 i; i < _claim.gauges.length;) {
            data = abi.encodeWithSignature("deposit_reward_token(address,uint256)", _token, _claim.amountsToNotify[i]);
            (success,) = AngleStrategy(angleStrategy).execute(
                ANGLE_LOCKER, 0, abi.encodeWithSignature("execute(address,uint256,bytes)", _claim.gauges[i], 0, data)
            );
            if(!success) revert CALL_FAILED();
            // Distribute SDT to the related gauge
            SDT_DISTRIBUTOR.distribute(_claim.gauges[i]);
            unchecked {
                ++i;
            }
        }
        // transfer Fees to recipients
        for (uint256 i; i < _claim.feeRecipients.length;) {
            data = abi.encodeWithSignature("transfer(address,uint256)", _claim.feeRecipients[i], _claim.feeAmounts[i]);
            (success,) = AngleStrategy(angleStrategy).execute(
                ANGLE_LOCKER, 0, abi.encodeWithSignature("execute(address,uint256,bytes)", _token, 0, data)
            );
            unchecked {
                ++i;
            }
        }
        //Check if all rewards have been distributed
        if(IERC20(_token).balanceOf(ANGLE_LOCKER) != tokenBeforeClaim) revert WRONG_LEFT();
    }

    /// @notice vote for angle gauges
    /// @param _gauges gauges to vote for
    /// @param _weights vote weight for each gauge
    function voteGauges(address[] calldata _gauges, uint256[] calldata _weights) external {
        if(msg.sender != governance) revert NOT_ALLOWED();
        if(_gauges.length != _weights.length) revert DIFFERENT_LENGTH();
        uint256 length = _gauges.length;
        for (uint256 i; i < length; i++) {
            bytes memory voteData =
                abi.encodeWithSignature("vote_for_gauge_weights(address,uint256)", _gauges[i], _weights[i]);
            (bool success,) = AngleStrategy(angleStrategy).execute(
                ANGLE_LOCKER, 0, abi.encodeWithSignature("execute(address,uint256,bytes)", ANGLE_GC, 0, voteData)
            );
            if(!success) revert CALL_FAILED();
        }
    }

    /// @notice execute a function
    /// @param _to Address to sent the value to
    /// @param _value Value to be sent
    /// @param _data Call function data
    function execute(address _to, uint256 _value, bytes calldata _data) external returns (bool, bytes memory) {
        if(msg.sender != governance) revert NOT_ALLOWED();
        (bool success, bytes memory result) = _to.call{value: _value}(_data);
        return (success, result);
    }

    /// @notice execute a function and transfer funds to the given address
    /// @param _to Address to sent the value to
    /// @param _value Value to be sent
    /// @param _data Call function data
    /// @param _token address of the token that we will transfer
    /// @param _recipient address of the recipient that will get the tokens
    function executeAndTransfer(address _to, uint256 _value, bytes calldata _data, address _token, address _recipient)
        external
        returns (bool, bytes memory)
    {
        if(msg.sender != governance) revert NOT_ALLOWED();
        (bool success, bytes memory result) = _to.call{value: _value}(_data);
        if(!success) revert CALL_FAILED();
        uint256 tokenBalance = IERC20(_token).balanceOf(ANGLE_LOCKER);
        bytes memory transferData = abi.encodeWithSignature("transfer(address,uint256)", _recipient, tokenBalance);
        bytes memory executeData = abi.encodeWithSignature("execute(address,uint256,bytes)", _token, 0, transferData);
        (success,) = AngleStrategy(angleStrategy).execute(ANGLE_LOCKER, 0, executeData);
        if(!success) revert CALL_FAILED();
        return (success, result);
    }

    /* ========== SETTERS ========== */
    /// @notice set new governance
    /// @param _newGovernance governance address
    function setGovernance(address _newGovernance) external {
        if(msg.sender != governance) revert NOT_ALLOWED();
        governance = _newGovernance;
    }

    /// @notice change strategy
    /// @param _newStrategy strategy address
    function changeStrategy(address _newStrategy) external {
        if(msg.sender != governance) revert NOT_ALLOWED();
        angleStrategy = _newStrategy;
    }

    /// @notice function to set the merkleDistributor
    /// @param _merkleDistributor merkle distributor address
    function setMerkeDistributor(address _merkleDistributor) external {
        if(msg.sender != governance) revert NOT_ALLOWED();
        merkleDistributor = IAngleMerkleDistributor(_merkleDistributor);
    }
}