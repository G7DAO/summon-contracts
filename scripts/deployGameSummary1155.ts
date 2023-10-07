import { log } from '@helpers/logger';
import { ethers } from 'hardhat';

import { GameAchievements, GameSummary1155 } from '../typechain-types';
import { verifyContract } from '@helpers/verify';

async function main() {
  const { PRIVATE_KEY, PUBLIC_KEY } = process.env;

  if (!PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY env required');
  }

  if (!PUBLIC_KEY) {
    throw new Error('PUBLIC_KEY env required');
  }

  const provider = ethers.provider;
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);
  const gameAchievementsContract = await ethers.getContractFactory('GameSummary1155', signer);

  const gameAchievements = (await gameAchievementsContract.deploy('https://achievo.mypinata.cloud/ipfs/')) as unknown as GameSummary1155;
  await gameAchievements.deployed();
  log('GameSummary1155 deployed:', gameAchievements.address);

  const minterRole = await gameAchievements.MINTER_ROLE();
  const hasMinterRole = await gameAchievements.hasRole(minterRole, PUBLIC_KEY);
  if (!hasMinterRole) {
    const tx = await gameAchievements.grantRole(minterRole, PUBLIC_KEY);
    await tx.wait();
    log('Minter role granted');
  }

  const gameCreatorRole = await gameAchievements.GAME_CREATOR_ROLE();
  const hasGameCreatorRole = await gameAchievements.hasRole(gameCreatorRole, PUBLIC_KEY);
  if (!hasGameCreatorRole) {
    const tx = await gameAchievements.grantRole(gameCreatorRole, PUBLIC_KEY);
    await tx.wait();
    log('Game creator role granted');
  }

  // log('Verifying contract ... ');
  // await verifyContract({
  //   contractAddress: gameAchievements.address,
  //   constructorArguments: ['https://achievo.mypinata.cloud/ipfs/'],
  //   signer,
  //   txHash: gameAchievements.deployTransaction.hash,
  // });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
