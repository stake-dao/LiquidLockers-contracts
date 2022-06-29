import { task } from "hardhat/config";

const pools = [
  {
    name: "EursCrv pool",
    address: "0xCD6997334867728ba14d7922f72c893fcee70e84",
    allocPoint: 203,
    added: true,
    pid: 2
  },
  {
    name: "sdeCRV pool",
    address: "0xa2761B0539374EB7AF2155f76eb09864af075250",
    allocPoint: 100,
    added: true,
    pid: 9
  },
  {
    name: "sdsteCRV pool",
    address: "0xbC10c4F7B9FE0B305e8639B04c536633A3dB7065",
    allocPoint: 18,
    added: true,
    pid: 11
  },
  {
    name: "new dummy vault",
    address: "0x3097b65f75442173ed51a2652709216141139b74",
    allocPoint: 8807,
    added: true,
    pid: 12
  },
  {
    name: "ETH CC",
    address: "0x9b8f14554f40705de7908879e2228d2ac94fde1a",
    allocPoint: 97,
    added: true,
    pid: 14
  },
  {
    name: "Liquidity Locker Gauge Proxy",
    address: "0x7367620cdb2b9eb35ab842f68dc2d397b69a96d3",
    allocPoint: 16,
    added: false,
    pid: 15
  }
];

const ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "_pid", type: "uint256" },
      { internalType: "uint256", name: "_allocPoint", type: "uint256" },
      { internalType: "bool", name: "_withUpdate", type: "bool" }
    ],
    name: "set",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },

  {
    inputs: [
      { internalType: "uint256", name: "_allocPoint", type: "uint256" },
      { internalType: "contract IERC20", name: "_lpToken", type: "address" },
      { internalType: "bool", name: "_withUpdate", type: "bool" }
    ],
    name: "add",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
];

task("update-allocation", "").setAction(async (args, { deployments, getNamedAccounts, ethers }) => {
  let iface = new ethers.utils.Interface(ABI);

  const data = pools.map(pool => {
    const d = pool.added
      ? iface.encodeFunctionData("set", [pool.pid, pool.allocPoint, false])
      : iface.encodeFunctionData("add", [pool.allocPoint, pool.address, false]);

    const signature = pool.added ? "set(uint256,uint256,bool)" : "add(uint256,address,bool)";

    return {
      name: pool.name,
      timelock: "0xD3cFc4E65a73BB6C482383EB38f5C3E1d1411616",
      target: "0xfEA5E213bbD81A8a94D0E1eDB09dBD7CEab61e1c",
      allocPoint: pool.allocPoint,
      signature,
      data: `0x${d.slice(10)}`,
      ts: 1645518601
    };
  });

  console.log("data", data);
});
