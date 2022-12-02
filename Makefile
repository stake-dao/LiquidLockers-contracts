include .env

.PHONY: test
default:; forge fmt && forge build

.EXPORT_ALL_VARIABLES:
FOUNDRY_ETH_RPC_URL=${MAINNET}
FOUNDRY_FORK_BLOCK_NUMBER=16096521
ETHERSCAN_API_KEY==${ETHERSCAN_KEY}

coverage:; @forge coverage --match-contract FraxTest
zapperTest:; forge test -vvv --fork-url $(MAINNET) --match-contract "SdLiquidityZapperTest" --fork-block-number 15408319  --etherscan-api-key $(ETHERSCAN_KEY) 
fraxVoterTest:; forge test -vvvv --fork-url $(MAINNET) --match-contract "FraxVoterTest" --fork-block-number  15568813   --etherscan-api-key $(ETHERSCAN_KEY) 
boostDelegationTest:; forge test -vvvv --fork-url $(MAINNET) --match-contract "VeBoostDelegationTest" --fork-block-number  15568813   --etherscan-api-key $(ETHERSCAN_KEY) 

veSdtFeeAngleProxyV2Test:; forge test -vvvv --match-contract "VeSDTFeeAngleProxyV2"
deploy-veSDTFeeAngleProxyV2:; forge script scripts/DeployVeSDTFeeAngleProxyV2.s.sol --rpc-url ${MAINNET_RPC_URL} -vvvv --private-key ${DEPLOYER_PKEY} --broadcast  --verify --etherscan-api-key ${ETHERSCAN_KEY}

test-angle:; @forge test --match-contract AngleTest
test-apwine:; @forge test --match-contract ApwineTest 
test-balancer:; @forge test --match-contract BalancerTest
test-blackpool:; @forge test --match-contract BlackpoolTest
test-frax:; @forge test --match-contract FraxTest

test-feeDistributor:; @forge test --match-contract FeeDistributorTest
test-veSDT:; @forge test --match-contract VeSDTTest 
test-veSDTProxy:; @forge test --match-contract VeSDTProxyTest
test-crvMigration:; @forge test --match-contract CRVMigrationTest
test-gaugeController:; @forge test --match-contract GaugeControllerTest
test-sdtDistributor:; @forge test --match-contract SdtDistributorTest 

test-balancer-fee:; @forge test --match-contract BalancerFeeProxyTest
test-balancer-strat:; @forge test --match-contract BalancerStrategyTest