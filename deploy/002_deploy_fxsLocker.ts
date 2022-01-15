import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const ACC = "";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts } = hre;
	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();

	await deploy("Locker", {
		contract: "FraxLocker",
		from: deployer,
        args: [ACC],
		log: true,
	});
};
export default func;

func.tags = ["FraxLocker"];