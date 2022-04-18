// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../strategy/AngleVault.sol";

/**
 * @title Factory contract for creating new angle vaults to deposit angle LP
 */
contract AngleVaultFactory {
	using ClonesUpgradeable for address;

	address public impl = address(new AngleVault());

	event Deployed(address proxy, address lpToken, address impl);

    /**
	@dev Function to clone Angle Vault contract
	@param _lpToken Angle LP token related to the vault 
	@param _governance governance address
	@param _name vault name
	@param _symbol vault symbol
	 */
	function cloneAndInit(
		IERC20 _lpToken,
		address _governance,
		string memory _name,
		string memory _symbol
	) public {
		_cloneAndInit(
			impl,
			_lpToken,
			_governance,
			_name,
			_symbol
		);
	}

    /**
	@dev Internal function 
	@param _impl address of contract to clone
	@param _lpToken angle LP token address 
	@param _governance governance address 
	@param _name vault name
	@param _symbol vault symbol
	 */
	function _cloneAndInit(
		address _impl,
		IERC20 _lpToken,
		address _governance,
		string memory _name,
        string memory _symbol
	) internal {
		AngleVault deployed = clone(
			_impl,
			_lpToken,
			keccak256(
				abi.encodePacked(
					_governance,
					_name,
					_symbol
				)
			)
		);
		deployed.init(
            _lpToken,
			_governance,
			_name,
			_symbol
		);
	}

    /**
	@dev Internal function that deploy and returns a clone of impl
	@param _impl address of contract to clone
	@param _lpToken angle LP token address
	@param _paramHash governance+name+symbol parameters hash
	 */
	function clone(
		address _impl,
		IERC20 _lpToken,
		bytes32 _paramsHash
	) internal returns (AngleVault) {
		address deployed = address(_impl).cloneDeterministic(
			keccak256(abi.encodePacked(address(_lpToken), _paramsHash))
		);
		emit Deployed(deployed, address(_lpToken), _impl);
		return AngleVault(deployed);
	}

    /**
	@dev Function that predicts the future address passing the parameters
	@param _impl address of contract to clone
	@param _lpToken angle LP token
	@param _paramHash governance+name+symbol parameters hash
	 */
	function predictAddress(
		address _impl,
		IERC20 _lpToken,
		bytes32 _paramsHash
	) public view returns (address) {
		return
			address(_impl).predictDeterministicAddress(
				keccak256(abi.encodePacked(address(_lpToken), _paramsHash))
			);
	}
}