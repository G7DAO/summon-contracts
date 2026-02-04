import { ethers } from 'hardhat';

/**
 * Script to verify Rewards contract deployment
 * Tests the new getAllTreasuryBalances function and other key functions
 */

const REWARDS_ADDRESS = '0x80C95B9EE08BA220DE5D26D19Ff23a96D52adDD6';

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log('Verifying Rewards contract with account:', deployer.address);

    const rewards = await ethers.getContractAt('Rewards', REWARDS_ADDRESS);

    console.log('\n========================================');
    console.log('1. Testing getAllItemIds()');
    console.log('========================================');
    const itemIds = await rewards.getAllItemIds();
    console.log('  Item IDs:', itemIds.map((id: bigint) => id.toString()));

    console.log('\n========================================');
    console.log('2. Testing getTokenDetails() for each token');
    console.log('========================================');
    for (const tokenId of itemIds) {
        const details = await rewards.getTokenDetails(tokenId);
        console.log(`\n  Token ID ${tokenId}:`);
        console.log('    URI:', details.tokenUri);
        console.log('    Max Supply:', details.maxSupply.toString());
        console.log('    Reward Types:', details.rewardTypes.map((t: bigint) => t.toString()));
        console.log('    Reward Amounts:', details.rewardAmounts.map((a: bigint) => a.toString()));
    }

    console.log('\n========================================');
    console.log('3. Testing getRemainingSupply()');
    console.log('========================================');
    for (const tokenId of itemIds) {
        const remaining = await rewards.getRemainingSupply(tokenId);
        console.log(`  Token ID ${tokenId}: ${remaining.toString()} remaining`);
    }

    console.log('\n========================================');
    console.log('4. Testing getWhitelistedTokens()');
    console.log('========================================');
    const whitelistedTokens = await rewards.getWhitelistedTokens();
    console.log('  Whitelisted tokens:', whitelistedTokens.length > 0 ? whitelistedTokens : 'None');

    console.log('\n========================================');
    console.log('5. Testing getAllTreasuryBalances()');
    console.log('========================================');
    try {
        const treasuryBalances = await rewards.getAllTreasuryBalances();
        console.log('  Addresses:', treasuryBalances.addresses);
        console.log('  Total Balances:', treasuryBalances.totalBalances.map((b: bigint) => b.toString()));
        console.log('  Reserved Balances:', treasuryBalances.reservedBalances.map((b: bigint) => b.toString()));
        console.log('  Available Balances:', treasuryBalances.availableBalances.map((b: bigint) => b.toString()));
        console.log('  Symbols:', treasuryBalances.symbols);
        console.log('  Names:', treasuryBalances.names);
        console.log('  Types:', treasuryBalances.types); // NEW: "fa" or "nft"
    } catch (error: any) {
        console.log('  Error:', error.message);
    }

    console.log('\n========================================');
    console.log('6. Testing getRewardTokenContract()');
    console.log('========================================');
    const accessTokenAddress = await rewards.getRewardTokenContract();
    console.log('  AccessToken Address:', accessTokenAddress);

    console.log('\n========================================');
    console.log('7. Testing getChainID()');
    console.log('========================================');
    const chainId = await rewards.getChainID();
    console.log('  Chain ID:', chainId.toString());

    console.log('\n========================================');
    console.log('8. Testing getWhitelistSigners()');
    console.log('========================================');
    const signers = await rewards.getWhitelistSigners();
    console.log('  Whitelist Signers:', signers.length > 0 ? signers : 'None configured');

    console.log('\n========================================');
    console.log('Verification Complete!');
    console.log('========================================');
    console.log('\nNew Contract Address: ', REWARDS_ADDRESS);
    console.log('AccessToken Address:', accessTokenAddress);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
