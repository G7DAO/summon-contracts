import * as ethers from 'ethers';

export const encoder = (
    types: readonly (string | ethers.ethers.ParamType)[],
    values: readonly any[],
    sliceNumber?: number
): string => {
    const abiCoder = new ethers.AbiCoder();
    const encodedParams = abiCoder.encode(types, values);

    if (sliceNumber) return encodedParams.slice(sliceNumber);
    else {
        return encodedParams;
    }
};
