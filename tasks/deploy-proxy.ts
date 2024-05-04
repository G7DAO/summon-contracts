import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import fs from 'fs';
import path from 'path';

import { executeFunctionCallBatch, getContractFromDB, submitContractDeploymentsToDB } from '@helpers/contract';
import { encryptPrivateKey } from '@helpers/encrypt';
import { createDefaultFolders, getABIFilePath } from '@helpers/folder';
import { log } from '@helpers/logger';
import getWallet from 'deploy/getWallet';
import { ChainId, Currency, NetworkConfigFile, NetworkExplorer, NetworkName, rpcUrls } from '@constants/network';
import { CONTRACT_NAME, PROXY_CONTRACT_TYPE } from '@constants/contract';
import { TENANT } from '@constants/tenant';
import {
    Deployment,
    DeploymentContract,
    DeploymentExtensionContract,
    DeploymentProxyContract,
} from 'types/deployment-type';
import { exec } from 'node:child_process';
import { CONTRACTS } from '@constants/proxy-deployments';
import { ACHIEVO_TMP_DIR } from '@constants/deployments';
import { isAlreadyDeployed, writeChecksumToFile } from '@helpers/checksum';
import deployUpgradeable from '../deploy/deployUpgradeable';
import deploy from '../deploy/deploy';
import { encoder } from '@helpers/encoder';
import { ExtensionFunction } from '@helpers/extensions';
import { populateParam, prepFunctionOne } from './deploy';
import { Contract } from 'ethers';
import { proxy } from 'typechain-types/@openzeppelin/contracts';

const { PRIVATE_KEY = '' } = process.env;

if (!PRIVATE_KEY) {
    throw new Error('Private key not detected! Add it to the .env file!');
}

const wallet = getWallet(PRIVATE_KEY);
const MINTER_ROLE = '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6';

export async function populateProxyParam(
    hre: HardhatRuntimeEnvironment,
    param: string | number | boolean,
    tenant: string,
    contract: DeploymentProxyContract,
    implementationContract?: Contract
): Promise<string | number | boolean> {
    const chain = hre.network.name;
    let value = param;

    if (param === 'ENCODE_INITIALIZE_FUNCTION_ACHIEVO_PROXY' && !implementationContract && !contract) {
        throw new Error('Implementation contract is required for ENCODE_INITIALIZE_FUNCTION_ACHIEVO_PROXY');
    }

    if (param === 'DEPLOYER_WALLET') {
        return wallet.address;
    }

    if (param === 'MINTER_ROLE') {
        return MINTER_ROLE;
    }

    if (param === 'ZERO_ADDRESS') {
        return hre.ethers.ZeroAddress;
    }

    if (param === 'ENCODE_INITIALIZE_FUNCTION_ACHIEVO_PROXY') {
        // Encode the initialization function call
        const encodedDataMapped = contract?.encodeInitializeFunctionArgs?.map((arg) => {
            if (arg === 'DEV_WALLET') {
                return wallet.address;
            }

            return arg;
        });
        const initData = implementationContract?.interface?.encodeFunctionData(
            contract.proxyInitializeFunctionName,
            encodedDataMapped
        );

        if (!initData) {
            throw new Error('initData encoded not created');
        }

        return initData;
    }

    if (typeof param === 'string' && param.startsWith('CONTRACT_')) {
        const name = param.substring('CONTRACT_'.length);
        const contract = CONTRACTS.find((c) => c.name === name && c.chain === chain);

        if (!contract) {
            throw new Error(`Contract ${name} not found`);
        }

        const goingToDeploy = !isAlreadyDeployed(contract, tenant as string);

        console.log('goingToDeploy->', name, goingToDeploy);

        const filePathDeploymentLatest = path.resolve(
            `${ACHIEVO_TMP_DIR}/${contract?.chain}/upgradeables/deployments-${contract?.name}-${tenant}-latest.json`
        );

        let deploymentPayload;
        if (!goingToDeploy) {
            log(`SKIPPED: ${contract?.contractFileName} Already deployed, using existing deploymentPayload`);

            const deploymentPayloadContent = fs.readFileSync(filePathDeploymentLatest, 'utf8');
            deploymentPayload = JSON.parse(deploymentPayloadContent);
        } else {
            const abiPath = getABIFilePath(hre.network.zksync, contract?.contractFileName);

            // @ts-ignore-next-line
            // eslint-disable-next-line
            const constructorArgs = await populateProxyConstructorArgs(
                hre,
                // @ts-ignore-next-line
                contract.args,
                tenant as string
            );

            deploymentPayload = await deploy(hre, contract, constructorArgs, abiPath as string, tenant);

            // @ts-ignore-next-line
            writeChecksumToFile(contract?.contractFileName, contract.name as unknown as string, tenant);

            // Convert deployments to JSON
            const deploymentsJson = JSON.stringify(deploymentPayload, null, 2);
            // Write to the file
            fs.writeFileSync(filePathDeploymentLatest, deploymentsJson);
            log(`Deployments saved to ${filePathDeploymentLatest}`);
        }

        value = deploymentPayload.contractAddress;
    }

    return value;
}

