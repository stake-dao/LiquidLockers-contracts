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
1. **veSDT.vy** (not covered by coverage plugin): allows users to lock their SDT for a specified amount of time (max 4 years). Also allows them to increase their locked SDT amount and lock time. Additional function on top of Curve's original veCRV contract is the `deposit_for_sd()` method, which allows any address (contract or EOA) to lock more SDT for an existing address with a lock, by itself supplying those SDT. [Diffchecker](https://www.diffchecker.com/KlfDdLCk) with veCRV
2. **FeeDistributor.vy** (not covered by coverage plugin): contract that distributes sd3CRV (Stake DAO stable) to all SDT lockers in veSDT. These sd3CRV are supposed to be automatically received on harvests from all strategies built on this new architecture, but they can also be manually ERC20 transferred, until the strategies are live. [Diffchecker](https://www.diffchecker.com/0lNYRgKh) with Curve's FeeDistributor.
2. **FxsDepositor.sol**: contract responsible for collecting FXS from users and locking them in frax. [Diffchecker](https://www.diffchecker.com/5Kr3DfGS) with Convex's CrvDepositor.
3. **sdFXSToken.sol**: resultant token received by users, on locking FXS via FxsDepositor. [Diffchecker](https://www.diffchecker.com/QFoCaRAo) with Convex's cvxCrvToken.
4. **FraxLocker.sol**: contract that directly interacts with frax's protocol contracts to lock FXS and also claim FXS rewards for FXS lockers. Basically manages Stake DAO's FXS lock in frax (increasing lock amount, time, etc). FxsDepositor locks FXS from users using this contract. [Diffchecker](https://www.diffchecker.com/lfcaYnlL) with Stake DAO's CRV locker [here](https://etherscan.io/address/0x52f541764E6e90eeBc5c21Ff570De0e2D63766B6#code)
5. **FXSAccumulator.sol**: contract that takes FXS from FxsLocker and strategies on frax, and feeds them to GaugeMultiRewards contract of PPS (FXS locker)
6. **GaugeMultiRewards.sol**: contract responsible for providing FXS, SDT rewards to FXS lockers (and also to strategy depositors planned to be released in phase 2). [Diffchecker](https://www.diffchecker.com/v63pVADq) with Curve's MultiRewards.
7. **GaugeProxy.sol**: contract responsible for distributing SDT to all GaugeMultiRewards contracts based on votes from veSDT lockers. Voting to decide proportion of SDT to each GaugeMultiRewards also happens via this contract. There will be 1 GaugeProxy contract for FXS locking system and 1 GaugeProxy contract for the strategies system (to be released in phase 2). [Diffchecker](https://diffnow.com/report/iuqjz) with Pickle's GaugeProxy.
9. **ClaimContract.sol**: to allow users to claim all reward tokens i.e. FXS, SDT from all GaugeMultiRewards in 1 txn (because there will be 1 GaugeMultiRewards per vote locking system i.e. Frax for this release and Curve, Sushi for future releases and 1 GaugeMultiRewards per strategy on each system i.e. there will be 5 strategies on frax and each will have 1 GaugeMultiRewards, then in the future, there can be 7 strategies on Curve and each of them will have 1 GaugeMultiRewards)

## Setup

1. Install dependencies: `yarn install`
2. Run Docker Desktop, to compile `.vy` files. Install from [here](https://www.docker.com/products/docker-desktop) if not already installed.
2. Test veSDT contracts: `npx hardhat test test/veSDT.ts`
3. Test PPS (VLS) contracts: `npx hardhat test test/fxsDepositor.ts`

## Check Test Coverage

`npx hardhat coverage --testfiles "test/*.ts"`

![Screenshot 2021-12-08 at 9 24 47 PM](https://user-images.githubusercontent.com/2848253/147950748-619d5d8e-e6ee-48b8-ab77-5b886011043a.png)
