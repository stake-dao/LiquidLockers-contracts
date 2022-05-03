// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "../strategy/CurveVault.sol";
import "../staking/GaugeMultiRewards.sol";
import "../interfaces/IGaugeController.sol";
import "../strategy/CurveStrategy.sol";

interface CurveLiquidityGauge {
	function lp_token() external view returns (address);
}

/**
 * @title Factory contract usefull for creating new curve vaults that supports LP related
 * to the curve platform, and the gauge multi rewards attached to it.
 */

contract CurveVaultFactoryV2 {
	using ClonesUpgradeable for address;

	address public vaultImpl = address(new CurveVault());
	address public gaugeImpl = address(new GaugeMultiRewards());
	address public constant governance = 0xF930EBBd05eF8b25B1797b9b2109DDC9B0d43063;
	address public constant gaugeController = 0x2F50D538606Fa9EDD2B11E2446BEb18C9D5846bB;
	address public constant CRV = 0xD533a949740bb3306d119CC777fa900bA034cd52;
	address public curveStrategy;
	event VaultDeployed(address proxy, address lpToken, address impl);
	event GaugeDeployed(address proxy, address stakeToken, address impl);

	constructor(address _curveStrategy) {
		curveStrategy = _curveStrategy;
	}

	/**
	@dev Function to clone Curve Vault and its gauge contracts 
	@param _crvGaugeAddress curve liqudity gauge address
	 */
	function cloneAndInit(address _crvGaugeAddress) public {
		uint256 weight = IGaugeController(gaugeController).get_gauge_weight(_crvGaugeAddress);
		require(weight > 0, "must have weight");
		address vaultLpToken = CurveLiquidityGauge(_crvGaugeAddress).lp_token();
		string memory tokenSymbol = ERC20Upgradeable(vaultLpToken).symbol();
		string memory tokenName = ERC20Upgradeable(vaultLpToken).name();
		address vaultImplAddress = _cloneAndInitVault(
			vaultImpl,
			ERC20Upgradeable(vaultLpToken),
			governance,
			string(abi.encodePacked("sd", tokenName, " Vault")),
			string(abi.encodePacked("sd", tokenSymbol, "-vault")),
			CurveStrategy(curveStrategy)
		);
		address gaugeImplAddress = _cloneAndInitGauge(
			gaugeImpl,
			vaultImplAddress,
			governance,
			string(abi.encodePacked("sd", tokenName, " Gauge")),
			string(abi.encodePacked("sd", tokenSymbol, "-gauge"))
		);
		CurveVault(vaultImplAddress).setGaugeMultiRewards(gaugeImplAddress);
		CurveVault(vaultImplAddress).setGovernance(governance);
		CurveStrategy(curveStrategy).toggleVault(vaultImplAddress);
		CurveStrategy(curveStrategy).setGauge(vaultLpToken, _crvGaugeAddress);
		CurveStrategy(curveStrategy).setMultiGauge(_crvGaugeAddress, gaugeImplAddress);
		CurveStrategy(curveStrategy).manageFee(CurveStrategy.MANAGEFEE.PERFFEE, _crvGaugeAddress, 200); //%2 default
		GaugeMultiRewards(gaugeImplAddress).addReward(CRV, curveStrategy, 604800);
		GaugeMultiRewards(gaugeImplAddress).setGovernance(governance);
	}

	/**
	@dev Internal function to clone the vault 
	@param _impl address of contract to clone
	@param _lpToken curve LP token address 
	@param _governance governance address 
	@param _name vault name
	@param _symbol vault symbol
	@param _curveStrategy curve strategy proxy
	 */
	function _cloneAndInitVault(
		address _impl,
		ERC20Upgradeable _lpToken,
		address _governance,
		string memory _name,
		string memory _symbol,
		CurveStrategy _curveStrategy
	) internal returns (address) {
		CurveVault deployed = cloneVault(
			_impl,
			_lpToken,
			keccak256(abi.encodePacked(_governance, _name, _symbol, _curveStrategy))
		);
		deployed.init(_lpToken, address(this), _name, _symbol, _curveStrategy);
		return address(deployed);
	}

	/**
	@dev Internal function to clone the gauge multi rewards
	@param _impl address of contract to clone
	@param _stakingToken sd LP token address 
	@param _governance governance address 
	@param _name gauge name
	@param _symbol gauge symbol
	 */
	function _cloneAndInitGauge(
		address _impl,
		address _stakingToken,
		address _governance,
		string memory _name,
		string memory _symbol
	) internal returns (address) {
		GaugeMultiRewards deployed = cloneGauge(
			_impl,
			_stakingToken,
			keccak256(abi.encodePacked(_governance, _name, _symbol))
		);
		deployed.init(_stakingToken, _stakingToken, address(this), _name, _symbol);
		return address(deployed);
	}

	/**
	@dev Internal function that deploy and returns a clone of vault impl
	@param _impl address of contract to clone
	@param _lpToken curve LP token address
	@param _paramsHash governance+name+symbol+strategy parameters hash
	 */
	function cloneVault(
		address _impl,
		ERC20Upgradeable _lpToken,
		bytes32 _paramsHash
	) internal returns (CurveVault) {
		address deployed = address(_impl).cloneDeterministic(keccak256(abi.encodePacked(address(_lpToken), _paramsHash)));
		emit VaultDeployed(deployed, address(_lpToken), _impl);
		return CurveVault(deployed);
	}

	/**
	@dev Internal function that deploy and returns a clone of gauge impl
	@param _impl address of contract to clone
	@param _stakingToken sd LP token address
	@param _paramsHash governance+name+symbol parameters hash
	 */
	function cloneGauge(
		address _impl,
		address _stakingToken,
		bytes32 _paramsHash
	) internal returns (GaugeMultiRewards) {
		address deployed = address(_impl).cloneDeterministic(
			keccak256(abi.encodePacked(address(_stakingToken), _paramsHash))
		);
		emit GaugeDeployed(deployed, _stakingToken, _impl);
		return GaugeMultiRewards(deployed);
	}

	/**
	@dev Function that predicts the future address passing the parameters
	@param _impl address of contract to clone
	@param _token token (LP or sdLP)
	@param _paramsHash parameters hash
	 */
	function predictAddress(
		address _impl,
		IERC20 _token,
		bytes32 _paramsHash
	) public view returns (address) {
		return address(_impl).predictDeterministicAddress(keccak256(abi.encodePacked(address(_token), _paramsHash)));
	}
}
