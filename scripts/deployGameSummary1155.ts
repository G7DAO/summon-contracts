import { log } from '@helpers/logger';
import { verifyContract } from '@helpers/verify';
import { ethers } from 'hardhat';

import { GameSummary1155 } from '../typechain-types';

async function main() {
    const { PRIVATE_KEY } = process.env;

    if (!PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY env required');
    }

    const provider = ethers.provider;
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    const gameAchievementsContract = await ethers.getContractFactory('GameSummary1155', signer);

    const gameAchievements = (await gameAchievementsContract.deploy('https://achievo.mypinata.cloud/ipfs')) as unknown as GameSummary1155;
    await gameAchievements.deployed();
    log('GameSummary1155 deployed:', gameAchievements.address);

    const minterRole = await gameAchievements.MINTER_ROLE();
    const hasMinterRole = await gameAchievements.hasRole(minterRole, signer.address);
    if (!hasMinterRole) {
        const tx = await gameAchievements.grantRole(minterRole, signer.address);
        await tx.wait();
        log('Minter role granted');
    }

    const gameCreatorRole = await gameAchievements.GAME_CREATOR_ROLE();
    const hasGameCreatorRole = await gameAchievements.hasRole(gameCreatorRole, signer.address);
    if (!hasGameCreatorRole) {
        const tx = await gameAchievements.grantRole(gameCreatorRole, signer.address);
        await tx.wait();
        log('Game creator role granted');
    }

    log('Verifying contract ... ');
    await verifyContract({
        contractAddress: gameAchievements.address,
        constructorArguments: ['https://achievo.mypinata.cloud/ipfs'],
        signer,
        txHash: gameAchievements.deployTransaction.hash,
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
