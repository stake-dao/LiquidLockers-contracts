import { ParamType, parseEther } from "ethers/lib/utils";
import { ethers, network } from "hardhat";

// How to use
// await writeBalance(SAN_DAI_EUR, "1", deployer._address);

export async function writeBalance(tokenAddress: string, amount: string, recipient: string) {
  const encode = (types: readonly (string | ParamType)[], values: readonly any[]) =>
    ethers.utils.defaultAbiCoder.encode(types, values);
  const account = ethers.constants.AddressZero;
  const probeA = encode(['uint'], [1]);
  const probeB = encode(['uint'], [2]);
  const token = await ethers.getContractAt(
    'ERC20',
    tokenAddress
  );
  for (let i = 0; i < 100; i++) {
    let probedSlot = ethers.utils.keccak256(
      encode(['address', 'uint'], [account, i])
    );

    while (probedSlot.startsWith('0x0'))
      probedSlot = '0x' + probedSlot.slice(3);
    const prev = await network.provider.send(
      'eth_getStorageAt',
      [tokenAddress, probedSlot, 'latest']
    );

    const probe = prev === probeA ? probeB : probeA;

    await network.provider.send("hardhat_setStorageAt", [
      tokenAddress,
      probedSlot,
      probe
    ]);

    const balance = await token.balanceOf(account);

    if (balance.eq(ethers.BigNumber.from(probe))) {
      // Get storage slot index
      const index = ethers.utils.solidityKeccak256(
        ["uint256", "uint256"],
        [recipient, i] // key, slot
      );

      await network.provider.send("hardhat_setStorageAt", [
        tokenAddress,
        index.toString(),
        encode(['uint'], [parseEther(amount)])
      ]);
      return i;
    }

  }
  throw 'Balances slot not found!';
}

export async function skip(seconds: number) {
  await network.provider.send("evm_increaseTime", [seconds]);
  await network.provider.send("evm_mine", []);
}