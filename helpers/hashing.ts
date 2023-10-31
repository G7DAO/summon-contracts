import { ethers } from 'ethers';

export function hashIds(storeId: number, gameId: number) {
  const hash = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [storeId, gameId]));
  return ethers.BigNumber.from(hash).toString();
}
