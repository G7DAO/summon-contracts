import { log } from '@helpers/logger';
import { ethers } from 'hardhat';

import { GameAchievements } from '../typechain-types';
import { verifyContract } from '@helpers/verify';

async function main() {
  const { PRIVATE_KEY } = process.env;

  if (!PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY env required');
  }

  const provider = ethers.provider;
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);
  const gameAchievementsContract = await ethers.getContractFactory('GameAchievements', signer);

  const gameAchievements = (await gameAchievementsContract.deploy('https://achievo.mypinata.cloud/ipfs/')) as unknown as GameAchievements;
  await gameAchievements.deployed();
  log('GameAchievements deployed:', gameAchievements.address);
  log('Verifing contract ... ');
  await verifyContract({
    contractAddress: gameAchievements.address,
    constructorArguments: ['https://achievo.mypinata.cloud/ipfs/'],
    signer,
    txHash: gameAchievements.deployTransaction.hash,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
