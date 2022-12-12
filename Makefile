include .env

.PHONY: test
default:; forge fmt && forge build
build:; forge build && npx hardhat compile

.EXPORT_ALL_VARIABLES:
ETHERSCAN_API_KEY==${ETHERSCAN_KEY}

#################################################
#          ---------- Test -----------          #
################################################# 

# ANGLE #
test-angle-vault:; @forge test --match-contract AngleVaultTest
test-angle-locker:; @forge test --match-contract AngleTest
test-angle-merkleclaim:; @forge test --match-contract AngleMerkleClaimTest
test-angle-veSdtFeeProxy:; @forge test --match-contract VeSDTFeeAngleProxyV2

# APWINE
test-apwine:; @forge test --match-contract ApwineTest 

# BALANCER #
test-balancer-fee:; @forge test --match-contract BalancerFeeProxyTest
test-balancer-strat:; @forge test --match-contract BalancerStrategyTest
test-balancer-vault:; @forge test --match-contract BalancerVaultTest
test-balancer-locker:; @forge test --match-contract BalancerTest
test-balancer-zapper:; @forge test --match-contract BalancerZapperTest

# BLACKPOOL #
test-blackpool-locker:; @forge test --match-contract BlackpoolTest

# CURVE #
test-curve-vault:; @forge test --match-contract CurveVaultTest
test-curve-voter:; @forge test --match-contract CurveVoterTest
test-crv-migration:; @forge test --match-contract CrvMigrationTest

# FRAX #
test-frax-voter:; @forge test --match-contract FraxVoterTest 
test-frax-locker:; @forge test --match-contract FraxTest
test-frax-strategy:; @forge test --match-contract FraxStrategyTest

# STAKE DAO #
test-veSDT:; @forge test --match-contract VeSDTTest 
test-veSDTProxy:; @forge test --match-contract VeSDTProxyTest
test-zapper:; @forge test --match-contract SdLiquidityZapperTest
test-sdtDistributor:; @forge test --match-contract SdtDistributorTest 
test-feeDistributor:; @forge test --match-contract FeeDistributorTest
test-gaugeController:; @forge test --match-contract GaugeControllerTest
test-boost-delegation:; @forge test --match-contract VeBoostDelegationTest

# OTHERS #
test-all:; @forge test

#################################################
#        ---------- COVERAGE -----------        #
################################################# 

coverage-all:; @forge coverage 

#################################################
#      ----------- Deployement -----------      #
################################################# 

deploy-veSDTFeeAngleProxyV2:; @forge script scripts/DeployVeSDTFeeAngleProxyV2.s.sol --rpc-url ${MAINNET_RPC_URL} -vvvv --private-key ${DEPLOYER_PKEY} --broadcast  --verify --etherscan-api-key ${ETHERSCAN_KEY}
deploy-angleVoterV3:; @forge script scripts/DeployAngleVoterV3.s.sol --rpc-url ${MAINNET_RPC_URL} -vvvv --private-key ${DEPLOYER_PKEY} --broadcast  --verify --etherscan-api-key ${ETHERSCAN_KEY}
deploy-YearnLL:; @forge script scripts/DeployYearnLL.s.sol --rpc-url ${MAINNET_RPC_URL} -vvvv --private-key ${DEPLOYER_PKEY} --broadcast --verify --etherscan-api-key ${ETHERSCAN_KEY}