import { log } from '@helpers/logger';
import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Deployment } from 'types/deployment-type';

import upgradeProxy from '../deploy/upgrade-proxy';
import { CONTRACTS } from '@constants/proxy-deployments';
import { getContractFromDB, submitContractDeploymentsToDB } from '@helpers/contract';
import { CONTRACT_EXTENSION_NAME, CONTRACT_NAME } from '@constants/contract';
import { ExtensionAction } from '@helpers/extensions';
import { TENANT } from '@constants/tenant';
import path from 'path';
import { ACHIEVO_TMP_DIR } from '@constants/deployments';
import fs from 'fs';

export const writeUpgradePayload = (deploymentPayload: Deployment, chain: string, tenant: TENANT) => {
    log('*******************************************');
    log('[SAVING] Upgrade Payload');
    log('*******************************************');

    if (!fs.existsSync(`${ACHIEVO_TMP_DIR}/upgrades`)) {
        fs.mkdirSync(`${ACHIEVO_TMP_DIR}/upgrades`);
    }

    if (!fs.existsSync(`${ACHIEVO_TMP_DIR}/upgrades/${chain}`)) {
        fs.mkdirSync(`${ACHIEVO_TMP_DIR}/upgrades/${chain}`);
    }

    // Define the path to the file
    const filePath = path.resolve(
        `${ACHIEVO_TMP_DIR}/upgrades/${chain}/upgrades-${deploymentPayload.type}-${tenant}-${Date.now()}.json`
    );
    // Convert deployments to JSON
    const deploymentsJson = JSON.stringify(deploymentPayload, null, 2);
    // Write to the file
    fs.writeFileSync(filePath, deploymentsJson);

    log('*******************************************');
    log(`Upgrade saved to ${filePath}`);
    log('*******************************************');
};

task('upgrade-proxy', 'Upgrade Smart contracts')
    .addParam('name', 'Contract Name you want to upgrade', undefined, types.string)
    .addParam('extension', 'Extension name', undefined, types.string)
    .addParam('action', 'Extension Manager Action', undefined, types.string)
    .setAction(
        async (
            _args: {
                name: CONTRACT_NAME;
                extension: CONTRACT_EXTENSION_NAME;
                action: ExtensionAction;
            },
            hre: HardhatRuntimeEnvironment
        ) => {
            const { name, extension, action } = _args;
            const network = hre.network.name;

            log('└─ args :\n');
            log(`   ├─ contractName : ${name}\n`);
            log(`   ├─ network : ${network}\n`);
            log(`   └─ extension : ${extension}\n`);
            log(`   └─ action : ${action}\n`);

            const proxyDeployment = CONTRACTS.find((d) => d.name === name && d.chain === network);
            if (!proxyDeployment) {
                throw new Error(`Contract ${name} not found on ${network}`);
            }

            for (const tenant of proxyDeployment.tenants) {
                log('=====================================================');
                log('=====================================================');
                log(`[STARTING] Upgrade ${name} contract on ${network} for [[${tenant}]]`);
                log('=====================================================');
                log('=====================================================');
                log('\n');

                const chainId = hre.network.config.chainId!;
                const dbContract = await getContractFromDB(name, chainId);
                if (!dbContract) {
                    throw new Error(`Contract ${name} not found in DB for chain ${chainId}`);
                }
                const deployment = await upgradeProxy(hre, proxyDeployment, dbContract, tenant, extension, action);

                log('=====================================================');
                log(`[DONE] ${name} contract deployment on ${network} for [[${tenant}]] is DONE!`);
                log('=====================================================');
                log('\n');

               // submit to db
                try {
                    log('*******************************************');
                    log('[SUBMITTING] Deployments to db');
                    log('*******************************************');
                    await submitContractDeploymentsToDB([deployment], tenant);
                    log('*******************************************');
                    log('*** Deployments submitted to db ***');
                    log('*******************************************');
                } catch (error: any) {
                    log('*******************************************');
                    log('***', error.message, '***');
                    log('*******************************************');
                }

                writeUpgradePayload(deployment, network, tenant);
            }
        }
    );
