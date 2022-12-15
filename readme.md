# Liquid Lockers

## Installation

Install Foundry:
```bash
   # This will install Foundryup
   curl -L https://foundry.paradigm.xyz | bash
   # Then Run
   foundryup
```

Install Dependencies:
```bash
   forge install
   yarn
```

Build:
```bash
   yarn build
```

Test:
```bash
   yarn test (hh test files)
   yarn test:foundry (foundry test files)
```

See package.json for more commands.

## Architecture Overview (3 core components)</br>

### 1 - Liquid Lockers</br>
![liquid-locker-diagram](https://user-images.githubusercontent.com/55331875/207043343-218480fb-d25d-4f49-b296-56e755a80aca.png)

#### General Understanding

It is one of the core features of the new architecture released by Stake DAO, it enables the way to lock (irreversible action) tokens that supports a ve tokenomics (CRV, FXS, ecc) via Stake DAO, getting sdToken tokens in return. For every token locked, it will mint a new sdToken, with rate 1:1. For example, an user can lock 1 FXS to obtain 1 sdFXS. It would allow sdToken holders to claim rewards and to vote, offchain via snapshot, for the gauges allocation on the related platform, once per week.

1. Locker - Token holders can now lock their tokens via he depositor (`Depositor.sol`). Contract will create/increase a x years lock depending of the max year lock allowed in the targeted platform, for obtaining the max veToken amount, and the unlock time will be increased during the weeks:

   1. Users can lock Token via the depositor, choosing if locking or not directly them through the lockers.
   2. The locker can increse its unclock time.
   3. sdToken holders can vote.

2. sdToken - Token lockers will obtain sdToken with 1:1 rate, they can be used to vote, once per week, about the Token rewards allocation on targeted platform gauges or any governance proposals.
3. Token Accumulator - At every claim, it will manage the way to obtain the tokens and notify them as new 7 days reward period.

#### Locker Released
   1. Frax (Audited)
   2. Angle (Audited)
   3. Curve(Audited)
   4. Balancer
   5. Ap Wine
   6. BlackPool
   7. Yearn (Coming Soon)

#### Smart Contracts (general intended behaviour)

1. **Depositors**: contracts responsible for collecting tokens from users and locking them via the related locker.
2. **sdToken.sol**: resultant token received by users, with a 1:1 rate.
3. **Lockers**: contracts that directly interacts with the related protocol contracts to lock the token and also claim the rewards for the lockers. Basically manages Stake DAO's lock position in the platform, like curve or frax, increasing the lock amount, unlock time, etc. The depositor locks the token from users using this contract. This contract will own all the related veToken, which will then be used to vote on and boost the gauges, using the `execute()` function.
4. **Accumulators**: it's a helper contract to LiquidityGaugeV4, which receives token rewards from locker and other rewards from strategies, and notifies them to LiquidityGaugeV4.
5. **LiquidityGaugeV4.vy** [upgradable] (not covered by coverage plugin): It is a gauge multi rewards contract, so stakers of sdFXS, sdANGLE, sdCRV(later step) will be able to receive rewards in more than one token. In our scenario they will receive rewards in the token collected by lockers (FXS for the FxsLocker and sanUSDC_EUR for the AngleLocker) and also SDT from the SdtDistributor. This kind of gauge supports veSDT boost (i.e. users receiving more SDT as rewards when they have locked more SDT in veSDT contract) and delegation as well.
[Diffchecker](https://www.diffnow.com/report/rif07) with Angle's LiquidityGaugeV4.

### 2 - Governance</br>
![Governance](https://user-images.githubusercontent.com/55331875/207043501-ab236e12-0643-46d8-aa70-8c425b120ef1.png)

At this step, users will be able to vote, using veSDT, via the GaugeController, for deciding the SDT rewards allocation to different locker gauges. Also, via the LiquidityGaugeV4, users who have locked any token, will receive SDT, along with other extra tokens like FXS, agEUR, CRV rewards, and they can also boost their SDT rewards by locking more SDT (i.e. holding more veSDT). </br>

**veSDT** (similar to Curve’s veCRV model, forked from [Angle's contracts](https://github.com/AngleProtocol/angle-core/tree/main/contracts/dao)) - SDT holders can now lock their SDT for maximum 4 years and get voting power proportional to their lock time (which will decrease linearly with time). 3 reasons to vote-lock SDT:

   1. use this voting power to on-chain-vote and direct SDT inflation to all strategies and lockers which they want to increase the total APY of
   2. get individually boosted SDT from all strategies and lockers, if they have more veSDT locked
   3. get +10% APY in sdFRAX3CRV tokens (coming from all strategies on top of all lockers), as direct incentives for vote-locking SDT

1. **Gauge Voting**: users who hold veSDT, can now vote for locker gauges of frax, angle (this release) and curve (next release), to allocate proportion of SDT to each of these gauges. They'll be allowed to vote once in 10 days, which will decide the proportion of SDT going to each gauge but do note that the amount of SDT that goes to each gauge w.r.t. this proportion, can be altered daily (to start with, but this interval can also be changed).

#### Smart Contracts (general intended behaviour)
1. **veSDT.vy** [upgradable] (not covered by coverage plugin): allows users to lock their SDT for a specified amount of time (max 4 years). Also allows them to increase their locked SDT amount and lock time. Additional function on top of Angle's contract is the `deposit_for_from()` method, which allows any address (contract or EOA) to lock more SDT for an existing address with a lock, by itself supplying those SDT. [Diffchecker](https://www.diffnow.com/report/zhef8) with veANGLE
2. **FeeDistributor.vy** (not covered by coverage plugin): contract that distributes sd3CRV (Stake DAO stablecoin LP token) to all SDT lockers in veSDT. These sdFRAX3CRV are supposed to be automatically received on harvests from all strategies built on top of all lockers, but they can also be manually ERC20 transferred, until the strategies are live. [Diffchecker](https://www.diffnow.com/report/jbkz4) with Angle's FeeDistributor.
3. **SmartWalletWhitelist.sol**: contract to whitelist smart contracts to allow them to lock SDT in the veSDT contract. It can also revoke existing SDT-locking rights of contracts. [Diffchecker](https://www.diffnow.com/report/0k8fm) with Angle's SmartWalletWhitelist.
4. **GaugeController.vy** (not covered by coverage plugin): this contract will allow veSDT holders to vote on all locker gauges, to allocate proportion of SDT to each of these gauges (i.e. frax, angle, curve). They can obtain veSDT by locking a certain amount of SDT for a fixed period of time (1 SDT: 1 veSDT at max locking time of 4 years). There will be 1 GaugeController for all lockers of frax + angle + curve etc. And 1 GaugeController for all strategies on frax + angle + curve etc (in step 4). [Diffchecker](https://www.diffnow.com/report/vynzi) with Angle's GaugeController.
5. **SdtDistributor.sol** [upgradable]: This contract will receive SDT from masterchef to distribute them to all locker gauges. The amount of SDT that every gauge will receive, will be based on the veSDT voting done every 10 days on GaugeContrller contract, from where SdtDistributor will read the voting data. There will be 1 SdtDistributor for all lockers of frax + angle + curve etc. And 1 SdtDistributor for all strategies on frax + angle + curve etc (in step 4). [Diffchecker](https://www.diffnow.com/report/ev2sp) with AngleDistributor.
6. **veBoostProxy.vy**: proxy contract to manage the veBoost contract (to be deployed in step 4) which will allow users to delegate their veSDT boost to other users. We need to deploy veBoostProxy in step 3 cause LiquidityGaugeV4 contract needs an immutable deployed veBoostProxy address as one of its deployment parameters. [Diffchecker](https://www.diffnow.com/report/tywlq) with Angle's veBoostProxy.
7. [**Contracts for Upgradability**](https://github.com/StakeDAO/sd-frax-veSDT/tree/feature/step3#contracts-for-upgradability)

### 3 - Strategies</br>
![strategy-breakdown-diagram](https://user-images.githubusercontent.com/55331875/207043611-df719a4b-8ad6-439e-a9b4-60b091c2210e.png)

#### General Understanding

To be able to enjoy the boosting provided by the Lockers, user can deposit into StakeDAO Strategies. Each strategy is associated to a Vault, LiquidityGaugeV4Strat, Strategy. User deposit its LP into the Vault. The latter mint and stake into LGV4Strat receipt token at a 1:1 rate and send Token LP to the Strategy. Strategy socialize deposit for every users by depositing at once through the Locker in the targeted platform (Curve, Angle etc.).

Each week, anyone can claim the rewards that would be distributed in a 7 days period in the LGV4Strat Gauge to the users.

#### Smart Contracts (general intended behaviour)
1. **Vaults** : allows users to lock deposit/withdraw LPs. It will mint the related sdLp token to stake into the LGV4. For strategies, only the vault contract will be able to stake and withdraw them via the LGV4.
2. **Strategies** : contracts used to deposit/withdraw any LP supported by a platform's gauge, on behalf of the locker, to obtain the boost. It also needs to manage the `harvest()` claiming the native reward token plus extra rewards, and finally notify the amount as reward to the related sdLP LGV4.  

## Contracts for Upgradability
These contracts are being directly used from [Openzeppelin's Upgradable Contracts](https://docs.openzeppelin.com/contracts/4.x/api/proxy#TransparentUpgradeableProxy)
1. **TransparentUpgradeableProxy.sol**: proxy contract that has an admin and the logic to upgrade an upgradable contract.
2. **ProxyAdmin.sol**: the dedicated Admin contract of TransparentUpgradeableProxy contracts of all upgradable contracts. It allows calling `changeAdmin()` and `upgradeTo()`/`upgradeToAndCall()`  on TransparentUpgradeableProxy.
3. **AccessControlUpgradeable.sol**: contract used by all upgradable contracts to implement access control.

## State of Continuous Auditing

The repo code has been audited in 2 different previous slots.

- First audit (14 of January 2022):
   -  commit hash [`7e702aba329d5780ef5841f44ad699385b8b428f`](https://github.com/StakeDAO/LiquidLockers-contracts/tree/7e702aba329d5780ef5841f44ad699385b8b428f)
   -  contracts in scope:
      - `FxsLocker.sol`
      - `FxsDepositor.sol`
      - `sdToken.sol`
- Second audit (27 of April 2022):
   -  commit hash [`68b71a7b982d302627766d684d181bb8bb202572`](https://github.com/StakeDAO/LiquidLockers-contracts/tree/68b71a7b982d302627766d684d181bb8bb202572)
   -  contracts in scope:
      - `AngleAccumulator.sol`
      - `AngleLocker.sol`
      - `BaseAccumulator.sol`
      - `ClaimRewards.sol`
      - `CurveAccumulator.sol`
      - `Depositor.sol`
      - `FeeDistributor.vy`
      - `FxsAccumulator.sol`
      - `GaugeController.vy`
      - `LiquidityGaugeV4.vy`
      - `SmartWalletWhitelist.sol`
      - `SdtDistributor.sol`
      - `veBoostProxy.vy`
      - `veSDT.vy`

### Contracts in scope
Sr. No. | Contract | Core | Lines of code
--- | --- | --- | --- |
1 | AngleStrategy.sol | Strategy | 187
2 | AngleVault.sol | Strategy | 125
3 | AngleVaultGUni.sol | Strategy | 135
3 | BalancerStrategy.sol | Strategy | 253
4 | BalancerVault.sol | Strategy | 200
5 | CurveStrategy.sol | Strategy | 155
6 | BaseStrategy.sol | Strategy | 69
7 | LiquidityGaugeV4Strat.vy | Strategy | 667

Vault contracts (230 lines) -> The contracts have around 125 common lines without any difference. The `BalancerVault.sol` contract has defines an extra function, `provideLiquidityAndDeposit()` to manage directly underlying tokens, and it has got 75 extra lines. Instead the curve vault has defines a `setCurveStrategy()` function to manage the strategy migration. The other 2 vaults can't manage directly an LP migration. Also we defined a GUni angle vault version to manage the scaling factor.

Diffchecker

[AngleVault<->AngleVaultGUni](https://www.diffchecker.com/4Zpj0yrZ)

[AngleVault<->BalancerVault](https://www.diffchecker.com/aY39r9Bw)

[AngleVault<->CurveVault](https://www.diffchecker.com/wP2VH3RZ)

Strategy contracts (350 lines) -> The contracts have around 230 common lines of code, the `BalancerStrategy.sol` has defined 20 extra lines to include a different logic fot claiming the platform's native token (BAL), the claiming follow the same logic than in curve, where new tokens would be mint at every claim. The `CurveStrategy.sol` instead needs to manage different type of liquidity gauges, and also the weekly 3CRV claim has managed by this contract, because the curve locker contract has not defined a function to claim them. it required another 90 lines of code.

Diffchecker

[AngleStrategy<->BalancerStrategy](https://www.diffchecker.com/Xs1ACaAC)

[AngleStrategy<->CurveStrategy](https://www.diffchecker.com/op2b1qUY)

Liquidity Gauge (20 lines) -> Since that the original `LiquidityGaugeV4.vy` has been already audited in the previous slots, for this version we just included a logic to give the way only to a vault contract for depositing/withdrawing the related staking LP token. 

Diffchecker

[LiquidityGaugeV4<->LiquidityGaugeV4Strat](https://www.diffchecker.com/t8LD4kVY)

Total lines to be reviewed: 670 

### Contracts out of scope

Since that the entire flow for 3 lockers (Frax/Angle/Curve) have been already audited in the previous slots, and the contracts code is almost the same for the other ones not included, we decided to omit the remaining contracts related to LL for the new slot.

Sr. No. | Contract | Platform | Core Type |
--- | --- | --- | --- |
1 | AngleAccumulatorV2.sol | Angle | LL |
2 | AngleAccumulatorV3.sol | Angle | LL |
4 | AngleVoter.sol | Angle | LL
5 | AngleVoterV2.sol | Angle | LL
3 | AngleVaultFactory.sol | Angle | Strategy |
4 | veSDTFeeAngleProxy.sol | Angle | Strategy |
5 | ApWineAccumulator.sol | Ap Wine | LL |
6 | ApWineDepositor.sol | Ap Wine | LL |
7 | ApwineLocker.sol | Ap Wine | LL |
7 | BalancerAccumulator.sol | Balancer | LL |
8 | BalancerAccumulatorV2.sol | Balancer | LL |
9 | BalancerDepositor.sol | Balancer | LL |
10 | BalancerLocker.sol | Balancer | LL
10 | BalancerVoter.sol | Balancer | LL |
10 | BalancerVaultFactory.sol | Balancer | Strategy |
11 | veSDTFeeBalancerProxy.sol | Balancer | Strategy |
12 | BlackPoolAccumulator.sol | Black Pool | LL |
13 | BlackPoolDepositor.sol | Black Pool | LL |
10 | BlackPoolLocker.sol | Black Pool | LL | 
14 | CrvDepositor.sol | Curve | LL |
15 | sdCrv.sol | Curve | LL |
10 | CurveVoter.sol | Curve | LL |
10 | CurveVoterV2.sol | Curve | LL |
16 | CurveVaultFactory | Curve | Strategy |
17 | veSdtFeeCurveProxy.sol | Curve | Strategy |
10 | FraxVoter.sol | Frax | LL
18 | FraxProxyFactory.sol | Frax | Strategy 
19 | veSdtFeeFraxProxy.sol | Frax | Strategy |
20 | YearnAccumulator.sol | Yearn | LL |
21 | YearnLocker.sol | Year | LL |
20 | DepositorV2.sol | All | LL |

## ETH Mainnet Deployed Contract Addresses

- [veSDT Implementation](https://etherscan.io/address/0x4dcb5571024d14f017b99a7d3cedef670d4718c4#code)
- [veSDT TransparentUpgradeableProxy](https://etherscan.io/address/0x0C30476f66034E11782938DF8e4384970B6c9e8a#code)
- [FeeDistributor](https://etherscan.io/address/0x29f3dd38dB24d3935CF1bf841e6b2B461A3E5D92#code)

### Liquid Lockers

LL | Locker | Depositor | sdToken | sdToken LGV4 | Accumulator
--- | --- | --- | --- | --- | --- |
Frax|[0xcd3...48f](https://etherscan.io/address/0xcd3a267de09196c48bbb1d9e842d7d7645ce448f#code)|[0xFaF...285](https://etherscan.io/address0xFaF3740167B866b571465B063c6B3A71Ba9b6285#code)|[0x402...c36](https://etherscan.io/address/0x402f878bdd1f5c66fdaf0fababcf74741b68ac36#code)|[0xF3C...106](https://etherscan.io/address/0xF3C6e8fbB946260e8c2a55d48a5e01C82fD63106#code)|[0xcA5...008](https://etherscan.io/address/0xcA53fe979D427a7C2C5F45f54D9d9fAE622B4008#code)
Angle|[0xD13...AF5](https://etherscan.io/address/0xD13F8C25CceD32cdfA79EB5eD654Ce3e484dCAF5#code)|[0x8A9...121](https://etherscan.io/address/0x8A97e8B3389D431182aC67c0DF7D46FF8DCE7121#code)|[0x752...87c](https://etherscan.io/address/0x752B4c6e92d96467fE9b9a2522EF07228E00F87c#code)|[0xE55..5d5](https://etherscan.io/address/0xE55843a90672f7d8218285e51EE8fF8E233F35d5#code)|[0x5Ed...D2E](https://etherscan.io/address/0x5Ed81291A4B978A25bEA88B0c40Cb42d63F72D2E#code)
Curve|[0x52f...6B6](https://etherscan.io/address/0x52f541764E6e90eeBc5c21Ff570De0e2D63766B6#code)|[0xc1e...191](https://etherscan.io/address/0xc1e3Ca8A3921719bE0aE3690A0e036feB4f69191#code)|[0xD1b...bB5](https://etherscan.io/address/0xD1b5651E55D4CeeD36251c61c50C889B36F6abB5#code)|[0x7f5...466](https://etherscan.io/address/0x7f50786A0b15723D741727882ee99a0BF34e3466#code)|[0xa44...466](https://etherscan.io/address/0xa44bFD194Fd7185ebecEcE4F7fA87a47DaA01c6A#code)
Balancer|[0xea7...6A5](https://etherscan.io/address/0xea79d1A83Da6DB43a85942767C389fE0ACf336A5#code)|[0x3e0...D2E](https://etherscan.io/address/0x3e0d44542972859de3CAdaF856B1a4FD351B4D2E#code)|[0xF24...895](https://etherscan.io/address/0xF24d8651578a55b0C119B9910759a351A3458895#code)|[0x3E8...859](https://etherscan.io/address/0x3E8C72655e48591d93e6dfdA16823dB0fF23d859#code)|[0x99e...0C4](https://etherscan.io/address/0x99e8cBa4e91aDeA2C9321344e33FCCCBfBA9b0C4#code)
Ap Wine|[0xE71...21d](https://etherscan.io/address/0xE71e28a510bC3F98a9E77e847aE5AEF9a2e5721d#code)|[0xFe9...BCf](https://etherscan.io/address/0xFe928ca6a9C0cdf658a26A374b7373B9D6CefBCf#code)|[0x26f...70D](https://etherscan.io/address/0x26f01FE3BE55361b0643bc9d5D60980E37A2770D#code)|[0x9c9...4E0](https://etherscan.io/address/0x9c9d06C7378909C6d0A2A0017Bb409F7fb8004E0#code)|[0xc50...fe5](https://etherscan.io/address/0xc50f67DB3a63641a57d2d3DE9FdA6767E999Efe5#code)
Blackpool|[0x0a4...461](https://etherscan.io/address/0x0a4dF7809F83e130D8ffa297f03b75318E37B461#code)|[0x219...993](https://etherscan.io/address/0x219f7496fbD30e1F21A20613F9372d608A279993#code)|[0x825...f73](https://etherscan.io/address/0x825Ba129b3EA1ddc265708fcbB9dd660fdD2ef73#code)|[0xa29...865](https://etherscan.io/address/0xa291faEEf794df6216f196a63F514B5B22244865#code)|[0xfAC...fBc](https://etherscan.io/address/0xfAC788261DA6E2aFfCD0e9AB340395378F8CBfBc#code) 
Yearn|[Locker](/contracts/YearnLocker.sol)|[Depositor](/contracts/locking/DepositorV2.sol)|[sdToken](/contracts/locking/sdToken.sol)|[Gauge](/contracts/staking/LiquidityGaugeV4.vy)|[Accumulator](/contracts/accumulator/YearnAccumulator.sol)|

- [SdtDistributor](https://etherscan.io/address/0x9C99dffC1De1AfF7E7C1F36fCdD49063A281e18C#code)
- [GaugeController](https://etherscan.io/address/0x9C99dffC1De1AfF7E7C1F36fCdD49063A281e18C#code)

### Strategies

LL | Vault Impl | Strategy
--- | --- | --- |
Angle|[0xc76...6E4](https://etherscan.io/address/0xc769c19ADa2B6B0f33B37124Fd6523659a0db6E4#code)|[0x226...CAF](https://etherscan.io/address/0x22635427C72e8b0028FeAE1B5e1957508d9D7CAF#code)
Curve|[0x63a...3cc](https://etherscan.io/address/0x63af3c5e7ba65f751f5739607db87e2f829bf3cc#code)|[0x20F...ED6](https://etherscan.io/address/0x20F1d4Fed24073a9b9d388AfA2735Ac91f079ED6#code)
Balancer|[0x417...3e1](https://etherscan.io/address/0x417690832AB2974Ea4F077795dC6d0Ba2523f3e1#code)|[0x873...19d](https://etherscan.io/address/0x873b031Ea6E4236E44d933Aae5a66AF6d4DA419d#code)

- [SdtDistributor](https://etherscan.io/address/0x9C99dffC1De1AfF7E7C1F36fCdD49063A281e18C#code)
- [GaugeController](https://etherscan.io/address/0x9C99dffC1De1AfF7E7C1F36fCdD49063A281e18C#code)
- [LGV4 Impl](https://etherscan.io/address/0x3Dc56D46F0Bd13655EfB29594a2e44534c453BF9#code) (Angle/Curve/Balancer strategies)
- [LGV4 Impl](https://etherscan.io/address/0x6aDb68d8C15954aD673d8f129857b34dc2F08bf2#code) (Frax strategies)

### Utility

LL | Vault Factory | veSDTFeeProxy | Voter
--- | --- | --- | --- |
Angle|[0x66f...801](https://etherscan.io/address/0x66f3d3210F84fe8cC2c77A1f001a395b2Ae0B801#code)|[0xe92...054](https://etherscan.io/address/0xe92aa77c3d8c7347950b2a8d4b2a0adbf0c31054#code)|[0x103...Ab8](https://etherscan.io/address/0x103A24aDF3c60E29eCF4D05ee742cAdc7BA3fAb8#code)
Curve|[0x566...969](https://etherscan.io/address/0x5662e299147336b31b82ef37a76207d53c97a969#code)|[0x6e3...46f](https://etherscan.io/address/0x6e37f0f744377936205610591eb8787d7be7946f#code)|[0x102...237](https://etherscan.io/address/0x102A4eD45395e065390173E900d1a76A589E0237#code)
Balancer|[0x6e3...46f](https://etherscan.io/address/0x6e37f0f744377936205610591eb8787d7be7946f#code)|[0xf94...39d](https://etherscan.io/address/0xf94492a9efee2a6a82256e5794c988d3a711539d#code)|[0xff0...1Ff](https://etherscan.io/address/0xff09A9b50A4E9b9AB95D2DCb552E8469f9c891Ff#code)

- [ClaimReward](https://etherscan.io/address/0x633120100e108F03aCe79d6C78Aac9a56db1be0F#code)
- [ProxyAdmin](https://etherscan.io/address/0xfE612c237A81527a86f2Cac1FD19939CF4F91B9B#code)
- [SmartWalletWhitelist](https://etherscan.io/address/0x37E8386602d9EBEa2c56dd11d8E142290595f1b5#code)

## Known issues

- AngleVault:
   - `withdrawAll()` wrongly defined. Since that every LP obtained will be staked directly into the related LGV4, for this reason the `msg.sender`'s balance would be always 0.

- CurveStrategy:
   - An edge case can happen within the `harvest()` for certain type of curve gauges, with more than one extra reward.
