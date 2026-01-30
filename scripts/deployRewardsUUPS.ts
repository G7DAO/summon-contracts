import { ethers, upgrades } from 'hardhat';

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log('Deploying contracts with account:', deployer.address);
    console.log('Account balance:', (await ethers.provider.getBalance(deployer.address)).toString());

    // Configuration
    const devWallet = deployer.address;
    const managerWallet = deployer.address;
    const minterWallet = deployer.address;

    // 1. Deploy AccessToken (Standard Deployment)
    console.log('\n1. Deploying AccessToken...');
    const AccessToken = await ethers.getContractFactory('AccessToken');
    const accessToken = await AccessToken.deploy(devWallet);
    await accessToken.waitForDeployment();
    const accessTokenAddress = await accessToken.getAddress();
    console.log('AccessToken deployed to:', accessTokenAddress);

    // 2. Deploy Rewards (UUPS Proxy)
    console.log('\n2. Deploying Rewards (UUPS Proxy)...');
    const Rewards = await ethers.getContractFactory('Rewards');
    
    // Deploy proxy
    // Pass constructor arguments in `constructorArgs` and initializer arguments in second array
    const rewards = await upgrades.deployProxy(
        Rewards, 
        [devWallet, managerWallet, minterWallet, accessTokenAddress], 
        { 
            kind: 'uups', 
            initializer: 'initialize',
        }
    );
    await rewards.waitForDeployment();
    const rewardsAddress = await rewards.getAddress();
    console.log('Rewards Proxy deployed to:', rewardsAddress);

    // 3. Initialize AccessToken
    console.log('\n3. Initializing AccessToken...');
    const initAccessTokenTx = await accessToken.initialize(
        'Rewards Access Token', // name
        'RAT', // symbol
        'https://summon.xyz/metadata/', // defaultTokenURI
        'https://summon.xyz/contract/', // contractURI
        devWallet,
        rewardsAddress // minterContract is the Rewards contract
    );
    await initAccessTokenTx.wait();
    console.log('AccessToken initialized with Rewards contract as minter');

    // 4. Whitelist tokens in Rewards contract
    console.log('\n4. Whitelisting existing tokens in Rewards contract...');
    
    // Existing token addresses on Sepolia
    const existingTokens = [
        { address: '0x1a7a1879bE0C3fD48e033B2eEF40063bFE551731', type: 3, name: 'F1 Grand Prix VIP Ticket (ERC1155)' },
        { address: '0x4afF7E3F1191b4dEE2a0358417a750C1c6fF9b62', type: 3, name: 'New Jeans New Album (ERC1155)' },
        { address: '0x40813d715Ed741C0bA6848763c93aaF75fEA7F55', type: 3, name: 'Quince Discount (ERC1155)' },
        { address: '0x049d3CC16a5521E1dE1922059d09FCDd719DC81c', type: 3, name: 'KPOP Badges (ERC1155)' },
        { address: '0x3E3a445731d7881a3729A3898D532D5290733Eb5', type: 1, name: 'USDC (ERC20)' },
    ];

    // Helper to map type number to enum name for logging
    const typeNames = { 1: 'ERC20', 2: 'ERC721', 3: 'ERC1155' };

    for (const token of existingTokens) {
        try {
            console.log(`Whitelisting ${token.name} (${token.address})...`);
            // whitelistToken(address _token, LibItems.RewardType _type)
            const tx = await rewards.whitelistToken(token.address, token.type);
            await tx.wait();
            console.log(`Confirmed: ${token.name} whitelisted`);
        } catch (error: any) {
            console.error(`Failed to whitelist ${token.name}:`, error.message);
        }
    }

    console.log('\n========================================');
    console.log('Deployment Summary:');
    console.log('========================================');
    console.log('AccessToken:', accessTokenAddress);
    console.log('Rewards (Proxy):', rewardsAddress);
    console.log('Dev Wallet:', devWallet);
    console.log('Manager Wallet:', managerWallet);
    console.log('Minter Wallet:', minterWallet);
    console.log('========================================');

    // Verify instructions
    console.log('\nTo verify contracts on Etherscan:');
    console.log(`npx hardhat verify --network sepolia ${accessTokenAddress} ${devWallet}`);
    console.log(`npx hardhat verify --network sepolia ${rewardsAddress}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
