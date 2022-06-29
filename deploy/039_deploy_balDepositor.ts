import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const BPT = "0x5c6Ee304399DBdB9C8Ef030aB642B10820DB8F56";
  const locker = "0xea79d1A83Da6DB43a85942767C389fE0ACf336A5";
  const minter = "0xF24d8651578a55b0C119B9910759a351A3458895";

  await deploy("BalancerDEPOSITOR", {
    contract: "BalancerDepositor",
    from: deployer,
    args: [BPT, locker, minter],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["Depositor"];
