import { log } from '@helpers/logger';
import { ethers } from 'hardhat';

import { GameAchievements } from '../typechain-types';
import { verifyContract } from '@helpers/verify';

async function main() {
  const { PRIVATE_KEY, PUBLIC_KEY } = process.env;

  if (!PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY env required');
  }

  if(!PUBLIC_KEY) {
    throw new Error('PUBLIC_KEY env required');
  }

  const provider = ethers.provider;
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);
  const gameAchievementsContract = await ethers.getContractFactory('GameSummary1155', signer);

  const gameAchievements = (await gameAchievementsContract.deploy('https://achievo.mypinata.cloud/ipfs/')) as unknown as GameAchievements;
  await gameAchievements.deployed();
  log('GameSummary1155 deployed:', gameAchievements.address);
  log('Verifing contract ... ');
  await verifyContract({
    contractAddress: gameAchievements.address,
    constructorArguments: ['https://achievo.mypinata.cloud/ipfs/'],
    signer,
    txHash: gameAchievements.deployTransaction.hash,
  });

  const hasRole = await gameAchievements.hasRole('0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6', PUBLIC_KEY);

  log(`Has role: ${hasRole}`);

  if (!hasRole) {
    const tx = await gameAchievements.grantRole('0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6', PUBLIC_KEY);
    await tx.wait();
    log('Role granted');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
