import { ethers } from 'hardhat';

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log('Deploying contracts with account:', deployer.address);
    console.log('Account balance:', (await ethers.provider.getBalance(deployer.address)).toString());

    // Configuration - using deployer as all roles for testing
    const devWallet = deployer.address;
    const managerWallet = deployer.address;
    const minterWallet = deployer.address;

    // 1. Deploy AccessToken
    console.log('\n1. Deploying AccessToken...');
    const AccessToken = await ethers.getContractFactory('AccessToken');
    const accessToken = await AccessToken.deploy(devWallet);
    await accessToken.waitForDeployment();
    const accessTokenAddress = await accessToken.getAddress();
    console.log('AccessToken deployed to:', accessTokenAddress);

    // 2. Initialize AccessToken
    console.log('\n2. Initializing AccessToken...');
    const initAccessTokenTx = await accessToken.initialize(
        'Rewards Access Token', // name
        'RAT', // symbol
        'https://summon.xyz/metadata/', // defaultTokenURI
        'https://summon.xyz/contract/', // contractURI
        devWallet,
        devWallet // minterContract - will be updated to Rewards contract
    );
    await initAccessTokenTx.wait();
    console.log('AccessToken initialized');

    // 3. Deploy Rewards
    console.log('\n3. Deploying Rewards...');
    const Rewards = await ethers.getContractFactory('Rewards');
    const rewards = await Rewards.deploy(devWallet);
    await rewards.waitForDeployment();
    const rewardsAddress = await rewards.getAddress();
    console.log('Rewards deployed to:', rewardsAddress);

    // 4. Initialize Rewards
    console.log('\n4. Initializing Rewards...');
    const initRewardsTx = await rewards.initialize(
        devWallet,
        managerWallet,
        minterWallet,
        accessTokenAddress
    );
    await initRewardsTx.wait();
    console.log('Rewards initialized');

    // 5. Grant MINTER_ROLE to Rewards contract on AccessToken
    console.log('\n5. Granting MINTER_ROLE to Rewards on AccessToken...');
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('MINTER_ROLE'));
    const grantRoleTx = await accessToken.grantRole(MINTER_ROLE, rewardsAddress);
    await grantRoleTx.wait();
    console.log('MINTER_ROLE granted');

    // 6. Add Rewards to whitelist on AccessToken (for whitelistBurn)
    console.log('\n6. Adding Rewards to whitelist on AccessToken...');
    const DEV_CONFIG_ROLE = ethers.keccak256(ethers.toUtf8Bytes('DEV_CONFIG_ROLE'));
    // Check if addToWhitelist function exists
    try {
        const addWhitelistTx = await accessToken.addToWhitelist(rewardsAddress);
        await addWhitelistTx.wait();
        console.log('Rewards added to whitelist');
    } catch (error) {
        console.log('Note: addToWhitelist may need to be called separately or function name differs');
    }

    console.log('\n========================================');
    console.log('Deployment Summary:');
    console.log('========================================');
    console.log('AccessToken:', accessTokenAddress);
    console.log('Rewards:', rewardsAddress);
    console.log('Dev Wallet:', devWallet);
    console.log('Manager Wallet:', managerWallet);
    console.log('Minter Wallet:', minterWallet);
    console.log('========================================');

    // Verify instructions
    console.log('\nTo verify contracts on Etherscan:');
    console.log(`npx hardhat verify --network sepolia ${accessTokenAddress} ${devWallet}`);
    console.log(`npx hardhat verify --network sepolia ${rewardsAddress} ${devWallet}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
