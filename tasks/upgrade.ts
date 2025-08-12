import fs from 'fs';
import path from 'path';

import { CONTRACTS, ACHIEVO_TMP_DIR } from '@constants/upgrades';
import { writeChecksumToFile } from '@helpers/checksum';
import { createDefaultFolders, getABIFilePath } from '@helpers/folder';
import { log } from '@helpers/logger';
import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Deployment, DeploymentContract, FunctionCall } from 'types/deployment-type';

import upgrade from '../deploy/upgrade';
import { executeFunctionCallBatch, submitContractDeploymentsToDB } from '@helpers/contract';

const upgradeOne = async (
    hre: HardhatRuntimeEnvironment,
    contract: DeploymentContract,
    tenant: string
): Promise<Deployment> => {
    // const abiPath = getABIFilePath(contract.contractName); // No longer needed here
    const filePathDeploymentLatest = path.resolve(
        `${ACHIEVO_TMP_DIR}/${contract.chain}/${contract.upgradable ? 'upgradeables/' : ''}deployments-${contract.type
        }-${tenant}-latest.json`
    );

    // Call the refactored upgrade function
    const upgradePayload = await upgrade(hre, contract, tenant);

    // writeChecksumToFile needs 3 arguments: contractFileName, logicalName, tenant
    writeChecksumToFile(contract.contractFileName, contract.name, tenant);

    // Convert deployments to JSON
    const upgradeJson = JSON.stringify(upgradePayload, null, 2);
    // Write to the file
    fs.writeFileSync(filePathDeploymentLatest, upgradeJson);
    log(`Upgrade information saved to ${filePathDeploymentLatest}`);

    return upgradePayload;
};

task('upgrade', 'Upgrade Smart contracts')
    .addParam('name', 'Contract Name you want to upgrade', undefined, types.string)
    .addParam('contractversion', 'Version you want to upgrade to, eg: 2', undefined, types.int)
    .addFlag('submit', 'Do you want to submit to db?')
    .setAction(async (_args: { name: string; contractversion: number; submit: boolean }, hre: HardhatRuntimeEnvironment) => {
        const { name, contractversion: contractVersion, submit } = _args;
        const network = hre.network.name;
        log('└─ args :\n');
        log(`   ├─ contractName : ${name}\n`);
        log(`   ├─ network : ${network}\n`);
        log(`   └─ version : ${contractVersion}\n`);

        createDefaultFolders(network); // create default folders

        const contract = CONTRACTS.find(
            (d: DeploymentContract) => d.name === name && d.chain === network && d.version === contractVersion
        );

        if (!contract) {
            throw new Error(`Contract ${name} not found on ${network}`);
        }

        for (const tenant of contract.tenants) {
            log('=====================================================');
            log('=====================================================');
            log(`[STARTING] Upgrade ${name} contract to version ${contractVersion} on ${network} for [[${tenant}]]`);
            log('=====================================================');
            log('=====================================================');
            log('\n');
            log('\n');
            log('\n');
            log('\n');

            const upgradedContract = await upgradeOne(hre, contract, tenant);

            log('=====================================================');
            log(`[DONE] ${name} contract deployment on ${network} for [[${tenant}]] is DONE!`);
            log('=====================================================');
            log('\n');

            // submit to db - Adapted for single upgrade
            if (submit) {
                try {
                    log('*******************************************');
                    log('[SUBMITTING] Upgrade info to db');
                    log('*******************************************');
                    // Assuming submitContractDeploymentsToDB can take Deployment[] and upgradedContract is a single Deployment object
                    await submitContractDeploymentsToDB([ upgradedContract ], tenant);
                    log('*******************************************');
                    log('*** Upgrade info submitted to db ***');
                    log('*******************************************');
                } catch (error: any) {
                    console.error('Error submitting upgrade info to db:', JSON.stringify(error, null, 2));
                    log('*******************************************');
                    log('*** DB Submission Error:', error.message, '***');
                    log('*******************************************');
                }
            }
        }
    });
