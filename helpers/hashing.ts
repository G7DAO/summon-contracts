import { ethers } from 'ethers';

export function hashIds(storeId: number, gameId: number): string {
    const encoder = new ethers.AbiCoder();
    return encoder.encode(['uint256', 'uint256'], [storeId, gameId]).toString();
}
