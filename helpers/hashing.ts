import { ethers } from 'ethers';

export function hashIds(storeId: number, gameId: number): string {
    const hash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'uint256'], [storeId, gameId]));
    return BigInt(hash).toString();
}
