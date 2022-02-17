# Liquid Lockers

_Contracts marked **[Risky]** are either freshly developed contracts from scratch or have been made a lot of changes to, from their originally sourced contracts, and hence need to be paid special attention to while auditing and  need to be tested thoroughly_

## State of Continuous Auditing

We have considered your review suggestions from the first version of the audit and have made the necessary fixes in subsequent developments. Please find our comments to your suggestions [here](https://docs.google.com/document/d/1EHn3lKTkW_fw3_TCx6B95HJGtQrMp1i74YQ06SQwpgk/edit?usp=sharing)

The first version of audit was done on commit hash [`7e702aba329d5780ef5841f44ad699385b8b428f`](https://github.com/StakeDAO/sd-frax-veSDT/tree/7e702aba329d5780ef5841f44ad699385b8b428f), which mainly included contracts as described in Step 1 below. Specifically,
1. FxsLocker - unchanged since that hash
2. sdFXSToken.sol - unchanged since that hash
3. FxsDepositor - has been modified. [Diffchecker](https://www.diffnow.com/report/4ug2a) between previous and current version.

Since then, Step 2, Step 3 as described in detail below, have been developed which need to be audited, along with Depositor.sol, which also has been modified. Contracts with `Risk` as `High` and `To Audit?` as ✅, need to be audited with special attention.

Sr. No. | Contract | Step | Risk | WIP | Audited? | To Audit?
--- | --- | --- | --- | --- | --- | --- |
1 | Depositor.sol | 1 | High | :x: | ✅ | ✅
2 | sdToken.sol | 1 | Low | :x: | ✅ | :x:
3 | FxsLocker.sol | 1 | High | :x: | ✅ | :x:
4 | AngleLocker.sol | 1 | High | :x: | :x: | ✅
5 | veSDT.vy | 2 | Low | :x: | :x: | ✅
6 | SmartWalletWhitelist.sol | 2 | Low | :x: | :x: | ✅
7 | FeeDistributor.vy | 2 | Low | :x: | :x: | ✅
8 | TransparentUpgradeableProxy.sol | 2, 3 | Low | :x: | :x: | ✅
9 | ProxyAdmin.sol | 2, 3 | Low | :x: | :x: | ✅
10 | AccessControlUpgradeable.sol | 2, 3 | Low | :x: | :x: | ✅
11 | SdtDistributor.sol | 3 | High | ✅ | :x: | ✅
12 | GaugeController.vy | 3 | Low | :x: | :x: | ✅
13 | LiquidityGaugeV4.vy | 3 | High | ✅  | :x: | ✅
14 | FxsAccumulator.sol | 3 | High | :x: | :x: | ✅
15 | AngleAccumulator.sol | 3 | High | :x: | :x: | ✅
16 | ClaimRewards.sol | 3 | High | ✅  | :x: | ✅
17 | veBoostProxy.vy | 3 | Low | :x: | :x: | ✅

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

1. [Risky] **Depositor.sol**: contract responsible for collecting FXS from users and locking them in frax. [Diffchecker](https://www.diffnow.com/report/5apbh) with Convex's FxsDepositor.
2. **sdToken.sol**: resultant token received by users, on locking FXS via FxsDepositor. [Diffchecker](https://www.diffchecker.com/QFoCaRAo) with Convex's cvxFXSToken.
3. [Risky] **FxsLocker.sol**: contract that directly interacts with frax's protocol contracts to lock FXS and also claim FXS rewards for FXS lockers. Basically manages Stake DAO's FXS lock in frax (increasing lock amount, time, etc). FxsDepositor locks FXS from users using this contract. This contract will own all the veFXS, which will then be used to vote on and boost the upcoming frax gauges, using the `execute()` function. [Diffchecker](https://www.diffnow.com/report/hp2ug) with Stake DAO's CRV locker [here](https://etherscan.io/address/0x52f541764E6e90eeBc5c21Ff570De0e2D63766B6#code).

## Step 2

### 1 Core Component:
![Screenshot 2021-12-08 at 9 17 11 PM](https://user-images.githubusercontent.com/22425782/145238612-22e9374d-baf0-4c07-8543-b1aab536ffb8.png) </br>

**veSDT** (similar to Curve’s veCRV model, forked from [Angle's contracts](https://github.com/AngleProtocol/angle-core/tree/main/contracts/dao)) - SDT holders can now lock their SDT for maximum 4 years and get voting power proportional to their lock time (which will decrease linearly with time). 3 reasons to vote-lock SDT:

   1. use this voting power to on-chain-vote and direct SDT inflation to all strategies and lockers which they want to increase the total APY of
   2. get individually boosted SDT from all strategies and lockers, if they have more veSDT locked
   3. get +10% APY in sd3CRV tokens (coming from all strategies on top of all lockers), as direct incentives for vote-locking SDT
   
      
### Smart Contracts (general intended behaviour)
1. **veSDT.vy** [upgradable] (not covered by coverage plugin): allows users to lock their SDT for a specified amount of time (max 4 years). Also allows them to increase their locked SDT amount and lock time. Additional function on top of Angle's contract is the `deposit_for_from()` method, which allows any address (contract or EOA) to lock more SDT for an existing address with a lock, by itself supplying those SDT. [Diffchecker](https://www.diffnow.com/report/zhef8) with veANGLE
2. **FeeDistributor.vy** (not covered by coverage plugin): contract that distributes sd3CRV (Stake DAO stablecoin LP token) to all SDT lockers in veSDT. These sd3CRV are supposed to be automatically received on harvests from all strategies built on top of all lockers, but they can also be manually ERC20 transferred, until the strategies are live. [Diffchecker](https://www.diffnow.com/report/jbkz4) with Angle's FeeDistributor.
3. **SmartWalletWhitelist.sol**: contract to whitelist smart contracts to allow them to lock SDT in the veSDT contract. It can also revoke existing SDT-locking rights of contracts. [Diffchecker](https://www.diffnow.com/report/0k8fm) with Angle's SmartWalletWhitelist.
4. [**Contracts for Upgradability**](https://github.com/StakeDAO/sd-frax-veSDT/tree/feature/step3#contracts-for-upgradability)

## Step 3

### General Understanding

At this step, users will be able to vote, using veSDT, via the GaugeController, for deciding the SDT rewards allocation to different locker gauges. Also, via the LiquidityGaugeV4, users who have locked FXS, ANGLE will receive SDT, along with FXS, sanUSDC_EUR rewards respectively, and they can also boost their SDT rewards by locking more SDT (i.e. holding more veSDT). </br>

### 2 Core Components:

![Screenshot 2022-02-01 at 7 29 10 PM](https://user-images.githubusercontent.com/22425782/151983477-3154c588-a7a1-4e22-af55-a1e157d0bff8.png) </br>

1. **Gauge Voting**: users who hold veSDT, can now vote for locker gauges of frax, angle (this release) and curve (next release), to allocate proportion of SDT to each of these gauges. They'll be allowed to vote once in 10 days, which will decide the proportion of SDT going to each gauge but do note that the amount of SDT that goes to each gauge w.r.t. this proportion, can be altered daily (to start with, but this interval can also be changed).

2. **Locker Rewards**: users who have locked their FXS in frax locker and ANGLE in angle locker, receive sdX token (sdFXS, sdANGLE, sdCRV) as receipts, which they can now stake in LiquidityGaugeV4 contract, to start earning FXS, sanUSDC_EUR rewards respectively, along with SDT (coming from Masterchef). NOTE: users can boost their SDT rewards by locking more SDT in the veSDT contract.
      
### Smart Contracts (general intended behaviour)

1. [Risky] **SdtDistributor.sol** [upgradable] (WIP): This contract will receive SDT from masterchef to distribute them to all locker gauges. The amount of SDT that every gauge will receive, will be based on the veSDT voting done every 10 days on GaugeContrller contract, from where SdtDistributor will read the voting data. There will be 1 SdtDistributor for all lockers of frax + angle + curve etc. And 1 SdtDistributor for all strategies on frax + angle + curve etc (in step 4). [Diffchecker](https://www.diffnow.com/report/ewpol) with AngleDistributor.
2. **GaugeController.vy** (not covered by coverage plugin): this contract will allow veSDT holders to vote on all locker gauges, to allocate proportion of SDT to each of these gauges (i.e. frax, angle, curve). They can obtain veSDT by locking a certain amount of SDT for a fixed period of time (1 SDT: 1 veSDT at max locking time of 4 years). There will be 1 GaugeController for all lockers of frax + angle + curve etc. And 1 GaugeController for all strategies on frax + angle + curve etc (in step 4). [Diffchecker](https://www.diffnow.com/report/vynzi) with Angle's GaugeController.
3. [Risky for 1 new function] **LiquidityGaugeV4.vy** [upgradable] (not covered by coverage plugin) (WIP): It is a gauge multi rewards contract, so stakers of sdFXS, sdANGLE, sdCRV(later step) will be able to receive rewards in more than one token. In our scenario they will receive rewards in the token collected by lockers (FXS for the FxsLocker and sanUSDC_EUR for the AngleLocker) and also SDT from the SdtDistributor. This kind of gauge supports veSDT boost (i.e. users receiving more SDT as rewards when they have locked more SDT in veSDT contract) and delegation as well.
[Diffchecker](https://www.diffnow.com/report/rif07) with Angle's LiquidityGaugeV4.
4. [Risky] **Accumulator.sol**: it's a helper contract to LiquidityGaugeV4, which collects FXS rewards from multiple sources i.e. locker and strategies (for frax locker, and similarly sanUSDC_EUR for angle locker), and feeds them to LiquidityGaugeV4. It was needed cause LiquidityGaugeV4 can only have 1 source for a given reward token.
5. [Risky] **ClaimRewards.sol** (WIP): helper contract that will allow users to claim all their reward tokens i.e. (FXS, SDT) for frax locker and (sanUSDC_EUR, SDT) for angle locker in a single transaction. It also gives them the option to auto-lock reward tokens are lockable i.e. FXS in frax locker, SDT in veSDT contract.
6. **veBoostProxy.vy**: proxy contract to manage the veBoost contract (to be deployed in step 4) which will allow users to delegate their veSDT boost to other users. We need to deploy veBoostProxy in step 3 cause LiquidityGaugeV4 contract needs an immutable deployed veBoostProxy address as one of its deployment parameters. [Diffchecker](https://www.diffnow.com/report/tywlq) with Angle's veBoostProxy.
7. [**Contracts for Upgradability**](https://github.com/StakeDAO/sd-frax-veSDT/tree/feature/step3#contracts-for-upgradability)

## Contracts for Upgradability
1. **TransparentUpgradeableProxy.sol**: proxy contract that has an admin and the logic to upgrade an upgradable contract.
2. **ProxyAdmin.sol**: the dedicated Admin contract of TransparentUpgradeableProxy contracts of all upgradable contracts. It allows calling `changeAdmin()` and `upgradeTo()`/`upgradeToAndCall()`  on TransparentUpgradeableProxy.
3. **AccessControlUpgradeable.sol**: contract used by all upgradable contracts to implement access control.

## Setup

1. Install dependencies: `yarn install`
2. Run Docker Desktop, to compile `.vy` files. Install from [here](https://www.docker.com/products/docker-desktop) if not already installed.
3. Test step1: `npx hardhat test test/step1.ts`
4. Test edge cases : `npx hardhat test test/edgeCases.ts`

## Check Test Coverage

`npx hardhat coverage --testfiles "test/*.ts"`
![Coverage_step1](https://user-images.githubusercontent.com/2848253/149667184-8a6661d6-5777-4dbb-9e4a-1caa22608991.png)

## ETH Mainnet Deployed Contract Addresses

1. [FXS Depositor](https://etherscan.io/address/0x070df1b96059f5dc34fcb140ffdc8c41d6eef1ca#code)
2. [FXSLocker](https://etherscan.io/address/0xcd3a267de09196c48bbb1d9e842d7d7645ce448f#code)
3. [FXS sdToken](https://etherscan.io/address/0x402f878bdd1f5c66fdaf0fababcf74741b68ac36#code)
4. [ANGLE Depositor](https://etherscan.io/address/0x3449599Ff9Ae8459a7a24D33eee518627e8C88C9#code)
5. [AngleLocker](https://etherscan.io/address/0xD13F8C25CceD32cdfA79EB5eD654Ce3e484dCAF5#code)
6. [ANGLE sdToken](https://etherscan.io/address/0x752B4c6e92d96467fE9b9a2522EF07228E00F87c#code)
7. [FeeDistributor.vy](https://etherscan.io/address/0x29f3dd38dB24d3935CF1bf841e6b2B461A3E5D92#code)
8. [veSDT TransparentUpgradeableProxy](https://etherscan.io/address/0x0C30476f66034E11782938DF8e4384970B6c9e8a#code)
9. [veSDT Implementation](https://etherscan.io/address/0x4dcb5571024d14f017b99a7d3cedef670d4718c4#code)
8. [ProxyAdmin.sol](https://etherscan.io/address/0xfE612c237A81527a86f2Cac1FD19939CF4F91B9B#code)
9. [SmartWalletWhitelist.sol](https://etherscan.io/address/0x37E8386602d9EBEa2c56dd11d8E142290595f1b5#code)
