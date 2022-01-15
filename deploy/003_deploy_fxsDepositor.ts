import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts } = hre;
	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();

	const locker = await deployments.get("FraxLocker");
	const minter = await deployments.get("sdFXSToken");

	await deploy("Depositor", {
		contract: "FxsDepositor",
		from: deployer,
		args: [locker.address, minter.address],
		log: true,
	});
};
export default func;

func.tags = ["FxsDepositor"];