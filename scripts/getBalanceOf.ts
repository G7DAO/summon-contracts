import { log } from '@helpers/logger';
import { ethers } from 'hardhat';

import { abi } from '../artifacts/contracts/facets/AchievementsFacet.sol/AchievementFacet.json';
import { AchievementFacet } from '../typechain-types';

async function main() {
  const { PRIVATE_KEY, DIAMOND_ADDRESS, PUBLIC_KEY } = process.env;

  if (!PRIVATE_KEY || !PUBLIC_KEY || !DIAMOND_ADDRESS) {
    throw new Error('PRIVATE_KEY env required');
  }

  const provider = ethers.provider;
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);
  const achievements = new ethers.Contract(DIAMOND_ADDRESS, abi, signer) as AchievementFacet;
  const avatarsQty = await achievements.balanceOf(PUBLIC_KEY, 3);

  log(`Achievement quantity for ${PUBLIC_KEY}`);
  log(`Achievement quantity of id 3:`, Number(avatarsQty));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
