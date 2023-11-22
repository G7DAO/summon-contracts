import { Signer, solidityPacked, getBytes } from 'ethers';

export async function generateSignature({ walletAddress, signer }: { walletAddress: string; signer: Signer }) {
    const nonce = Math.floor(1000000 * Math.random());

    let message = solidityPacked(['address', 'uint256'], [walletAddress, nonce]);
    message = solidityPacked(['bytes'], [message]);
    const signature = await signer.signMessage(getBytes(message));

    return {
        nonce,
        signature,
    };
}
