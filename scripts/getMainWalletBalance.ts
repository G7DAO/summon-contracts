import { ethers, network } from 'hardhat';
import { formatUnits } from 'ethers/lib/utils';
import { ChainId } from '@constants/network';

async function main() {
  if (network.config.chainId !== ChainId.PolygonMumbai) {
    throw new Error('Only Mumbai validation available');
  }
  const [account] = await ethers.getSigners();
  const address = account.address;
  const balance = await account.getBalance();

  console.log('Main account address: ', address);
  console.log('Main account formatted ETH: ', formatUnits(balance, 'ether'));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
