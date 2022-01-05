# FXS Locker and veSDT

## General Understanding

Stake DAO will allow users to lock their FXS in Frax, and they will obtain sdFXS. Users, staking them into a gauge multi rewards, will earn FXS (From the Fxs Accumulator) and SDT ().

#### 2 Core Components:

1. veSDT (similar to Curve’s veCRV model) - SDT holders can now lock their SDT for maximum 4 years and get voting power proportional to their lock time (which will decrease linearly with time). 3 reasons to vote-lock SDT:

   1. use this voting power to on-chain-vote and direct SDT inflation to all strategies and vote-locking-systems (VLS or PPS) which they want to increase the total APY of
   2. get individually boosted SDT from all strategies and VLS, if they have more veSDT locked
   3. get +10% APY in sd3CRV tokens (coming from all strategies in the arch), as direct incentives for vote-locking SDT
   
      ![Screenshot 2021-12-08 at 9 17 11 PM](https://user-images.githubusercontent.com/22425782/145238612-22e9374d-baf0-4c07-8543-b1aab536ffb8.png)
      </br></br>

2. Vote Locking Systems (VLS or PPS) - a set of contracts that allows users to lock their FXS tokens (FxsLocker) in Frax via Stake DAO. The reason for users to do this via Stake DAO is coz they’ll earn maximised APY from FXS (coming from Frax) + SDT (from Stake DAO, based on their veSDT position)
   1. ![Screenshot 2021-12-08 at 9 21 02 PM](https://user-images.githubusercontent.com/22425782/145239266-d4e52cfe-62d6-4626-a0a9-516e40e060b3.png)


For first release of new arch, Strategies and VLS are focused on Frax. In the next release, we’ll probably focus on Curve.

## Smart Contracts
1. veSDT.vy (not covered by plugin): allows users to lock their SDT for a specified amount of time (max 4 years). Also allows them to increase their locked SDT amount and lock time. Additional function on top of Curve's original veCRV contract is the `deposit_for_sd()` method, which allows any address (contract or EOA) to lock more SDT for an existing address with a lock, by itself supplying those SDT. [Diffchecker](https://www.diffchecker.com/KlfDdLCk) with veCRV
2. FeeDistributor.sol
2. FxsDepositor.sol
3. sdFXSToken.sol
4. FraxLocker.sol
5. FXSAccumulator.sol
6. GaugeMultiRewards.sol
7. GaugeProxy.sol
9. ClaimContract.sol

## Setup

1. Install dependencies: `yarn install`
2. Run Docker Desktop, to compile `.vy` files. Install from [here](https://www.docker.com/products/docker-desktop) if not already installed.
2. Test veSDT contracts: `npx hardhat test test/veSDT.ts`
3. Test PPS (VLS) contracts: `npx hardhat test test/fxsDepositor.ts`

## Check Test Coverage

`npx hardhat coverage --testfiles "test/*.ts"`

![Screenshot 2021-12-08 at 9 24 47 PM](https://user-images.githubusercontent.com/2848253/147950748-619d5d8e-e6ee-48b8-ab77-5b886011043a.png)
