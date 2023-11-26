import { log } from '@helpers/logger';
import { ethers } from 'hardhat';

import { abi } from '../artifacts/contracts/GameAchievements.sol/GameAchievements.json';
import { GameAchievements } from '../typechain-types';

async function main() {
    const { PRIVATE_KEY } = process.env;

    if (!PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY env required');
    }

    const provider = ethers.provider;
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const contract = new ethers.Contract('0x7763B2092A93e79Cf1606347B471fd506db0883D', abi, signer) as GameAchievements;

    const hasRole = await contract.hasRole('0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6', '0xa10648f8618a526bd0acb08a1b9f413bc44fcb4b');

    log(`Has role: ${hasRole}`);

    if (!hasRole) {
        const tx = await contract.grantRole('0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6', '0xa10648f8618a526bd0acb08a1b9f413bc44fcb4b');
        await tx.wait();
        log('Role granted');
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
