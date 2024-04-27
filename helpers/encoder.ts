import { AbiCoder } from 'ethers';

export function functionEncoder(values: string[], functionArgs: any[]): string {
    const abiCoder = AbiCoder.defaultAbiCoder();
    return abiCoder.encode(values, functionArgs);
}
