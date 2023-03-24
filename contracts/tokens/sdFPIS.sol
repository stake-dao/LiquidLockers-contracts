// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "openzeppelin-contracts/token/ERC20/ERC20.sol";

/// @title sdFPIS
/// @author StakeDAO
/// @notice A token that represents the Token deposited by a user into the Depositor
/// @dev Minting & Burning was modified to be used by the operators ennabled
contract sdFPIS is ERC20 {
    mapping(address => bool) public operators;

    constructor() ERC20("Stake DAO FPIS", "sdFPIS") {}

    /// @notice Enable a new operator that can mint and burn sdFPIS
    /// @param _operator new operator address
    function enableOperator(address _operator) external {
        require(operators[msg.sender], "!authorized");
        operators[_operator] = true;
    }

    /// @notice Disable the caller operator, it can't disable another operator
    function disableOperator() external {
        require(operators[msg.sender], "!authorized");
        operators[msg.sender] = false;
    }

    /// @notice mint new sdFPIS, callable only by an operator enabled
    /// @param _to recipient to mint for
    /// @param _amount amount to mint
    function mint(address _to, uint256 _amount) external {
        require(operators[msg.sender], "!authorized");
        _mint(_to, _amount);
    }

    /// @notice burn sdFPIS, callable only by the operator
    /// @param _from sdFPIS holder
    /// @param _amount amount to burn
    function burn(address _from, uint256 _amount) external {
        require(operators[msg.sender], "!authorized");
        _burn(_from, _amount);
    }
}
