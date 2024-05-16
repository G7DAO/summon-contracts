import { log } from '@helpers/logger';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { DeployedExtension, ExtensionAction, ExtensionFunction } from '@helpers/extensions';
import { Deployment, DeploymentExtensionContract, DeploymentProxyContract } from '../types/deployment-type';
import deploy from '../deploy/deploy';
import { getABIFilePath } from '@helpers/folder';
import { ExtensionManager } from '../typechain-types';
import { CONTRACT_EXTENSION_NAME } from '@constants/contract';
import { TENANT } from '@constants/tenant';
import { populateConstructorArgs } from '../tasks';

export async function deployExtension(
    hre: HardhatRuntimeEnvironment,
    extension: DeploymentExtensionContract,
    tenant: TENANT
): Promise<DeployedExtension> {
    const abiPath = getABIFilePath(hre.network.zksync, extension.contractFileName)!;
    let constructorArgs;
    if (extension.extensionArgs) {
        constructorArgs = await populateConstructorArgs(hre, extension.extensionArgs, tenant);
    }
    const extensionDeployment = await deploy(hre, extension, constructorArgs, abiPath, tenant);
    const functions = await getContractFunctionSelectors(
        hre,
        extension.contractFileName,
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

export async function deployExtensions(
    hre: HardhatRuntimeEnvironment,
    tenant: TENANT,
    proxyDeployment: DeploymentProxyContract,
    extensionsName: CONTRACT_EXTENSION_NAME[]
) {
    log('\n');
    log('=====================================================');
    log(`[EXTENSIONS DEPLOYMENT]`);
    log('=====================================================');

    const extensionsToDeploy: DeploymentExtensionContract[] = [];
    for (const extensionName of extensionsName) {
        const extensionToDeploy = proxyDeployment?.extensions?.find((ext) => ext.name === extensionName);
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

export async function upgradeManagerExtensions(
    hre: HardhatRuntimeEnvironment,
    proxyAddress: string,
    deployedExtensions: DeployedExtension[],
    actions: ExtensionAction[]
) {
    log('\n');
    log('=====================================================');
    log(`[EXTENSION MANAGER] Upgrading extensions`);
    log('=====================================================');
    log('\n');

    const manager: ExtensionManager = await hre.ethers.getContractAt('ExtensionManager', proxyAddress);
    for (let i = 0; i < deployedExtensions.length; i++) {
        const extension = deployedExtensions[i];
        const action = actions[i];
        log(`[EXTENSION] ${extension.metadata.name} - ${action}`);
        switch (action.toLowerCase()) {
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

function updateDbContractDeployment(dbContract: Deployment, deployedExtensions: DeployedExtension[]) {
    const updatedDbContract = dbContract;
    updatedDbContract.extensions = deployedExtensions.map((ext) => ({
        abi: ext.abi,
        address: ext.metadata.implementation,
        functions: ext.functions,
        name: ext.name,
    }));
    return updatedDbContract;
}

export default async function (
    hre: HardhatRuntimeEnvironment,
    proxyDeployment: DeploymentProxyContract,
    dbContract: Deployment,
    tenant: TENANT,
    extension: CONTRACT_EXTENSION_NAME,
    action: ExtensionAction
): Promise<Deployment> {
    log('=====================================================');
    log(`[UPGRADING] Upgrading ${proxyDeployment.name} contract for [[${tenant}]]`);
    log('=====================================================');

    const deployedExtensions: DeployedExtension[] = await deployExtensions(hre, tenant, proxyDeployment, [extension]);
    await upgradeManagerExtensions(hre, dbContract.contractAddress, deployedExtensions, [action]);
    const deployment = updateDbContractDeployment(dbContract, deployedExtensions);

    log(`*****************************************************`);
    log(`Upgraded ${proxyDeployment.type}(${proxyDeployment.name}) for ${tenant}`);
    log(`*****************************************************`);

    return deployment;
}
