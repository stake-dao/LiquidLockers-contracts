// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "../strategy/BalancerVault.sol";
import "../interfaces/IGaugeController.sol";
import "../interfaces/ILiquidityGaugeStrat.sol";

interface IBalancerLiquidityGauge {
	function lp_token() external view returns (address);
}

/**
 * @title Factory contract usefull for creating new balancer vaults that supports BPT related
 * to the balancer platform, and the gauge multi rewards attached to it.
 */

contract BalancerVaultFactory {
	using ClonesUpgradeable for address;

	address public vaultImpl = address(new BalancerVault());
	address public gaugeImpl;
	address public constant GOVERNANCE = 0xF930EBBd05eF8b25B1797b9b2109DDC9B0d43063;
	address public constant GAUGE_CONTROLLER = 0xC128468b7Ce63eA702C1f104D55A2566b13D3ABD;
	address public constant BAL = 0xba100000625a3754423978a60c9317c58a424e3D;
	address public constant VESDT = 0x0C30476f66034E11782938DF8e4384970B6c9e8a;
	address public constant SDT = 0x73968b9a57c6E53d41345FD57a6E6ae27d6CDB2F;
	address public constant VEBOOST = 0xD67bdBefF01Fc492f1864E61756E5FBB3f173506;
	address public constant CLAIM_REWARDS = 0x633120100e108F03aCe79d6C78Aac9a56db1be0F; // v2
	address public balancerStrategy;
	address public sdtDistributor;
	event VaultDeployed(address proxy, address lpToken, address impl);
	event GaugeDeployed(address proxy, address stakeToken, address impl);

	constructor(
		address _gaugeImpl, 
		address _balancerStrategy,
		address _sdtDistributor
	) {
		gaugeImpl = _gaugeImpl;
		balancerStrategy = _balancerStrategy;
		sdtDistributor = _sdtDistributor;
	}

	/**
	@dev Function to clone Balancer Vault and its gauge contracts 
	@param _balGaugeAddress balancer liquidity gauge address
	 */
	function cloneAndInit(address _balGaugeAddress) public {
		uint256 weight = IGaugeController(GAUGE_CONTROLLER).get_gauge_weight(_balGaugeAddress);
		require(weight > 0, "must have weight");
		address vaultLpToken = IBalancerLiquidityGauge(_balGaugeAddress).lp_token();
		string memory tokenSymbol = ERC20Upgradeable(vaultLpToken).symbol();
		address vaultImplAddress = _cloneAndInitVault(
			vaultImpl,
			ERC20Upgradeable(vaultLpToken),
			GOVERNANCE,
			string(abi.encodePacked("sd", tokenSymbol, " Vault")),
			string(abi.encodePacked("sd", tokenSymbol, "-vault"))
		);
		address gaugeImplAddress = _cloneAndInitGauge(
			gaugeImpl,
			vaultImplAddress,
			GOVERNANCE,
			tokenSymbol
		);
		BalancerVault(vaultImplAddress).setLiquidityGauge(gaugeImplAddress);
		BalancerVault(vaultImplAddress).setGovernance(GOVERNANCE);
		BalancerStrategy(balancerStrategy).toggleVault(vaultImplAddress);
		BalancerStrategy(balancerStrategy).setGauge(vaultLpToken, _balGaugeAddress);
		BalancerStrategy(balancerStrategy).setMultiGauge(_balGaugeAddress, gaugeImplAddress);
		BalancerStrategy(balancerStrategy).manageFee(BalancerStrategy.MANAGEFEE.PERFFEE, _balGaugeAddress, 200); //%2 default
		BalancerStrategy(balancerStrategy).manageFee(BalancerStrategy.MANAGEFEE.VESDTFEE, _balGaugeAddress, 500); //%5 default
		BalancerStrategy(balancerStrategy).manageFee(BalancerStrategy.MANAGEFEE.ACCUMULATORFEE, _balGaugeAddress, 800); //%8 default
		BalancerStrategy(balancerStrategy).manageFee(BalancerStrategy.MANAGEFEE.CLAIMERREWARD, _balGaugeAddress, 50); //%0.5 default
		ILiquidityGaugeStrat(gaugeImplAddress).add_reward(BAL, balancerStrategy);
		ILiquidityGaugeStrat(gaugeImplAddress).set_claimer(CLAIM_REWARDS);
		ILiquidityGaugeStrat(gaugeImplAddress).commit_transfer_ownership(GOVERNANCE);
	}

	/**
	@dev Internal function to clone the vault 
	@param _impl address of contract to clone
	@param _lpToken balancer BPT token address 
	@param _governance governance address 
	@param _name vault name
	@param _symbol vault symbol
	 */
	function _cloneAndInitVault(
		address _impl,
		ERC20Upgradeable _lpToken,
		address _governance,
		string memory _name,
		string memory _symbol
	) internal returns (address) {
		BalancerVault deployed = cloneVault(
			_impl,
			_lpToken,
			keccak256(abi.encodePacked(_governance, _name, _symbol, balancerStrategy))
		);
		deployed.init(_lpToken, address(this), _name, _symbol, BalancerStrategy(balancerStrategy));
		return address(deployed);
	}

	/**
	@dev Internal function to clone the gauge multi rewards
	@param _impl address of contract to clone
	@param _stakingToken sd LP token address 
	@param _governance governance address 
	@param _symbol gauge symbol
	 */
	function _cloneAndInitGauge(
		address _impl,
		address _stakingToken,
		address _governance,
		string memory _symbol
	) internal returns (address) {
		ILiquidityGaugeStrat deployed = cloneGauge(_impl, _stakingToken, keccak256(abi.encodePacked(_governance, _symbol)));
		deployed.initialize(
			_stakingToken,
			address(this),
			SDT,
			VESDT,
			VEBOOST,
			sdtDistributor,
			_stakingToken,
			_symbol
		);
		return address(deployed);
	}

	/**
	@dev Internal function that deploy and returns a clone of vault impl
	@param _impl address of contract to clone
	@param _lpToken balancer BPT token address
	@param _paramsHash governance+name+symbol+strategy parameters hash
	 */
	function cloneVault(
		address _impl,
		ERC20Upgradeable _lpToken,
		bytes32 _paramsHash
	) internal returns (BalancerVault) {
		address deployed = address(_impl).cloneDeterministic(keccak256(abi.encodePacked(address(_lpToken), _paramsHash)));
		emit VaultDeployed(deployed, address(_lpToken), _impl);
		return BalancerVault(deployed);
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
	) internal returns (ILiquidityGaugeStrat) {
		address deployed = address(_impl).cloneDeterministic(
			keccak256(abi.encodePacked(address(_stakingToken), _paramsHash))
		);
		emit GaugeDeployed(deployed, _stakingToken, _impl);
		return ILiquidityGaugeStrat(deployed);
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
