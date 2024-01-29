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
    const contract = new ethers.Contract('X', abi, signer) as GameAchievements;

    const hasRole = await contract.hasRole('X', 'X2');

    log(`Has role: ${hasRole}`);

    if (!hasRole) {
        const tx = await contract.grantRole('X', 'X2');
        await tx.wait();
        log('Role granted');
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
