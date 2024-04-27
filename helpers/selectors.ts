import { ethers } from 'ethers';
import { ExtensionSelector } from '../types/deployment-type';

export function getSelectorBySignatureFunction(functionSignature: string): ExtensionSelector {
    const functionSelector = ethers.Fragment.from(functionSignature).format('sighash');
    return {
        functionSelector,
        functionSignature,
    };
}
