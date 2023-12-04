import fs from 'fs';
import crypto from 'crypto';
import glob from 'glob';

export function generateChecksum(str, algorithm, encoding) {
    return crypto
        .createHash(algorithm || 'md5')
        .update(str, 'utf8')
        .digest(encoding || 'hex');
}

export function isAlreadyDeployed(contractName, previousChecksum) {
    // Find contract file in contracts directory recursively
    const contractFiles = glob.sync(`**/${_contract.contractName}.sol`, {
        cwd: path.resolve('contracts'),
        absolute: true,
    });

    if (contractFiles.length === 0) {
        throw new Error(`Contract file ${_contract.contractName}.sol not found in directory`);
    }

    // Use the contract file path as needed
    const contractFilePath = contractFiles[0];

    const data = fs.readFileSync(contractFilePath);
    const checksum = generateChecksum(data);

    return checksum === previousChecksum;
}
