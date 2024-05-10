import { NetworkName } from '@constants/network';
import { log } from '@helpers/logger';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { ExtensionFunction, ExtensionMetadata } from '@helpers/extensions';
import { Deployment, DeploymentExtensionContract, DeploymentProxyContract } from '../types/deployment-type';
import deploy from '../deploy/deploy';
import { getABIFilePath } from '@helpers/folder';
import { ExtensionManager } from '../typechain-types';

type DeployedExtension = {
    metadata: ExtensionMetadata;
    functions: ExtensionFunction[];
    abi: any;
    name: string;
};

enum ExtensionAction {
    ADD = 'add',
    REMOVE = 'remove',
    REPLACE = 'replace',
}

async function deployExtension(
    hre: HardhatRuntimeEnvironment,
    extension: DeploymentExtensionContract,
    tenant: string
): Promise<DeployedExtension> {
    const abiPath = getABIFilePath(hre.network.zksync, extension.contractFileName)!;
    const extensionDeployment = await deploy(hre, extension, extension.extensionArgs, abiPath, tenant);
    const functions = await getContractFunctionSelectors(
        hre,
        extensionDeployment.name,
        extensionDeployment.contractAddress,
        extension.functionsToInclude
    );

    return {
        metadata: {
            name: extension.metadata.name,
            metadataURI: extension.metadata.metadataURI,
            implementation: extensionDeployment.contractAddress,
        },
        functions,
        abi: extensionDeployment.contractAbi,
        name: extensionDeployment.name,
    };
}

async function getContractFunctionSelectors(
    hre: HardhatRuntimeEnvironment,
    contractName: string,
    contractAddress: string,
    functionSignatures: string[]
) {
    const contractInstance = await hre.ethers.getContractAt(contractName, contractAddress);

    let functions: ExtensionFunction[] = [];
    for (const functionSignature of functionSignatures) {
        const functionSelector = contractInstance.getFunction(functionSignature).getFragment().selector;
        functions.push({
            functionSelector,
            functionSignature,
        });
    }
    return functions;
}

async function deployExtensions(
    hre: HardhatRuntimeEnvironment,
    tenant: string,
    proxyDeployment: DeploymentProxyContract,
    extensionsName: string[]
) {
    const extensionsToDeploy: DeploymentExtensionContract[] = [];
    for (const extensionName of extensionsName) {
        const extensionToDeploy = proxyDeployment.extensions.find((ext) => ext.name === extensionName);
        if (!extensionToDeploy) continue;
        extensionsToDeploy.push(extensionToDeploy);
    }

    const deployedExtensions: DeployedExtension[] = [];
    for await (const extension of extensionsToDeploy) {
        const extensionDeployed = await deployExtension(hre, extension, tenant);
        deployedExtensions.push(extensionDeployed);
    }

    return deployedExtensions;
}

async function upgradeManagerExtensions(
    hre: HardhatRuntimeEnvironment,
    proxyAddress: string,
    deployedExtensions: DeployedExtension[],
    actions: string[]
) {
    log(`[EXTENSION MANAGER] Upgrading extensions`);
    log('\n');
    const manager: ExtensionManager = await hre.ethers.getContractAt('ExtensionManager', proxyAddress);
    for (let i = 0; i < deployedExtensions.length; i++) {
        const extension = deployedExtensions[i];
        const action = actions[i];
        log(`[EXTENSION] ${extension.metadata.name} - ${action}`);
        switch (action) {
            case ExtensionAction.ADD:
                await manager.addExtension(extension);
                break;
            case ExtensionAction.REMOVE:
                await manager.removeExtension(extension.metadata.name);
                break;
            case ExtensionAction.REPLACE:
                await manager.replaceExtension(extension);
                break;
            default:
                throw new Error(`Action ${action} not supported`);
        }
        log(`[EXTENSION] ${extension.metadata.name} - ${action} - DONE`);
        log('\n');
    }
}

export default async function (
    hre: HardhatRuntimeEnvironment,
    contract: DeploymentProxyContract,
    abiPath: string,
    tenant: string,
    proxyAddress: string,
    extension: string,
    action: string
): Promise<Deployment> {
    const networkName = hre.network.name as NetworkName;

    log('=====================================================');
    log(`[UPGRADING] Upgrading ${contract.name} contract for [[${tenant}]] on ${networkName}`);
    log('=====================================================');

    log('\n');
    log('=====================================================');
    log(`[EXTENSIONS DEPLOYMENT]`);
    log('=====================================================');

    const deployedExtensions: DeployedExtension[] = await deployExtensions(hre, tenant, contract, [extension]);

    log('\n');
    log('=====================================================');
    log(`[EXTENSION MANAGER UPDATE]`);
    log('=====================================================');

    await upgradeManagerExtensions(hre, proxyAddress, deployedExtensions, [action]);

    const deploymentPayload: Deployment = {} as Deployment; // TODO: Figure out how to update proxy info with updated extensions deployment

    log(`*****************************************************`);
    log(`Upgraded ${contract.type}(${contract.name}) for ${tenant}`);
    log(`*****************************************************`);

    return deploymentPayload;
}
