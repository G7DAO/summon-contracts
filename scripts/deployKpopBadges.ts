import { ethers } from 'hardhat';

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log('Deploying KPOP Badges with account:', deployer.address);
    console.log('Account balance:', (await ethers.provider.getBalance(deployer.address)).toString());

    // Configuration
    const name = 'KPOP Badges';
    const symbol = 'KPOP';
    const baseURI = 'https://summon.xyz/kpop/badges/';
    const contractURI = 'https://summon.xyz/kpop/contract/';
    const maxPerMint = 100;
    const isPaused = false;
    const devWallet = deployer.address;

    // Deploy ERC1155Soulbound
    console.log('\n1. Deploying ERC1155Soulbound (KPOP Badges)...');
    const ERC1155Soulbound = await ethers.getContractFactory('ERC1155Soulbound');
    const kpopBadges = await ERC1155Soulbound.deploy(
        name,
        symbol,
        baseURI,
        contractURI,
        maxPerMint,
        isPaused,
        devWallet
    );
    await kpopBadges.waitForDeployment();
    const kpopBadgesAddress = await kpopBadges.getAddress();
    console.log('KPOP Badges deployed to:', kpopBadgesAddress);

    // Add some initial badge tokens
    console.log('\n2. Adding initial badge tokens...');
    const badgeTokens = [
        { tokenId: 1, tokenUri: 'https://summon.xyz/kpop/badges/1/metadata.json', receiver: ethers.ZeroAddress, feeBasisPoints: 0 },
        { tokenId: 2, tokenUri: 'https://summon.xyz/kpop/badges/2/metadata.json', receiver: ethers.ZeroAddress, feeBasisPoints: 0 },
        { tokenId: 3, tokenUri: 'https://summon.xyz/kpop/badges/3/metadata.json', receiver: ethers.ZeroAddress, feeBasisPoints: 0 },
    ];

    for (const token of badgeTokens) {
        const tx = await kpopBadges.addNewToken(token);
        await tx.wait();
        console.log(`  Badge #${token.tokenId} added`);
    }

    // Whitelist the Rewards contract if provided
    const REWARDS_CONTRACT = process.env.REWARDS_CONTRACT || '0x073e96B3Df99e6fBA615d9B3d2d7DF83cb005b41';
    if (REWARDS_CONTRACT && REWARDS_CONTRACT !== ethers.ZeroAddress) {
        console.log('\n3. Whitelisting Rewards contract for soulbound transfers...');
        const whitelistTx = await kpopBadges.updateWhitelistAddress(REWARDS_CONTRACT, true);
        await whitelistTx.wait();
        console.log('  Rewards contract whitelisted:', REWARDS_CONTRACT);
    }

    console.log('\n========================================');
    console.log('Deployment Summary:');
    console.log('========================================');
    console.log('KPOP Badges (ERC1155Soulbound):', kpopBadgesAddress);
    console.log('Dev Wallet:', devWallet);
    console.log('Rewards Contract (whitelisted):', REWARDS_CONTRACT);
    console.log('========================================');

    // Verify instructions
    console.log('\nTo verify contract on Etherscan:');
    console.log(`npx hardhat verify --network sepolia ${kpopBadgesAddress} "${name}" "${symbol}" "${baseURI}" "${contractURI}" ${maxPerMint} ${isPaused} ${devWallet}`);

    console.log('\nTo use with Rewards contract:');
    console.log('1. Manager mints soulbound badges to themselves');
    console.log('2. Manager approves Rewards contract');
    console.log('3. Manager creates reward token with ERC1155 badge as reward');
    console.log('4. Users claim rewards and receive non-transferable badges');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
