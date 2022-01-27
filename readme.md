# FXS Locker

## Step 1

### General Understanding

Users can start to lock their FXS in Frax finance via Stake DAO, getting sdFXS tokens in return. For every FXS locked, it will mint a new sdFXS, rate 1:1. This release also will allow sdFXS holders to vote, offchain via snapshot, for the FXS gauges allocation on Frax, once per week.

### 2 Core Components:

![Step1](https://user-images.githubusercontent.com/2848253/149667286-cf0e2e7f-c325-4919-95b5-45b8880eee37.png)

1. FXS Locker - FXS holders can now lock their FXS via StakedDAO, via the depositor (`FxsDepositor.sol`). The DAO will create a 4 years lock, for obtaining the max veFXS amount, and the unlock time will be increased during the weeks:

   1. Users can lock FXS via the depositor, choosing if locking or not directly them through the locker (`FxsLocker.sol`).
   2. The locker can increse its unclock time.
   3. sdFXS holders can vote

2. sdFXS - FXS lockers will obtain sdFXS with 1:1 rate, they can be used to vote, once per week, about the FXS rewards allocation on frax gauges.

### Smart Contracts (general intended behaviour)

1. **Depositor.sol**: contract responsible for collecting FXS from users and locking them in frax. [Diffchecker](https://www.diffnow.com/report/5apbh) with Convex's FxsDepositor. [Mainnet address](https://etherscan.io/address/0x070df1b96059f5dc34fcb140ffdc8c41d6eef1ca#code)
2. **sdToken.sol**: resultant token received by users, on locking FXS via FxsDepositor. [Diffchecker](https://www.diffchecker.com/QFoCaRAo) with Convex's cvxFXSToken. [Mainnet address](https://etherscan.io/address/0x402f878bdd1f5c66fdaf0fababcf74741b68ac36#code)
3. **FxsLocker.sol**: contract that directly interacts with frax's protocol contracts to lock FXS and also claim FXS rewards for FXS lockers. Basically manages Stake DAO's FXS lock in frax (increasing lock amount, time, etc). FxsDepositor locks FXS from users using this contract. This contract will own all the veFXS, which will then be used to vote on and boost the upcoming frax gauges, using the `execute()` function. [Diffchecker](https://www.diffnow.com/report/hp2ug) with Stake DAO's CRV locker [here](https://etherscan.io/address/0x52f541764E6e90eeBc5c21Ff570De0e2D63766B6#code). [Mainnet address](https://etherscan.io/address/0xcd3a267de09196c48bbb1d9e842d7d7645ce448f#code)

## Step 2

### 1 Core Component:
![Screenshot 2021-12-08 at 9 17 11 PM](https://user-images.githubusercontent.com/22425782/145238612-22e9374d-baf0-4c07-8543-b1aab536ffb8.png) </br>

**veSDT** (similar to Curve’s veCRV model, forked from [Angle's contracts](https://github.com/AngleProtocol/angle-core/tree/main/contracts/dao)) - SDT holders can now lock their SDT for maximum 4 years and get voting power proportional to their lock time (which will decrease linearly with time). 3 reasons to vote-lock SDT:

   1. use this voting power to on-chain-vote and direct SDT inflation to all strategies and lockers which they want to increase the total APY of
   2. get individually boosted SDT from all strategies and lockers, if they have more veSDT locked
   3. get +10% APY in sd3CRV tokens (coming from all strategies on top of all lockers), as direct incentives for vote-locking SDT
   
      
### Smart Contracts (general intended behaviour)
1. **veSDT.vy** (not covered by coverage plugin): allows users to lock their SDT for a specified amount of time (max 4 years). Also allows them to increase their locked SDT amount and lock time. Additional function on top of Angle's contract is the `deposit_for_from()` method, which allows any address (contract or EOA) to lock more SDT for an existing address with a lock, by itself supplying those SDT. [Diffchecker](https://www.diffnow.com/report/zhef8) with veANGLE
2. **FeeDistributor.vy** (not covered by coverage plugin): contract that distributes sd3CRV (Stake DAO stablecoin LP token) to all SDT lockers in veSDT. These sd3CRV are supposed to be automatically received on harvests from all strategies built on top of all lockers, but they can also be manually ERC20 transferred, until the strategies are live. [Diffchecker](https://www.diffnow.com/report/jbkz4) with Angle's FeeDistributor.
3. **SmartWalletWhitelist.sol**: contract to whitelist smart contracts to allow them to lock SDT in the veSDT contract. It can also revoke existing SDT-locking rights of contracts. [Diffchecker](https://www.diffnow.com/report/0k8fm) with Angle's SmartWalletWhitelist.


## Setup

1. Install dependencies: `yarn install`
2. Run Docker Desktop, to compile `.vy` files. Install from [here](https://www.docker.com/products/docker-desktop) if not already installed.
3. Test step1: `npx hardhat test test/step1.ts`
4. Test edge cases : `npx hardhat test test/edgeCases.ts`

## Check Test Coverage

`npx hardhat coverage --testfiles "test/*.ts"`
![Coverage_step1](https://user-images.githubusercontent.com/2848253/149667184-8a6661d6-5777-4dbb-9e4a-1caa22608991.png)
