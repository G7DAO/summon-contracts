import {
    Signer,
    solidityPacked,
    getBytes,
    solidityPackedKeccak256,
    keccak256,
    AbiCoder,
    zeroPadValue,
    ethers,
    concat,
} from 'ethers';
import { encodeAbiParameters, encodePacked, Hex, parseAbiParameters, Hash } from 'viem';

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

export async function generateRandomSeed({
    smartContractAddress,
    chainId,
    decode,
    rawData,
    address,
    signer,
}: {
    smartContractAddress: string;
    chainId: number;
    decode: boolean;
    rawData: { type: string; data: any };
    address: string;
    signer: ethers.Signer;
}) {
    const nonce = Math.floor(1000000 * Math.random());

    // Always include contract address and chainId
    const toEncodeType: string[] = ['address', 'uint256'];
    const toEncode: any[] = [smartContractAddress, chainId];

    toEncodeType.push(rawData.type);
    toEncode.push(rawData.data);
    const encodedSeed: Hex = encodeAbiParameters(parseAbiParameters(toEncodeType.join(',')), toEncode);

    let message: Hash | string = encodePacked(
        ['address', 'bytes', 'uint256'],
        [address as `0x${string}`, encodedSeed, BigInt(nonce)]
    );

    message = keccak256(message);

    // Sign using ethers
    const signature = await signer.signMessage(ethers.getBytes(message));

    const response: {
        nonce: number;
        signature: string;
        seed: Hex;
        decodeSeed?: any;
    } = {
        nonce,
        signature,
        seed: encodedSeed,
    };

    if (decode) {
        response.decodeSeed = toEncode;
    }

    return response;
}
