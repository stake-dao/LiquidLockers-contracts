// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "forge-std/Script.sol";

import { TransparentUpgradeableProxy } from "contracts/external/TransparentUpgradeableProxy.sol";
import { BlackpoolDepositor } from "contracts/depositors/BlackpoolDepositor.sol";
import { BlackpoolAccumulator } from "contracts/accumulators/BlackPoolAccumulator.sol";
import { ILiquidityGauge } from "contracts/interfaces/ILiquidityGauge.sol";
import { BlackpoolLocker } from "contracts/lockers/BlackpoolLocker.sol";
import { sdToken } from "contracts/tokens/sdToken.sol";

contract DeployBlackpoolStack is Script, Test {
	sdToken sdBPT;
	BlackpoolAccumulator blackpoolAccumulator;
	TransparentUpgradeableProxy transparentUpgradeableProxy;

	BlackpoolDepositor blackpoolDepositor;

	address constant SDT = 0x73968b9a57c6E53d41345FD57a6E6ae27d6CDB2F;
	address constant VESDT = 0x0C30476f66034E11782938DF8e4384970B6c9e8a;
	address constant BOOSTPROXY = 0xD67bdBefF01Fc492f1864E61756E5FBB3f173506;
	address constant GAUGE_IMPL = 0x93c951D3281Cc79e9FE1B1C87e50693D202F4C17;
	address constant SDTDISTRIBUTOR = 0x8Dc551B4f5203b51b5366578F42060666D42AB5E;
	address constant PROXYADMIN = 0xfE612c237A81527a86f2Cac1FD19939CF4F91B9B;
	address constant ADMIN = 0x0dE5199779b43E13B3Bec21e91117E18736BC1A8;
	address constant BPTLOCKER = 0x0a4dF7809F83e130D8ffa297f03b75318E37B461;
	address constant BPT = 0x0eC9F76202a7061eB9b3a7D6B59D36215A7e37da;
	address constant VEBPT = 0x19886A88047350482990D4EDd0C1b863646aB921;
	address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

	function run() public {
		vm.startBroadcast();
		sdBPT = new sdToken("Stake DAO BPT", "sdBPT");

		blackpoolDepositor = new BlackpoolDepositor(BPT, BPTLOCKER, address(sdBPT), VEBPT);
		// Simple Contract without argument.
		// Store the var if you want to retrive the address for a next deployment.
		transparentUpgradeableProxy = new TransparentUpgradeableProxy(
			GAUGE_IMPL,
			PROXYADMIN,
			abi.encodeWithSignature(
				"initialize(address,address,address,address,address,address)",
				address(sdBPT),
				ADMIN,
				SDT,
				VESDT,
				BOOSTPROXY,
				SDTDISTRIBUTOR
			)
		);

		blackpoolDepositor.setGauge(address(transparentUpgradeableProxy));
		sdBPT.setOperator(address(blackpoolDepositor));
		BlackpoolLocker(BPTLOCKER).setBptDepositor(address(blackpoolDepositor));
		// Launch "forge script scripts/example/Example.s.sol -vvvv --private-key $PRIVATE_KEY" to test the script.
		// To broadcast the transaction in desired network, add --broadcast.
		blackpoolAccumulator = new BlackpoolAccumulator(WETH, address(transparentUpgradeableProxy));
		ILiquidityGauge(address(transparentUpgradeableProxy)).add_reward(WETH, address(blackpoolAccumulator));
		BlackpoolLocker(BPTLOCKER).setAccumulator(address(blackpoolAccumulator));
		blackpoolAccumulator.setLocker(BPTLOCKER);
		vm.stopBroadcast();
	}
}
