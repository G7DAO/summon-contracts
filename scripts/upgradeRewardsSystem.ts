import { ethers, upgrades, run } from 'hardhat';

/**
 * Upgrade script for the Rewards system UUPS contracts
 *
 * Can upgrade:
 *   - Rewards
 *   - RewardsState
 *   - Treasury
 *
 * Usage:
 *   # Upgrade all contracts
 *   pnpm hardhat run scripts/upgradeRewardsSystem.ts --network sepolia
 *
 *   # Upgrade specific contract via env var
 *   UPGRADE_CONTRACT=Rewards pnpm hardhat run scripts/upgradeRewardsSystem.ts --network sepolia
 *   UPGRADE_CONTRACT=RewardsState pnpm hardhat run scripts/upgradeRewardsSystem.ts --network sepolia
 *   UPGRADE_CONTRACT=Treasury pnpm hardhat run scripts/upgradeRewardsSystem.ts --network sepolia
 *
 * Environment variables:
 *   REWARDS_PROXY_ADDRESS - Rewards proxy address
 *   REWARDS_STATE_ADDRESS - RewardsState proxy address
 *   TREASURY_ADDRESS - Treasury proxy address
 *   UPGRADE_CONTRACT - (optional) Specific contract to upgrade: "Rewards", "RewardsState", "Treasury", or "all"
 */

// Default addresses (update after initial deployment)
const DEFAULT_ADDRESSES = {
    REWARDS_PROXY: process.env.REWARDS_PROXY_ADDRESS || '',
    REWARDS_STATE: process.env.REWARDS_STATE_ADDRESS || '',
    TREASURY: process.env.TREASURY_ADDRESS || '',
};

interface UpgradeResult {
    name: string;
    proxyAddress: string;
    oldImplementation: string;
    newImplementation: string;
    upgraded: boolean;
}

async function upgradeContract(
    contractName: string,
    proxyAddress: string
): Promise<UpgradeResult> {
    console.log(`\nUpgrading ${contractName}...`);
    console.log(`   Proxy: ${proxyAddress}`);

    // Get current implementation
    let oldImplementation: string;
    try {
        oldImplementation = await upgrades.erc1967.getImplementationAddress(proxyAddress);
        console.log(`   Current implementation: ${oldImplementation}`);
    } catch {
        throw new Error(`Could not get implementation for ${proxyAddress}. Is this a valid proxy?`);
    }

    // Get contract factory
    const ContractFactory = await ethers.getContractFactory(contractName);

    // Force import (required if not originally deployed via hardhat-upgrades)
    try {
        await upgrades.forceImport(proxyAddress, ContractFactory);
        console.log('   Proxy registered with upgrades plugin');
    } catch (e: any) {
        if (!e.message.includes('already been imported')) {
            console.log('   Note:', e.message);
        }
    }

    // Upgrade
    const upgraded = await upgrades.upgradeProxy(proxyAddress, ContractFactory, {
        kind: 'uups',
    });
    await upgraded.waitForDeployment();

    // Get new implementation
    const newImplementation = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log(`   New implementation: ${newImplementation}`);

    const wasUpgraded = oldImplementation.toLowerCase() !== newImplementation.toLowerCase();
    console.log(`   Upgraded: ${wasUpgraded ? 'YES' : 'NO (same implementation)'}`);

    return {
        name: contractName,
        proxyAddress,
        oldImplementation,
        newImplementation,
        upgraded: wasUpgraded,
    };
}

async function verifyContract(implementationAddress: string, contractName: string) {
    try {
        console.log(`   Verifying ${contractName} at ${implementationAddress}...`);
        await run('verify:verify', {
            address: implementationAddress,
            constructorArguments: [],
        });
        console.log(`   ${contractName} verified!`);
    } catch (e: any) {
        if (e.message.includes('Already')) {
            console.log(`   ${contractName}: Already verified`);
        } else {
            console.log(`   ${contractName} verification failed:`, e.message);
        }
    }
}

async function main() {
    const [deployer] = await ethers.getSigners();
    const upgradeTarget = process.env.UPGRADE_CONTRACT || 'all';

    console.log('========================================');
    console.log('Rewards System Upgrade');
    console.log('========================================');
    console.log('Deployer:', deployer.address);
    console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'ETH');
    console.log('Target:', upgradeTarget);
    console.log('========================================');

    const results: UpgradeResult[] = [];

    // Determine which contracts to upgrade
    const shouldUpgrade = {
        Rewards: upgradeTarget === 'all' || upgradeTarget === 'Rewards',
        RewardsState: upgradeTarget === 'all' || upgradeTarget === 'RewardsState',
        Treasury: upgradeTarget === 'all' || upgradeTarget === 'Treasury',
    };

    // Upgrade Rewards
    if (shouldUpgrade.Rewards) {
        if (!DEFAULT_ADDRESSES.REWARDS_PROXY) {
            console.log('\nSkipping Rewards: REWARDS_PROXY_ADDRESS not set');
        } else {
            const result = await upgradeContract('Rewards', DEFAULT_ADDRESSES.REWARDS_PROXY);
            results.push(result);
        }
    }

    // Upgrade RewardsState
    if (shouldUpgrade.RewardsState) {
        if (!DEFAULT_ADDRESSES.REWARDS_STATE) {
            console.log('\nSkipping RewardsState: REWARDS_STATE_ADDRESS not set');
        } else {
            const result = await upgradeContract('RewardsState', DEFAULT_ADDRESSES.REWARDS_STATE);
            results.push(result);
        }
    }

    // Upgrade Treasury
    if (shouldUpgrade.Treasury) {
        if (!DEFAULT_ADDRESSES.TREASURY) {
            console.log('\nSkipping Treasury: TREASURY_ADDRESS not set');
        } else {
            const result = await upgradeContract('Treasury', DEFAULT_ADDRESSES.TREASURY);
            results.push(result);
        }
    }

    // Wait for confirmations then verify
    if (results.some((r) => r.upgraded)) {
        console.log('\nWaiting for confirmations before verification...');
        await new Promise((resolve) => setTimeout(resolve, 30000));

        console.log('\nVerifying upgraded contracts...');
        for (const result of results) {
            if (result.upgraded) {
                await verifyContract(result.newImplementation, result.name);
            }
        }
    }

    // Summary
    console.log('\n========================================');
    console.log('UPGRADE SUMMARY');
    console.log('========================================');

    if (results.length === 0) {
        console.log('No contracts were upgraded. Check your environment variables.');
    } else {
        for (const result of results) {
            console.log(`\n${result.name}:`);
            console.log(`  Proxy: ${result.proxyAddress}`);
            console.log(`  Old Implementation: ${result.oldImplementation}`);
            console.log(`  New Implementation: ${result.newImplementation}`);
            console.log(`  Upgraded: ${result.upgraded ? 'YES' : 'NO'}`);
        }
    }

    console.log('\n========================================');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Upgrade failed:', error);
        process.exit(1);
    });
