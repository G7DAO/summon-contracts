import { ethers, network } from 'hardhat';
import { ChainId } from '@constants/network';
import { abi } from '../artifacts/contracts/SummonAvatar.sol/SummonAvatar.json';
import { SummonAvatar } from '../typechain-types';

async function main() {
  const { PRIVATE_KEY } = process.env;

  if (!PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY env required');
  }

  if (network.config.chainId === ChainId.PolygonMumbai) {
    const provider = ethers.provider;
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    const avatar = new ethers.Contract(process.env.AVATAR_ADDRESS!, abi, signer) as SummonAvatar;
    const tx = await avatar.safeMint(process.env.PUBLIC_KEY!, '0.json');
    await tx.wait();
    console.log('TX: ', tx.hash);
  } else {
    throw new Error('only Mumbai allowed for now');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
