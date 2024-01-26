import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { ACHIEVO_TMP_DIR } from '@constants/deployments';
import glob from 'glob';
import { DeploymentContract } from 'types/deployment-type';

const CHECKSUM_PATH = `${ACHIEVO_TMP_DIR}/checksums`;

export function generateChecksum(str: string) {
    return crypto.createHash('md5').update(str, 'utf8').digest('hex');
}

export function generateChecksumFromFile(contractFileName: string): string {
    // Find contract file in contracts directory recursively
    const contractFiles = glob.sync(`**/${contractFileName}.sol`, {
        cwd: path.resolve('contracts'),
        absolute: true,
    });

    if (contractFiles.length === 0) {
        throw new Error(`Contract file ${contractFileName}.sol not found in directory`);
    }

    const data = fs.readFileSync(contractFiles[0]);
    const checksum = generateChecksum(data);
    return checksum;
}

export function writeChecksumToFile(contractFileName: string, contractName: string, tenant: string) {
    const filePath = path.resolve(`${CHECKSUM_PATH}/checksum-${contractName}-${tenant}`);
    const checksum = generateChecksumFromFile(contractFileName);
    // Write to the file
    fs.writeFileSync(filePath, checksum);
    console.log(`checksum-${contractName}-${tenant} saved to ${filePath}`);
}

export function readChecksumFromFile(contractName: string, tenant: string): string | undefined {
    const filePath = path.resolve(`${CHECKSUM_PATH}/checksum-${contractName}-${tenant}`);
    if (!fs.existsSync(filePath)) {
        console.log('checksum not found');
        return undefined;
    }

    const checksum = fs.readFileSync(filePath, 'utf8');
    console.log('checksum found', checksum);
    return checksum;
}

export function isAlreadyDeployed(contract: DeploymentContract, tenant: string): boolean {
    const checksum = generateChecksumFromFile(contract.contractFileName);
    const previousChecksum = readChecksumFromFile(contract.name, tenant);
    if (!previousChecksum) {
        return false;
    }
    let _isAlreadyDeployed = checksum === previousChecksum;

    const filePathDeploymentLatest = path.resolve(
        `${ACHIEVO_TMP_DIR}/${contract.chain}/${contract.upgradable ? 'upgradeables/' : ''}deployments-${
            contract.name
        }-${tenant}-latest.json`
    );

    if (!fs.existsSync(filePathDeploymentLatest)) {
        console.log('checksum not found');
        _isAlreadyDeployed = false;
    }

    return _isAlreadyDeployed;
}
