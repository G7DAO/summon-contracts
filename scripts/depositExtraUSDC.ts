import { ethers } from 'hardhat';

/**
 * Script to deposit extra USDC to treasury so there's available balance
 */

const REWARDS_ADDRESS = '0x4163079Aa7d3ed57755c7278BA4156a826E25Ad4';
const MOCK_USDC_ADDRESS = '0x3E3a445731d7881a3729A3898D532D5290733Eb5';

// Amount to deposit (extra, not reserved for rewards)
const EXTRA_DEPOSIT = ethers.parseUnits('1000000', 6); // 1,000,000 USDC extra

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log('Depositing extra USDC with account:', deployer.address);

    const rewards = await ethers.getContractAt('Rewards', REWARDS_ADDRESS);
    const usdc = await ethers.getContractAt('MockUSDC', MOCK_USDC_ADDRESS);

    // Check current balances
    console.log('\n========================================');
    console.log('Before Deposit:');
    console.log('========================================');
    
    const [addresses, totalBalances, reservedBalances, availableBalances] = 
        await rewards.getAllTreasuryBalances();
    
    const usdcIndex = addresses.findIndex(
        (addr: string) => addr.toLowerCase() === MOCK_USDC_ADDRESS.toLowerCase()
    );
    
    if (usdcIndex >= 0) {
        console.log('USDC Total Balance:', ethers.formatUnits(totalBalances[usdcIndex], 6));
        console.log('USDC Reserved Balance:', ethers.formatUnits(reservedBalances[usdcIndex], 6));
        console.log('USDC Available Balance:', ethers.formatUnits(availableBalances[usdcIndex], 6));
    }

    // Check deployer USDC balance
    const deployerBalance = await usdc.balanceOf(deployer.address);
    console.log('\nDeployer USDC Balance:', ethers.formatUnits(deployerBalance, 6));

    if (deployerBalance < EXTRA_DEPOSIT) {
        console.log('\nMinting more USDC to deployer...');
        const mintTx = await usdc.mint(deployer.address, EXTRA_DEPOSIT);
        await mintTx.wait();
        console.log('Minted', ethers.formatUnits(EXTRA_DEPOSIT, 6), 'USDC');
    }

    // Approve and deposit
    console.log('\nApproving USDC...');
    const approveTx = await usdc.approve(REWARDS_ADDRESS, EXTRA_DEPOSIT);
    await approveTx.wait();

    console.log('Depositing', ethers.formatUnits(EXTRA_DEPOSIT, 6), 'USDC to treasury...');
    const depositTx = await rewards.depositToTreasury(MOCK_USDC_ADDRESS, EXTRA_DEPOSIT);
    await depositTx.wait();

    // Check new balances
    console.log('\n========================================');
    console.log('After Deposit:');
    console.log('========================================');
    
    const [addresses2, totalBalances2, reservedBalances2, availableBalances2] = 
        await rewards.getAllTreasuryBalances();
    
    const usdcIndex2 = addresses2.findIndex(
        (addr: string) => addr.toLowerCase() === MOCK_USDC_ADDRESS.toLowerCase()
    );
    
    if (usdcIndex2 >= 0) {
        console.log('USDC Total Balance:', ethers.formatUnits(totalBalances2[usdcIndex2], 6));
        console.log('USDC Reserved Balance:', ethers.formatUnits(reservedBalances2[usdcIndex2], 6));
        console.log('USDC Available Balance:', ethers.formatUnits(availableBalances2[usdcIndex2], 6));
    }

    console.log('\nDone! Extra USDC deposited to treasury.');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
