# FXS Locker

## General Understanding

Step 1, users can start to lock their FXS in Frax finance via Stake DAO, getting sdFXS tokens in return. For every FXS locked, it will mint a new sdFXS, rate 1:1. This release also will allow sdFXS holders to vote, offchain via snapshot, for the FXS gauges allocation on Frax, once per week.

#### 2 Core Components:

![Step1](https://user-images.githubusercontent.com/2848253/149667286-cf0e2e7f-c325-4919-95b5-45b8880eee37.png)

1. FXS Locker - FXS holders can now lock their FXS via StakedDAO, via the depositor (`FxsDepositor.sol`). The DAO will create a 4 years lock, for obtaining the max veFXS amount, and the unlock time will be increased during the weeks:

   1. Users can lock FXS via the depositor, choosing if locking or not directly them through the locker (`FraxLocker.sol`).
   2. The locker can increse its unclock time.
   3. sdFXS holders can vote 

2. sdFXS - FXS lockers will obtain sdFXS with 1:1 rate, they can be used to vote, once per week, about the FXS rewards allocation on frax gauges.

## Smart Contracts (general intended behaviour)
1. **FxsDepositor.sol**: contract responsible for collecting FXS from users and locking them in frax. [Diffchecker](https://www.diffchecker.com/5Kr3DfGS) with Convex's FxsDepositor.
2. **sdFXSToken.sol**: resultant token received by users, on locking FXS via FxsDepositor. [Diffchecker](https://www.diffchecker.com/QFoCaRAo) with Convex's cvxFXSToken.
3. **FraxLocker.sol**: contract that directly interacts with frax's protocol contracts to lock FXS and also claim FXS rewards for FXS lockers. Basically manages Stake DAO's FXS lock in frax (increasing lock amount, time, etc). FxsDepositor locks FXS from users using this contract. [Diffchecker](https://www.diffchecker.com/lfcaYnlL) with Stake DAO's CRV locker [here](https://etherscan.io/address/0x52f541764E6e90eeBc5c21Ff570De0e2D63766B6#code)

## Setup

1. Install dependencies: `yarn install`
2. Run Docker Desktop, to compile `.vy` files. Install from [here](https://www.docker.com/products/docker-desktop) if not already installed.
2. Test step1: `npx hardhat test test/step1.ts`
3. Test edge cases : `npx hardhat test test/edgeCases.ts`

## Check Test Coverage

`npx hardhat coverage --testfiles "test/*.ts"`
![Coverage_step1](https://user-images.githubusercontent.com/2848253/149667184-8a6661d6-5777-4dbb-9e4a-1caa22608991.png)
