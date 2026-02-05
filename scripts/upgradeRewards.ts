import { ethers, upgrades } from 'hardhat';

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log('Upgrading Rewards contract with account:', deployer.address);
    console.log('Account balance:', (await ethers.provider.getBalance(deployer.address)).toString());

    // The address of the deployed proxy (you need to provide this)
    // Replace with your actual proxy address
    const PROXY_ADDRESS = process.env.REWARDS_PROXY_ADDRESS || '0x39aA1cBfabFd26D616C22bcC70964776CEFD2DAf';

    if (!PROXY_ADDRESS) {
        console.error('Error: Please provide REWARDS_PROXY_ADDRESS environment variable');
        console.log('Usage: REWARDS_PROXY_ADDRESS=0x... npx hardhat run scripts/upgradeRewards.ts --network <network>');
        process.exit(1);
    }

    console.log('\nUpgrading Rewards proxy at:', PROXY_ADDRESS);

    // Get the new implementation
    const RewardsV2 = await ethers.getContractFactory('Rewards');

    // Force import the proxy if it's not registered (needed for previously deployed proxies)
    console.log('Registering existing proxy...');
    try {
        await upgrades.forceImport(PROXY_ADDRESS, RewardsV2);
        console.log('Proxy registered successfully');
    } catch (error: any) {
        console.log('Proxy already registered or error:', error.message);
    }

    // Upgrade the proxy
    console.log('Preparing upgrade...');
    const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, RewardsV2);
    await upgraded.waitForDeployment();

    const upgradedAddress = await upgraded.getAddress();
    console.log('Rewards proxy upgraded successfully!');
    console.log('Proxy address (unchanged):', upgradedAddress);

    // Get the implementation address
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
    console.log('New implementation address:', implementationAddress);

    console.log('\n========================================');
    console.log('Upgrade Summary:');
    console.log('========================================');
    console.log('Proxy Address:', PROXY_ADDRESS);
    console.log('New Implementation:', implementationAddress);
    console.log('Upgraded by:', deployer.address);
    console.log('========================================');

    // Test treasury delegation
    console.log('\nTesting Treasury contract delegation...');
    const treasuryAddress = await upgraded.treasury();
    console.log('Treasury contract address:', treasuryAddress);

    if (treasuryAddress && treasuryAddress !== '0x0000000000000000000000000000000000000000') {
        try {
            const result = await upgraded.getAllTreasuryBalances();
            console.log('getAllTreasuryBalances call successful!');
            console.log('Number of tokens in treasury:', result.addresses.length);

            if (result.addresses.length > 0) {
                console.log('\nTreasury tokens:');
                for (let i = 0; i < result.addresses.length; i++) {
                    console.log(`  ${i + 1}. ${result.addresses[i]}`);
                    console.log(`     Type: ${result.types[i]}`);
                    console.log(`     Symbol: ${result.symbols[i]}`);
                    console.log(`     Name: ${result.names[i]}`);
                    console.log(`     Total Balance: ${result.totalBalances[i]}`);
                    console.log(`     Reserved: ${result.reservedBalances[i]}`);
                    console.log(`     Available: ${result.availableBalances[i]}`);
                    console.log('');
                }
            } else {
                console.log('No tokens in treasury yet.');
            }
        } catch (error: any) {
            console.error('Error calling getAllTreasuryBalances:', error.message);
        }
    } else {
        console.log('Treasury contract not set. Call setTreasury() after deploying Treasury contract.');
    }

    // Verify instructions
    console.log('\nTo verify the new implementation on Etherscan:');
    console.log(`npx hardhat verify --network <network> ${implementationAddress}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });