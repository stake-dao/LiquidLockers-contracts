import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const BPT = "0x0eC9F76202a7061eB9b3a7D6B59D36215A7e37da";
  const locker = ""; 
  const minter = "";
  const VEBPT = "0x19886A88047350482990D4EDd0C1b863646aB921";

  await deploy("BlackpoolDepositor", {
    contract: "BlackpoolDepositor",
    from: deployer,
    args: [BPT, locker, minter, VEBPT],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["BlackpoolDepositor"];