export async function populateProxyConstructorArgs(
    hre: HardhatRuntimeEnvironment,
    constructorArgs: Record<string, string | number | boolean>,
    tenant: string,
    contract: DeploymentProxyContract,
    implementationContract?: Contract
) {
    for (const key in constructorArgs) {
        constructorArgs[key] = await populateProxyParam(
            hre,
            constructorArgs[key],
            tenant,
            contract,
            implementationContract
        );
    }
    return constructorArgs;
}

export const deployOneWithExtensions = async (
    hre: HardhatRuntimeEnvironment,
    contract: DeploymentProxyContract,
    tenant: string,
    deployedExtensions: any[]
): Promise<Deployment> => {
    // @ts-ignore-next-line
    const constructorArgs = await populateProxyConstructorArgs(hre, contract.implementationArgs, tenant, contract);

    const isZkSync = hre.network.zksync;

    if (isZkSync) {
        // TODO: Implement zkSync, not supported yet
        throw new Error(`SKIPPED: ${contract?.name} ZKSync not supported yet`);
    }

    const abiPath = getABIFilePath(isZkSync, contract.contractFileName);

    if (!abiPath) {
        throw new Error(`ABI not found for ${contract.contractFileName}`);
    }

    if (contract.proxyContractType === PROXY_CONTRACT_TYPE.EIP1967) {
        // @ts-ignore
        constructorArgs.extensions = deployedExtensions;
    }

    // TODO: Implement other proxy contract types here

    return await deploy(hre, contract, constructorArgs, abiPath, tenant);
};

export const deployOne = async (
    hre: HardhatRuntimeEnvironment,
    contract: DeploymentProxyContract | DeploymentExtensionContract,
    tenant: string,
    implementationContract?: Contract
): Promise<Deployment> => {
    // @ts-ignore
    if (!contract.extensionArgs && !contract.proxyContractArgs && !contract.implementationArgs) {
        throw new Error(`Missing extensionArgs, proxyContractArgs or implementationArgs for ${contract.name}`);
    }

    const constructorArgs = await populateProxyConstructorArgs(
        hre,
        // @ts-ignore
        contract.extensionArgs || contract.proxyContractArgs || contract.implementationArgs,
        tenant,
        // @ts-ignore
        contract,
        // @ts-ignore
        implementationContract
    );

    const isZkSync = hre.network.zksync;

    if (isZkSync) {
        // TODO: Implement zkSync, not supported yet
        throw new Error(`SKIPPED: ${contract?.name} ZKSync not supported yet`);
    }

    const abiPath = getABIFilePath(isZkSync, contract.contractFileName);

    if (!abiPath) {
        throw new Error(`ABI not found for ${contract.contractFileName}`);
    }

    return await deploy(hre, contract, constructorArgs, abiPath, tenant);
};

