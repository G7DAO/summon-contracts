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

const upgradeOne = async (
    hre: HardhatRuntimeEnvironment,
    contract: DeploymentContract,
    tenant: string
): Promise<Deployment> => {
    const abiPath = getABIFilePath(hre.network.zksync, contract.contractName);
    const filePathDeploymentLatest = path.resolve(
        `${ACHIEVO_TMP_DIR}/${contract.chain}/${contract.upgradable ? 'upgradeables/' : ''}deployments-${
            contract.type
        }-${tenant}-latest.json`
    );

    const upgradePayload = await upgrade(hre, contract, abiPath as string, tenant);

    writeChecksumToFile(contract.contractName as unknown as string, tenant);

    // Convert deployments to JSON
    const upgradeJson = JSON.stringify(upgradePayload, null, 2);
    // Write to the file
    // fs.writeFileSync(filePathDeploymentLatest, upgradeJson);
    // log(`Deployments saved to ${filePathDeploymentLatest}`);

    return upgradePayload;
};

task('upgrade', 'Upgrade Smart contracts')
    .addParam('name', 'Contract Name you want to upgrade', undefined, types.string)
    .addParam('contractversion', 'Version you want to upgrade to, eg: 2', undefined, types.int)
    .setAction(async (_args: { name: string; contractversion: number }, hre: HardhatRuntimeEnvironment) => {
        const { name, contractversion: contractVersion } = _args;
        const network = hre.network.name;
        log('└─ args :\n');
        log(`   ├─ contractName : ${name}\n`);
        log(`   ├─ network : ${network}\n`);
        log(`   └─ version : ${contractVersion}\n`);

        createDefaultFolders(network); // create default folders

        const contract = CONTRACTS.find((d) => d.name === name && d.chain === network && d.version === contractVersion);

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

            // // submit to db
            // try {
            //     log('*******************************************');
            //     log('[SUBMITTING] Deployments to db');
            //     log('*******************************************');
            //     await submitContractDeploymentsToDB(deployments, tenant);
            //     log('*******************************************');
            //     log('*** Deployments submitted to db ***');
            //     log('*******************************************');
            // } catch (error: any) {
            //     log('*******************************************');
            //     log('***', error.message, '***');
            //     log('*******************************************');
            // }

            // const calls = [];
            // for (const deployment of deployments) {
            //     // write deployment payload per tenant
            //     // Define the path to the file
            //     const filePath = path.resolve(
            //         `${ACHIEVO_TMP_DIR}/deployments/${contract.chain}/${
            //             contract.upgradable ? 'upgradeables/' : ''
            //         }deployments-${deployment.type}-${tenant}-${Date.now()}.json`
            //     );
            //     // Convert deployments to JSON
            //     const deploymentsJson = JSON.stringify(deployment, null, 2);
            //     // Write to the file
            //     fs.writeFileSync(filePath, deploymentsJson);

            //     log(`Deployments saved to ${filePath}`);

            //     const deployedContract = CONTRACTS.find(
            //         (d) => d.type === deployment.type && d.chain === network && d.upgradable === deployment.upgradable
            //     );

            //     if (!deployedContract?.functionCalls || deployedContract?.functionCalls?.length === 0) {
            //         continue;
            //     }

            //     for (const call of deployedContract?.functionCalls) {
            //         console.log(
            //             `[CALLING]: ${deployedContract.contractName} on ${deployedContract.chain} for ${tenant} `
            //         );
            //         const _call = await prepFunctionOne(hre, call, tenant, deployment.contractAddress);
            //         calls.push(_call);
            //     }
            // }

            // // execute function calls
            // await executeFunctionCallBatch(calls, tenant);
        }
    });
