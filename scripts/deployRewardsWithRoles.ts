import { ethers } from 'hardhat';

/**
 * Script to deploy AccessToken and Rewards contracts
 * and grant all roles to a target address without renouncing any roles.
 */

const TARGET_ADDRESS = '0x3E35E6713e1a03fd40a06BC406495822845d499F';

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log('Deploying contracts with account:', deployer.address);
    console.log('Account balance:', (await ethers.provider.getBalance(deployer.address)).toString());
    console.log('Target address for roles:', TARGET_ADDRESS);

    // Configuration - using deployer as all roles initially
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
    console.log('MINTER_ROLE granted to Rewards');

    // 6. Add Rewards to whitelist on AccessToken (for whitelistBurn)
    console.log('\n6. Adding Rewards to whitelist on AccessToken...');
    try {
        const addWhitelistTx = await accessToken.addToWhitelist(rewardsAddress);
        await addWhitelistTx.wait();
        console.log('Rewards added to whitelist');
    } catch (error) {
        console.log('Note: addToWhitelist may need to be called separately or function name differs');
    }

    // 7. Grant all roles to TARGET_ADDRESS on Rewards contract
    console.log('\n7. Granting all roles to target address on Rewards...');
    const DEFAULT_ADMIN_ROLE = await rewards.DEFAULT_ADMIN_ROLE();
    const DEV_CONFIG_ROLE = await rewards.DEV_CONFIG_ROLE();
    const MANAGER_ROLE = await rewards.MANAGER_ROLE();
    const REWARDS_MINTER_ROLE = await rewards.MINTER_ROLE();

    console.log('  Granting DEFAULT_ADMIN_ROLE...');
    await (await rewards.grantRole(DEFAULT_ADMIN_ROLE, TARGET_ADDRESS)).wait();
    console.log('  Granting DEV_CONFIG_ROLE...');
    await (await rewards.grantRole(DEV_CONFIG_ROLE, TARGET_ADDRESS)).wait();
    console.log('  Granting MANAGER_ROLE...');
    await (await rewards.grantRole(MANAGER_ROLE, TARGET_ADDRESS)).wait();
    console.log('  Granting MINTER_ROLE...');
    await (await rewards.grantRole(REWARDS_MINTER_ROLE, TARGET_ADDRESS)).wait();
    console.log('All roles granted to target on Rewards');

    // 8. Grant all roles to TARGET_ADDRESS on AccessToken contract
    console.log('\n8. Granting all roles to target address on AccessToken...');
    const AT_DEFAULT_ADMIN_ROLE = await accessToken.DEFAULT_ADMIN_ROLE();
    const AT_DEV_CONFIG_ROLE = await accessToken.DEV_CONFIG_ROLE();
    const AT_MINTER_ROLE = await accessToken.MINTER_ROLE();

    console.log('  Granting DEFAULT_ADMIN_ROLE...');
    await (await accessToken.grantRole(AT_DEFAULT_ADMIN_ROLE, TARGET_ADDRESS)).wait();
    console.log('  Granting DEV_CONFIG_ROLE...');
    await (await accessToken.grantRole(AT_DEV_CONFIG_ROLE, TARGET_ADDRESS)).wait();
    console.log('  Granting MINTER_ROLE...');
    await (await accessToken.grantRole(AT_MINTER_ROLE, TARGET_ADDRESS)).wait();
    console.log('All roles granted to target on AccessToken');

    console.log('\n========================================');
    console.log('Deployment Summary:');
    console.log('========================================');
    console.log('AccessToken:', accessTokenAddress);
    console.log('Rewards:', rewardsAddress);
    console.log('Dev Wallet:', devWallet);
    console.log('Manager Wallet:', managerWallet);
    console.log('Minter Wallet:', minterWallet);
    console.log('Target Address (all roles):', TARGET_ADDRESS);
    console.log('========================================');

    console.log('\nRoles granted to', TARGET_ADDRESS, ':');
    console.log('  Rewards: DEFAULT_ADMIN_ROLE, DEV_CONFIG_ROLE, MANAGER_ROLE, MINTER_ROLE');
    console.log('  AccessToken: DEFAULT_ADMIN_ROLE, DEV_CONFIG_ROLE, MINTER_ROLE');

    // Verify instructions
    console.log('\nTo verify contracts on Etherscan:');
    console.log(`npx hardhat verify --network sepolia ${accessTokenAddress} ${devWallet}`);
    console.log(`npx hardhat verify --network sepolia ${rewardsAddress} ${devWallet}`);

    console.log('\n========================================');
    console.log('NEXT STEP:');
    console.log('========================================');
    console.log('Update REWARDS_ADDRESS in scripts/setupAllRewards.ts to:');
    console.log(rewardsAddress);
    console.log('\nThen run:');
    console.log('pnpm hardhat run scripts/setupAllRewards.ts --network sepolia');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