const getDependencies = (contractName: string, chain: string) => {
    const dependencies = new Set([contractName]);

    function collect(contractName: string) {
        const contract = CONTRACTS.find((c) => c.name === contractName && c.chain === chain);
        if (contract) {
            contract.dependencies?.forEach((dep) => {
                if (!dependencies.has(dep)) {
                    dependencies.add(dep);
                    collect(dep);
                }
            });
        }
    }

    collect(contractName);

    return [...dependencies];
};

task('deploy-proxy', 'Deploys Smart contracts with proxy')
    .addParam('name', 'Contract Name you want to deploy', undefined, types.string)
    .setAction(
        async (_args: { name: CONTRACT_NAME; tenant: TENANT; force: boolean }, hre: HardhatRuntimeEnvironment) => {
            const { name } = _args;

            const network = hre.network.name;
            log('└─ args :\n');
            log(`   ├─ Contract name : ${name}\n`);
            log(`   └─ network : ${network}\n`);

            createDefaultFolders(network);

            const contract = CONTRACTS.find((d) => d.name === name && d.chain === network);

            if (!contract) {
                throw new Error(`Contract ${name} not found on ${network}`);
            }

            const contractsToDeploy = getDependencies(contract.name, network);
            for (const tenant of contract.tenants) {
                log('=====================================================');
                log('=====================================================');
                log(`[STARTING] Deploy ${name} contract on ${network} for [[${tenant}]]`);
                log(`Contracts to deploy: ${contractsToDeploy.length}`);
                for (const contract of contractsToDeploy) {
                    log(`contract: ${contract}`);
                }
                log('=====================================================');
                log('=====================================================');
                log('\n');
                log('\n');
                log('\n');
                log('\n');

                const deployments: Deployment[] = [];

                for (const contractName of contractsToDeploy) {
                    const contract = CONTRACTS.find(
                        (d) => d.name === contractName && d.chain === network
                    ) as unknown as DeploymentProxyContract;
                    log(
                        `[PREPPING] Get ready to deploy ${name}:<${contract.contractFileName}> contract on ${network} for ${tenant}`
                    );

                    log('\n\n');
                    log('=====================================================');
                    log(`[EXTENSIONS DEPLOYMENT]`);
                    log('=====================================================');

                    const deployedExtensions = [];
                    for await (const extension of contract.extensions) {
                        const deployedExtensionContract = await deployOne(hre, extension, tenant);
                        const metadata = {
                            name: extension.metadata.name,
                            metadataURI: extension.metadata.metadataURI,
                            implementation: deployedExtensionContract.contractAddress,
                        };
                        const abi = deployedExtensionContract.contractAbi;
                        const name = deployedExtensionContract.name;

                        const contractInstance = await hre.ethers.getContractAt(
                            extension.contractFileName,
                            deployedExtensionContract.contractAddress
                        );
                        
                        let functions: ExtensionFunction[] = [];

                        for (const func of extension.functionsToInclude) {
                            const selector = contractInstance.getFunction(func).getFragment().selector;
                            functions.push({
                                functionSelector: selector,
                                functionSignature: func,
                            });
                        }

                        const extensionDeployed = {
                            metadata,
                            functions,
                            abi,
                            name,
                        };

                        deployedExtensions.push(extensionDeployed);
                    }

                    log('\n\n');
                    log('=====================================================');
                    log(`[IMPLEMENTATION DEPLOYMENT]`);
                    log('=====================================================');

                    const deployedImplementation = await deployOneWithExtensions(
                        hre,
                        contract,
                        tenant,
                        deployedExtensions
                    );

                    log('\n\n');
                    log('=====================================================');
                    log(`[PROXY DEPLOYMENT]`);
                    log('=====================================================');

                    switch (contract.proxyContractType) {
                        default:
                        case PROXY_CONTRACT_TYPE.EIP1967:
                            // switch to the proxy contract values
                            const proxyContract = contract;
                            proxyContract.contractFileName = contract.proxyContractFileName;
                            proxyContract.name = contract.proxyContractName;
                            proxyContract.proxyContractArgs.implementation = deployedImplementation.contractAddress;
                            proxyContract.verify = contract.proxyContractVerify;

                            // // Prepare the arguments for the initialize function
                            const defaultAdmin = wallet.address; // Admin address here
                            const contractURI = 'ipfs://NewUriToMetaData';
                            const trustedForwarders: never[] = []; // Forwarder addresses
                            const platformFeeRecipient = wallet.address;
                            const platformFeeBps = 0; // Example fee basis points (1%)

                            const implementationContract = await hre.ethers.getContractAt(
                                deployedImplementation.name,
                                deployedImplementation.contractAddress
                            );

                            const proxyDeployment = await deployOne(hre, proxyContract, tenant, implementationContract);
                            
                            proxyDeployment.name = `${proxyDeployment.name}${deployedImplementation.name}`;
                            proxyDeployment.upgradable = true;
                            proxyDeployment.proxyType = PROXY_CONTRACT_TYPE.EIP1967;
                            proxyDeployment.proxy = {
                                abi: proxyDeployment.contractAbi,
                                address: proxyDeployment.contractAddress,
                                owner: wallet.address,
                            }
                            proxyDeployment.implementation = {
                                abi: deployedImplementation.contractAbi,
                                address: deployedImplementation.contractAddress,
                            };
                            proxyDeployment.extensions = deployedExtensions.map((extension) => {
                                return {
                                    name: extension.name,
                                    abi: extension.abi,
                                    address: extension.metadata.implementation,
                                    functions: extension.functions,
                                };
                            });
                            deployments.push(proxyDeployment);
                            break;
                    }
                }

                log('=====================================================');
                log(
                    `[DONE] ${name}, ${contract?.proxyContractName}, ${contract?.extensions.map(
                        (extension) => `${extension.name},`
                    )} contract deployment on ${network} for [[${tenant}]] is DONE!`
                );
                log('=====================================================');
                log('\n');

                // submit to db
                try {
                    log('*******************************************');
                    log('[SUBMITTING] Deployments to db');
                    log('*******************************************');
                    await submitContractDeploymentsToDB(deployments, tenant);
                    log('*******************************************');
                    log('*** Deployments submitted to db ***');
                    log('*******************************************');
                } catch (error: any) {
                    log('*******************************************');
                    log('***', error.message, '***');
                    log('*******************************************');
                }

                const calls = [];
                for (const deployment of deployments) {
                    // write deployment payload per tenant
                    // Define the path to the file
                    const filePath = path.resolve(
                        `${ACHIEVO_TMP_DIR}/deployments/${contract.chain}/upgradeables/deployments-${
                            deployment.type
                        }-${tenant}-${Date.now()}.json`
                    );
                    // Convert deployments to JSON
                    const deploymentsJson = JSON.stringify(deployment, null, 2);
                    // Write to the file
                    fs.writeFileSync(filePath, deploymentsJson);

                    log(`Deployments saved to ${filePath}`);

                    const deployedContract = CONTRACTS.find((d) => d.type === deployment.type && d.chain === network);

                    if (!deployedContract?.functionCalls || deployedContract?.functionCalls?.length === 0) {
                        continue;
                    }

                    for (const call of deployedContract?.functionCalls) {
                        console.log(
                            `[CALLING]: ${deployedContract.contractFileName} on ${deployedContract.chain} for ${tenant} `
                        );
                        const _call = await prepFunctionOne(hre, call, tenant, deployment.contractAddress);
                        calls.push(_call);
                    }
                }

                // execute function calls
                if (calls.length > 0) {
                    await executeFunctionCallBatch(calls, tenant);
                }
            }
        }
    );
