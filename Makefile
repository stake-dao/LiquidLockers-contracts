include .env

.PHONY: test
default:; forge fmt && forge build

.EXPORT_ALL_VARIABLES:
FOUNDRY_ETH_RPC_URL=${MAINNET}
FOUNDRY_FORK_BLOCK_NUMBER=15924200
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