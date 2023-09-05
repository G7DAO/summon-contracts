import { log } from '@helpers/logger';
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

  const data = await achievementFacet.hasRole(
    '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6',
    '0xa2f5785506b0344abfd15eefc4bde21d4cd3125b'
  );

  log(data);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
