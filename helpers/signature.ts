import { Signer, solidityPacked, getBytes, solidityPackedKeccak256, keccak256 } from 'ethers';

export async function generateSignature({ walletAddress, signer }: { walletAddress: string; signer: Signer }) {
    const nonce = Math.floor(1000000 * Math.random());

    let message = solidityPacked(['address', 'bytes', 'uint256'], [walletAddress, '0x', nonce]);
    message = solidityPackedKeccak256(['bytes'], [message]);
    const signature = await signer.signMessage(getBytes(message));

    return {
        nonce,
        signature,
    };
}
