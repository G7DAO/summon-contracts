import { ethers, upgrades, run } from 'hardhat';

/**
 * Full deployment script for the Rewards system on Sepolia
 *
 * Deploys:
 *   1. AccessToken (standard deployment)
 *   2. RewardsState (UUPS proxy)
 *   3. Rewards (UUPS proxy)
 *   4. Treasury (UUPS proxy)
 *
 * Then sets up all relationships between contracts.
 *
 * Usage:
 *   pnpm hardhat run scripts/deployRewardsSystemSepolia.ts --network sepolia
 */

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log('========================================');
    console.log('Rewards System Deployment - Sepolia');
    console.log('========================================');
    console.log('Deployer:', deployer.address);
    console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'ETH');
    console.log('========================================\n');

    // Configuration - using deployer for all roles initially
    const devWallet = deployer.address;
    const managerWallet = deployer.address;
    const minterWallet = deployer.address;

    // ========================================
    // 1. Deploy AccessToken (Standard)
    // ========================================
    console.log('1. Deploying AccessToken...');
    const AccessToken = await ethers.getContractFactory('AccessToken');
    const accessToken = await AccessToken.deploy(devWallet);
    await accessToken.waitForDeployment();
    const accessTokenAddress = await accessToken.getAddress();
    console.log('   AccessToken deployed to:', accessTokenAddress);

    // ========================================
    // 2. Deploy RewardsState (UUPS Proxy)
    // ========================================
    console.log('\n2. Deploying RewardsState (UUPS Proxy)...');
    const RewardsState = await ethers.getContractFactory('RewardsState');
    const rewardsState = await upgrades.deployProxy(
        RewardsState,
        [devWallet], // initialize(address _admin)
        { kind: 'uups', initializer: 'initialize' }
    );
    await rewardsState.waitForDeployment();
    const rewardsStateAddress = await rewardsState.getAddress();
    const rewardsStateImpl = await upgrades.erc1967.getImplementationAddress(rewardsStateAddress);
    console.log('   RewardsState Proxy:', rewardsStateAddress);
    console.log('   RewardsState Implementation:', rewardsStateImpl);

    // ========================================
    // 3. Deploy Rewards (UUPS Proxy)
    // ========================================
    console.log('\n3. Deploying Rewards (UUPS Proxy)...');
    const Rewards = await ethers.getContractFactory('Rewards');
    const rewards = await upgrades.deployProxy(
        Rewards,
        [devWallet, managerWallet, minterWallet, accessTokenAddress],
        { kind: 'uups', initializer: 'initialize' }
    );
    await rewards.waitForDeployment();
    const rewardsAddress = await rewards.getAddress();
    const rewardsImpl = await upgrades.erc1967.getImplementationAddress(rewardsAddress);
    console.log('   Rewards Proxy:', rewardsAddress);
    console.log('   Rewards Implementation:', rewardsImpl);

    // ========================================
    // 4. Deploy Treasury (UUPS Proxy)
    // ========================================
    console.log('\n4. Deploying Treasury (UUPS Proxy)...');
    const Treasury = await ethers.getContractFactory('Treasury');
    const treasury = await upgrades.deployProxy(
        Treasury,
        [devWallet, rewardsAddress, rewardsStateAddress], // initialize(admin, rewardsContract, rewardsState)
        { kind: 'uups', initializer: 'initialize' }
    );
    await treasury.waitForDeployment();
    const treasuryAddress = await treasury.getAddress();
    const treasuryImpl = await upgrades.erc1967.getImplementationAddress(treasuryAddress);
    console.log('   Treasury Proxy:', treasuryAddress);
    console.log('   Treasury Implementation:', treasuryImpl);

    // ========================================
    // 5. Configure relationships
    // ========================================
    console.log('\n5. Configuring contract relationships...');

    // 5a. Set Treasury and RewardsState on Rewards contract
    console.log('   Setting Treasury on Rewards...');
    const setTreasuryTx = await rewards.setTreasury(treasuryAddress);
    await setTreasuryTx.wait();

    console.log('   Setting RewardsState on Rewards...');
    const setStateTx = await rewards.setRewardsState(rewardsStateAddress);
    await setStateTx.wait();

    // 5b. Grant STATE_MANAGER_ROLE to Rewards and Treasury on RewardsState
    const STATE_MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('STATE_MANAGER_ROLE'));

    console.log('   Granting STATE_MANAGER_ROLE to Rewards on RewardsState...');
    const grantRewardsTx = await rewardsState.grantRole(STATE_MANAGER_ROLE, rewardsAddress);
    await grantRewardsTx.wait();

    console.log('   Granting STATE_MANAGER_ROLE to Treasury on RewardsState...');
    const grantTreasuryTx = await rewardsState.grantRole(STATE_MANAGER_ROLE, treasuryAddress);
    await grantTreasuryTx.wait();

    // ========================================
    // 6. Initialize AccessToken
    // ========================================
    console.log('\n6. Initializing AccessToken...');
    const initAccessTokenTx = await accessToken.initialize(
        'Rewards Access Token',
        'RAT',
        'https://summon.xyz/metadata/',
        'https://summon.xyz/contract/',
        devWallet,
        rewardsAddress // minterContract is the Rewards contract
    );
    await initAccessTokenTx.wait();
    console.log('   AccessToken initialized');

    // 6b. Grant MINTER_ROLE to Rewards on AccessToken
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('MINTER_ROLE'));
    console.log('   Granting MINTER_ROLE to Rewards on AccessToken...');
    const grantMinterTx = await accessToken.grantRole(MINTER_ROLE, rewardsAddress);
    await grantMinterTx.wait();

    // ========================================
    // 7. Verify contracts on Etherscan
    // ========================================
    console.log('\n7. Verifying contracts on Etherscan...');
    console.log('   (Waiting for block confirmations...)');

    // Wait for confirmations
    await new Promise((resolve) => setTimeout(resolve, 30000));

    // Verify AccessToken
    try {
        console.log('   Verifying AccessToken...');
        await run('verify:verify', {
            address: accessTokenAddress,
            constructorArguments: [devWallet],
        });
        console.log('   AccessToken verified!');
    } catch (e: any) {
        console.log('   AccessToken verification:', e.message.includes('Already') ? 'Already verified' : e.message);
    }

    // Verify RewardsState implementation
    try {
        console.log('   Verifying RewardsState implementation...');
        await run('verify:verify', {
            address: rewardsStateImpl,
            constructorArguments: [],
        });
        console.log('   RewardsState verified!');
    } catch (e: any) {
        console.log('   RewardsState verification:', e.message.includes('Already') ? 'Already verified' : e.message);
    }

    // Verify Rewards implementation
    try {
        console.log('   Verifying Rewards implementation...');
        await run('verify:verify', {
            address: rewardsImpl,
            constructorArguments: [],
        });
        console.log('   Rewards verified!');
    } catch (e: any) {
        console.log('   Rewards verification:', e.message.includes('Already') ? 'Already verified' : e.message);
    }

    // Verify Treasury implementation
    try {
        console.log('   Verifying Treasury implementation...');
        await run('verify:verify', {
            address: treasuryImpl,
            constructorArguments: [],
        });
        console.log('   Treasury verified!');
    } catch (e: any) {
        console.log('   Treasury verification:', e.message.includes('Already') ? 'Already verified' : e.message);
    }

    // ========================================
    // Summary
    // ========================================
    console.log('\n========================================');
    console.log('DEPLOYMENT SUMMARY');
    console.log('========================================');
    console.log('Network: Sepolia');
    console.log('Deployer:', deployer.address);
    console.log('');
    console.log('Contracts:');
    console.log('  AccessToken:');
    console.log('    Address:', accessTokenAddress);
    console.log('');
    console.log('  RewardsState (UUPS):');
    console.log('    Proxy:', rewardsStateAddress);
    console.log('    Implementation:', rewardsStateImpl);
    console.log('');
    console.log('  Rewards (UUPS):');
    console.log('    Proxy:', rewardsAddress);
    console.log('    Implementation:', rewardsImpl);
    console.log('');
    console.log('  Treasury (UUPS):');
    console.log('    Proxy:', treasuryAddress);
    console.log('    Implementation:', treasuryImpl);
    console.log('');
    console.log('Roles configured:');
    console.log('  - Rewards has STATE_MANAGER_ROLE on RewardsState');
    console.log('  - Treasury has STATE_MANAGER_ROLE on RewardsState');
    console.log('  - Rewards has MINTER_ROLE on AccessToken');
    console.log('========================================');

    console.log('\nEtherscan URLs:');
    console.log(`  AccessToken: https://sepolia.etherscan.io/address/${accessTokenAddress}#code`);
    console.log(`  RewardsState: https://sepolia.etherscan.io/address/${rewardsStateAddress}#code`);
    console.log(`  Rewards: https://sepolia.etherscan.io/address/${rewardsAddress}#code`);
    console.log(`  Treasury: https://sepolia.etherscan.io/address/${treasuryAddress}#code`);

    // Export addresses for other scripts
    console.log('\n========================================');
    console.log('ENVIRONMENT VARIABLES (copy to .env):');
    console.log('========================================');
    console.log(`ACCESS_TOKEN_ADDRESS=${accessTokenAddress}`);
    console.log(`REWARDS_STATE_ADDRESS=${rewardsStateAddress}`);
    console.log(`REWARDS_PROXY_ADDRESS=${rewardsAddress}`);
    console.log(`TREASURY_ADDRESS=${treasuryAddress}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Deployment failed:', error);
        process.exit(1);
    });
