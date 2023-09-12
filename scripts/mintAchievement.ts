import { ethers } from 'hardhat';

import { abi } from '../artifacts/contracts/facets/AchievementsFacet.sol/AchievementFacet.json';
import { AchievementFacet } from '../typechain-types';

async function main() {
  const { PRIVATE_KEY } = process.env;

  if (!PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY env required');
  }

  const provider = ethers.provider;
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const achievementFacet = new ethers.Contract(process.env.DIAMOND_ADDRESS!, abi, signer) as AchievementFacet;
  const tx = await achievementFacet.mint(process.env.PUBLIC_KEY!, 3, 302, false);

  await tx.wait();
  console.log('TX: ', tx.hash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
