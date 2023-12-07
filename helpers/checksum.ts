import fs from 'fs';
import crypto from 'crypto';
import glob from 'glob';
import path from 'path';

export function generateChecksum(str: string) {
    return crypto.createHash('md5').update(str, 'utf8').digest('hex');
}

export function generateChecksumFromFile(contractName: string): string {
    // Find contract file in contracts directory recursively
    const contractFiles = glob.sync(`**/${contractName}.sol`, {
        cwd: path.resolve('contracts'),
        absolute: true,
    });

    if (contractFiles.length === 0) {
        throw new Error(`Contract file ${contractName}.sol not found in directory`);
    }

    const data = fs.readFileSync(contractFiles[0]);
    const checksum = generateChecksum(data);
    return checksum;
}

export function writeChecksumToFile(contractName: string, tenant: string) {
    const filePath = path.resolve(`.achievo/checksums/checksum-${contractName}-${tenant}`);
    const checksum = generateChecksumFromFile(contractName);
    // Write to the file
    fs.writeFileSync(filePath, checksum);
    console.log(`checksum-${contractName}-${tenant} saved to ${filePath}`);
}

export function readChecksumFromFile(contractName: string, tenant: string): string | undefined {
    const filePath = path.resolve(`.achievo/checksums/checksum-${contractName}-${tenant}`);
    if (!fs.existsSync(filePath)) {
        console.log('checksum not found');
        return undefined;
    }

    const checksum = fs.readFileSync(filePath, 'utf8');
    console.log('checksum found', checksum);
    return checksum;
}

export function isAlreadyDeployed(contract: any, tenant: string): boolean {
    const checksum = generateChecksumFromFile(contract.contractName);
    const previousChecksum = readChecksumFromFile(contract.contractName, tenant);
    if (!previousChecksum) {
        return false;
    }
    let _isAlreadyDeployed = checksum === previousChecksum;

    const filePathDeploymentLatest = path.resolve(
        `.achievo/${contract.upgradable ? 'upgradeables/' : ''}deployments-${contract.type}-${tenant}-latest.json`
    );

    if (!fs.existsSync(filePathDeploymentLatest)) {
        console.log('checksum not found');
        _isAlreadyDeployed = false;
    }

    return _isAlreadyDeployed;
}
