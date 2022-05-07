// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "../strategy/FraxVault.sol";
import "../strategy/FraxStrategy.sol";
import "../interfaces/IGaugeController.sol";
import "../interfaces/ILiquidityGaugeStrat.sol";

interface IFraxLiquidityGauge {
	function stakingToken() external view returns (address);
}

/**
 * @title Factory contract usefull for creating new angle vaults that supports LP related
 * to the angle platform, and the gauge multi rewards attached to it.
 */
contract FraxVaultFactory {
	using ClonesUpgradeable for address;

	address public vaultImpl = address(new FraxVault());
	address public gaugeImpl;
	address public constant governance = 0xF930EBBd05eF8b25B1797b9b2109DDC9B0d43063; // StakeDAO Multisig
	address public constant gaugeController = 0x3669C421b77340B2979d1A00a792CC2ee0FcE737;
	address public constant FXS = 0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0;
	address public constant VESDT = 0x0C30476f66034E11782938DF8e4384970B6c9e8a;
	address public constant SDT = 0x73968b9a57c6E53d41345FD57a6E6ae27d6CDB2F;
	address public constant VEBOOST = 0xD67bdBefF01Fc492f1864E61756E5FBB3f173506;
	address public fraxStrategy;
	address public sdtDistributor;
	event VaultDeployed(address proxy, address lpToken, address impl);
	event GaugeDeployed(address proxy, address stakeToken, address impl);

	constructor(
		address _gaugeImpl,
		address _fraxStrategy,
		address _sdtDistributor
	) {
		gaugeImpl = _gaugeImpl;
		fraxStrategy = _fraxStrategy;
		sdtDistributor = _sdtDistributor;
	}

	/**
	@dev Function to clone Angle Vault and its gauge contracts 
	@param _fraxGauge Frax liquidity gauge address
	 */
	function cloneAndInit(address _fraxGauge) public {
		uint256 weight = IGaugeController(gaugeController).get_gauge_weight(_fraxGauge);
		require(weight > 0, "must have weight");
		address vaultLpToken = IFraxLiquidityGauge(_fraxGauge).stakingToken();
		string memory tokenSymbol = ERC20Upgradeable(vaultLpToken).symbol();
		string memory tokenName = ERC20Upgradeable(vaultLpToken).name();
		address vaultImplAddress = _cloneAndInitVault(
			vaultImpl,
			vaultLpToken,
			governance,
			string(abi.encodePacked("sd", tokenName, " Vault")),
			string(abi.encodePacked("sd", tokenSymbol, "-vault"))
		);
		address gaugeImplAddress = _cloneAndInitGauge(gaugeImpl, vaultImplAddress, governance, tokenSymbol);
		FraxVault(vaultImplAddress).setLiquidityGauge(gaugeImplAddress);
		FraxVault(vaultImplAddress).setGovernance(governance);
		FraxStrategy(fraxStrategy).toggleVault(vaultImplAddress);
		FraxStrategy(fraxStrategy).setGauge(vaultLpToken, _fraxGauge);
		FraxStrategy(fraxStrategy).setMultiGauge(_fraxGauge, gaugeImplAddress);
		FraxStrategy(fraxStrategy).manageFee(FraxStrategy.MANAGEFEE.PERFFEE, _fraxGauge, 200); //%2 default
		FraxStrategy(fraxStrategy).manageFee(FraxStrategy.MANAGEFEE.VESDTFEE, _fraxGauge, 500); //%5 default
		FraxStrategy(fraxStrategy).manageFee(FraxStrategy.MANAGEFEE.ACCUMULATORFEE, _fraxGauge, 800); //%8 default
		FraxStrategy(fraxStrategy).manageFee(FraxStrategy.MANAGEFEE.CLAIMERREWARD, _fraxGauge, 50); //%0.5 default
		ILiquidityGaugeStrat(gaugeImplAddress).add_reward(FXS, fraxStrategy);
		ILiquidityGaugeStrat(gaugeImplAddress).commit_transfer_ownership(governance);
	}

	/**
	@dev Internal function to clone the vault 
	@param _impl address of contract to clone
	@param _lpToken angle LP token address 
	@param _governance governance address 
	@param _name vault name
	@param _symbol vault symbol
	 */
	function _cloneAndInitVault(
		address _impl,
		address _lpToken,
		address _governance,
		string memory _name,
		string memory _symbol
	) internal returns (address) {
		FraxVault deployed = cloneVault(
			_impl,
			ERC20Upgradeable(_lpToken),
			keccak256(abi.encodePacked(_governance, _name, _symbol, fraxStrategy))
		);
		deployed.init(_lpToken, address(this), _name, _symbol, FraxStrategy(fraxStrategy));
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
		deployed.initialize(_stakingToken, address(this), SDT, VESDT, VEBOOST, sdtDistributor, _stakingToken, _symbol);
		return address(deployed);
	}

	/**
	@dev Internal function that deploy and returns a clone of vault impl
	@param _impl address of contract to clone
	@param _lpToken angle LP token address
	@param _paramsHash governance+name+symbol+strategy parameters hash
	 */
	function cloneVault(
		address _impl,
		ERC20Upgradeable _lpToken,
		bytes32 _paramsHash
	) internal returns (FraxVault) {
		address deployed = address(_impl).cloneDeterministic(keccak256(abi.encodePacked(address(_lpToken), _paramsHash)));
		emit VaultDeployed(deployed, address(_lpToken), _impl);
		return FraxVault(deployed);
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
