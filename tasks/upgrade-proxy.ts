import { getABIFilePath } from '@helpers/folder';
import { log } from '@helpers/logger';
import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Deployment, DeploymentProxyContract } from 'types/deployment-type';

import upgradeProxy from '../deploy/upgrade-proxy';
import { CONTRACTS } from '@constants/proxy-deployments';

const upgradeOne = async (
    hre: HardhatRuntimeEnvironment,
    contract: DeploymentProxyContract,
    tenant: string,
    proxyAddress: string,
    extension: string,
    action: string
): Promise<Deployment> => {
    const abiPath = getABIFilePath(hre.network.zksync, contract.name);
    const upgradePayload = await upgradeProxy(
        hre,
        contract,
        abiPath as string,
        tenant,
        proxyAddress,
        extension,
        action
    );

    // TODO: Maybe should write the upgradePayload to a file ?

    return upgradePayload;
};

task('upgrade-proxy', 'Upgrade Smart contracts')
    .addParam('name', 'Contract Name you want to upgrade', undefined, types.string)
    .addParam('address', 'Contract address you want to upgrade', undefined, types.string)
    .addParam('extension', 'Extension to add', undefined, types.string)
    .addParam('action', 'Action to perform', undefined, types.string)
    .setAction(
        async (
            _args: {
                name: string;
                address: string;
                extension: string;
                action: string;
            },
            hre: HardhatRuntimeEnvironment
        ) => {
            const { name, extension, action, address: proxyAddress } = _args;
            const network = hre.network.name;
            log('└─ args :\n');
            log(`   ├─ contractName : ${name}\n`);
            log(`   ├─ network : ${network}\n`);
            log(`   └─ proxyAddress : ${proxyAddress}\n`);
            log(`   └─ extension : ${extension}\n`);
            log(`   └─ action : ${action}\n`);

            const contract = CONTRACTS.find((d) => d.name === name && d.chain === network);

            if (!contract) {
                throw new Error(`Contract ${name} not found on ${network}`);
            }

            for (const tenant of contract.tenants) {
                log('=====================================================');
                log('=====================================================');
                log(`[STARTING] Upgrade ${name} contract on ${network} for [[${tenant}]]`);
                log('=====================================================');
                log('=====================================================');
                log('\n');

                await upgradeOne(hre, contract, tenant, proxyAddress, extension, action);

                log('=====================================================');
                log(`[DONE] ${name} contract deployment on ${network} for [[${tenant}]] is DONE!`);
                log('=====================================================');
                log('\n');
            }
        }
    );
