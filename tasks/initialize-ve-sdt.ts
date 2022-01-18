import { task } from "hardhat/config";

task("inititalize-ve-sdt", "").setAction(async (args, { deployments, getNamedAccounts }) => {
  const { deployer } = await getNamedAccounts();
  const { execute } = deployments;

  const SDT = "0x73968b9a57c6e53d41345fd57a6e6ae27d6cdb2f";
  const smartwhitelist = await deployments.get("SmartWalletWhitelist");

  const opts = { from: deployer };
  const params = [deployer, SDT, smartwhitelist.address, "Vote-escrowed SDT", "veSDT"];
  await execute("veSDT", opts, "inititalize", ...params);
});
