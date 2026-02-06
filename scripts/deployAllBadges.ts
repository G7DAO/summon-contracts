import { ethers } from 'hardhat';

/**
 * Script to deploy multiple ERC1155Soulbound badge contracts and MockUSDC
 *
 * Deploys:
 * 1. KPOP Badges (soulbound)
 * 2. F1 Grand Prix VIP Ticket (soulbound)
 * 3. New Jeans New Album (soulbound)
 * 4. Quince Discount (soulbound)
 * 5. MockUSDC for testing rewards
 */

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log('Deploying contracts with account:', deployer.address);
    console.log('Account balance:', (await ethers.provider.getBalance(deployer.address)).toString());

    // Get Rewards contract address from env or use the deployed one
    const REWARDS_CONTRACT = process.env.REWARDS_CONTRACT || '0x85974902415e87Ae6F94253648f1033163479e38';

    // Badge configurations
    const badges = [
        {
            name: 'KPOP Badges',
            symbol: 'KPOP',
            baseURI: 'https://summon.xyz/kpop/badges/',
            contractURI: 'https://summon.xyz/kpop/contract/',
        },
        {
            name: 'F1 Grand Prix VIP Ticket',
            symbol: 'F1VIP',
            baseURI: 'https://summon.xyz/rewards/badges/',
            contractURI: 'https://summon.xyz/rewards/contract/',
        },
        {
            name: 'New Jeans New Album',
            symbol: 'NJALBUM',
            baseURI: 'https://summon.xyz/rewards/badges/',
            contractURI: 'https://summon.xyz/rewards/contract/',
        },
        {
            name: 'Quince Discount',
            symbol: 'QUINCE',
            baseURI: 'https://summon.xyz/rewards/badges/',
            contractURI: 'https://summon.xyz/rewards/contract/',
        },
    ];

    const deployedBadges: { name: string; address: string }[] = [];

    // Deploy ERC1155Soulbound contracts
    const ERC1155Soulbound = await ethers.getContractFactory('ERC1155Soulbound');

    for (const badge of badges) {
        console.log(`\n========================================`);
        console.log(`Deploying ${badge.name}...`);
        console.log(`========================================`);

        const contract = await ERC1155Soulbound.deploy(
            badge.name,
            badge.symbol,
            badge.baseURI,
            badge.contractURI,
            100, // maxPerMint
            false, // isPaused
            deployer.address // devWallet
        );
        await contract.waitForDeployment();
        const address = await contract.getAddress();

        console.log(`  Deployed to: ${address}`);

        // Add initial token
        console.log('  Adding initial badge token...');
        const addTokenTx = await contract.addNewToken({
            tokenId: 1,
            tokenUri: `${badge.baseURI}1/metadata.json`,
            receiver: ethers.ZeroAddress,
            feeBasisPoints: 0,
        });
        await addTokenTx.wait();
        console.log('  Badge #1 added');

        // Whitelist Rewards contract
        console.log('  Whitelisting Rewards contract...');
        const whitelistTx = await contract.updateWhitelistAddress(REWARDS_CONTRACT, true);
        await whitelistTx.wait();
        console.log('  Rewards contract whitelisted');

        deployedBadges.push({ name: badge.name, address });
    }

    // Deploy MockUSDC
    console.log(`\n========================================`);
    console.log(`Deploying MockUSDC...`);
    console.log(`========================================`);

    const MockUSDC = await ethers.getContractFactory('MockUSDC');
    const mockUSDC = await MockUSDC.deploy('USDC', 'USDC', 6);
    await mockUSDC.waitForDeployment();
    const usdcAddress = await mockUSDC.getAddress();
    console.log(`  Deployed to: ${usdcAddress}`);

    // Mint some USDC to deployer for testing
    console.log('  Minting 1,000,000 USDC to deployer...');
    const mintTx = await mockUSDC.mint(deployer.address, ethers.parseUnits('1000000', 6));
    await mintTx.wait();
    console.log('  USDC minted');

    // Summary
    console.log('\n========================================');
    console.log('Deployment Summary');
    console.log('========================================');
    console.log('\nBadge Contracts:');
    for (const badge of deployedBadges) {
        console.log(`  ${badge.name}: ${badge.address}`);
    }
    console.log(`\nMockUSDC: ${usdcAddress}`);
    console.log(`\nRewards Contract: ${REWARDS_CONTRACT}`);
    console.log(`Dev Wallet: ${deployer.address}`);

    // Export for use in setup script
    console.log('\n========================================');
    console.log('Environment Variables for Setup Script');
    console.log('========================================');
    console.log(`KPOP_BADGES_ADDRESS=${deployedBadges[0].address}`);
    console.log(`F1_BADGES_ADDRESS=${deployedBadges[1].address}`);
    console.log(`NEWJEANS_BADGES_ADDRESS=${deployedBadges[2].address}`);
    console.log(`QUINCE_BADGES_ADDRESS=${deployedBadges[3].address}`);
    console.log(`MOCK_USDC_ADDRESS=${usdcAddress}`);
    console.log(`REWARDS_ADDRESS=${REWARDS_CONTRACT}`);

    // Verification commands
    console.log('\n========================================');
    console.log('Verification Commands');
    console.log('========================================');
    for (const [i, badge] of deployedBadges.entries()) {
        const config = badges[i];
        console.log(`\n# ${badge.name}`);
        console.log(
            `npx hardhat verify --network sepolia ${badge.address} "${config.name}" "${config.symbol}" "${config.baseURI}" "${config.contractURI}" 100 false ${deployer.address}`
        );
    }
    console.log(`\n# MockUSDC`);
    console.log(`npx hardhat verify --network sepolia ${usdcAddress} "USDC" "USDC" 6`);

    return {
        badges: deployedBadges,
        usdc: usdcAddress,
        rewards: REWARDS_CONTRACT,
    };
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
