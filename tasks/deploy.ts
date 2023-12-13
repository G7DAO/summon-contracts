import fs from 'fs';
import path from 'path';

import { task, types } from 'hardhat/config';

import { CONTRACTS, ACHIEVO_TMP_DIR, ABI_PATH_ZK, ABI_PATH } from '@constants/deployments';
import * as ConstructorArgs from '@constants/constructor-args';
import { log } from '@helpers/logger';
import { isAlreadyDeployed, writeChecksumToFile } from '@helpers/checksum';
import { submitContractDeploymentsToDB, executeFunctionCallBatch } from '@helpers/contract';

import deploy from '../deploy/deploy';
import deployUpgradeable from '../deploy/deployUpgradeable';
import getWallet from 'deploy/getWallet';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Deployment, DeploymentContract, FunctionCall } from 'types/deployment-type';
import { createDefaultFolders } from '@helpers/folder';

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const wallet = getWallet(PRIVATE_KEY);

export async function populateParam(
    hre: HardhatRuntimeEnvironment,
    param: string | number | boolean,
    chain: string,
    tenant?: string
): Promise<string | number | boolean> {
    let value = param;

    if (param === 'DEPLOYER_WALLET') {
        return wallet.address;
    }

    if (param === 'MINTER_ROLE') {
        return '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6';
    }

    if (typeof param === 'string' && param.startsWith('CONTRACT_')) {
        const contractName = param.substring('CONTRACT_'.length);
        // Do something with contractName
        const contract = CONTRACTS.find((c) => c.contractName === contractName && c.chain === chain);
        const _isAlreadyDeployed = isAlreadyDeployed(contract, tenant as string);

        const filePathDeploymentLatest = path.resolve(
            `${ACHIEVO_TMP_DIR}/${contract?.chain}/${contract?.upgradable ? 'upgradeables/' : ''}deployments-${
                contract?.type
            }-${tenant}-latest.json`
        );

        let deploymentPayload;
        if (_isAlreadyDeployed) {
            log(`SKIPPED: ${contract?.contractName} Already deployed, using existing deploymentPayload`);

            const deploymentPayloadContent = fs.readFileSync(filePathDeploymentLatest, 'utf8');
            deploymentPayload = JSON.parse(deploymentPayloadContent);
        } else {
            const abiPath = `${hre.network.zksync ? ABI_PATH_ZK : ABI_PATH}${
                contract?.upgradable ? 'upgradeables/' : ''
            }${contract?.contractName}.sol/${contract?.contractName}.json`;

            const constructorArgs = await populateConstructorArgs(
                hre,
                // @ts-ignore-next-line
                ConstructorArgs[`${contract.contractName}Args`][`${contract?.networkType}`],
                chain,
                tenant as string
            );

            if (contract?.upgradable) {
                deploymentPayload = await deployUpgradeable(hre, contract, constructorArgs, abiPath, tenant);
            } else {
                deploymentPayload = await deploy(hre, contract, constructorArgs, abiPath, tenant);
            }

            // @ts-ignore-next-line
            writeChecksumToFile(contract?.contractName, tenant);

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

export async function populateConstructorArgs(
    hre: HardhatRuntimeEnvironment,
    constructorArgs: Record<string, string | number | boolean>,
    chain: string,
    tenant: string
) {
    for (const key in constructorArgs) {
        constructorArgs[key] = await populateParam(hre, constructorArgs[key], chain, tenant);
    }
    return constructorArgs;
}

const deployOne = async (
    hre: HardhatRuntimeEnvironment,
    contract: DeploymentContract,
    chain: string,
    tenant: string
): Promise<Deployment> => {
    const constructorArgs = await populateConstructorArgs(
        hre,
        // @ts-ignore-next-line
        ConstructorArgs[`${contract.contractName}Args`][`${contract?.networkType}`],
        chain,
        tenant
    );

    const abiPath = `${hre.network.zksync ? ABI_PATH_ZK : ABI_PATH}${contract?.upgradable ? 'upgradeables/' : ''}${
        contract.contractName
    }.sol/${contract.contractName}.json`;

    const _isAlreadyDeployed = isAlreadyDeployed(contract, tenant);

    const filePathDeploymentLatest = path.resolve(
        `${ACHIEVO_TMP_DIR}/${contract.chain}/${contract.upgradable ? 'upgradeables/' : ''}deployments-${
            contract.type
        }-${tenant}-latest.json`
    );

    let deploymentPayload: Deployment;
    // TODO: this is wrong, this must save the artifact and ask if the bytecode is the same, instead of just the file, tech-debt @max
    if (_isAlreadyDeployed) {
        log(`SKIPPED: ${contract?.contractName} Already deployed, using existing deploymentPayload`);
        const deploymentPayloadContent = fs.readFileSync(filePathDeploymentLatest, 'utf8');
        deploymentPayload = JSON.parse(deploymentPayloadContent);
    } else {
        if (contract.upgradable) {
            deploymentPayload = await deployUpgradeable(hre, contract, constructorArgs, abiPath, tenant);
        } else {
            deploymentPayload = await deploy(hre, contract, constructorArgs, abiPath, tenant);
        }

        writeChecksumToFile(contract.contractName as unknown as string, tenant);

        // Convert deployments to JSON
        const deploymentsJson = JSON.stringify(deploymentPayload, null, 2);
        // Write to the file
        fs.writeFileSync(filePathDeploymentLatest, deploymentsJson);
        log(`Deployments saved to ${filePathDeploymentLatest}`);
    }

    return deploymentPayload;
};

const prepFunctionOne = async (
    hre: HardhatRuntimeEnvironment,
    call: FunctionCall,
    chain: string,
    tenant: string,
    contractAddress: string
) => {
    const populatedArgs = [];
    for (const arg of call.args) {
        populatedArgs.push(await populateParam(hre, arg, chain, tenant));
    }

    return {
        ...call,
        args: populatedArgs,
        contractAddress,
    };

    // call the function
};

const getDependencies = (contractName: string, chain: string) => {
    const dependencies = new Set([contractName]);

    function collect(contractName: string) {
        const contract = CONTRACTS.find((c) => c.contractName === contractName && c.chain === chain);
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

task('deploy', 'Deploys Smart contracts')
    .addParam('contractname', 'Contract Name you want to deploy', undefined, types.string)
    .setAction(async (_args: { contractname: string }, hre: HardhatRuntimeEnvironment) => {
        const { contractname: contractName } = _args;
        const network = hre.network.name;
        log('args :\n');
        log(`contractName : ${contractName}\n`);
        log(`network : ${network}\n`);
        createDefaultFolders(network); // create default folders

        if (!contractName) {
            throw new Error('Contract name is required');
        }

        const contract = CONTRACTS.find((d) => d.contractName === contractName && d.chain === network);

        if (!contract) {
            throw new Error(`Contract ${contractName} not found on ${network}`);
        }

        const contractsToDeploy = getDependencies(contract.contractName, network);

        for (const tenant of contract.tenants) {
            log('=====================================================');
            log('=====================================================');
            log(`[STARTING] Deploy ${contractName} contract on ${network} for [[${tenant}]]`);
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
                    (d) => d.contractName === contractName && d.chain === network
                ) as unknown as DeploymentContract;
                log(`[PREPPING] Get ready to deploy ${contractName} contract on ${network} for ${tenant}`);

                const deployment = await deployOne(hre, contract, network, tenant);
                deployments.push(deployment);
            }

            log('=====================================================');
            log(`[DONE] ${contractName} contract deployment on ${network} for [[${tenant}]] is DONE!`);
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
                    `${ACHIEVO_TMP_DIR}/deployments/${contract.chain}/${
                        contract.upgradable ? 'upgradeables/' : ''
                    }deployments-${deployment.type}-${tenant}-${Date.now()}.json`
                );
                // Convert deployments to JSON
                const deploymentsJson = JSON.stringify(deployment, null, 2);
                // Write to the file
                fs.writeFileSync(filePath, deploymentsJson);

                log(`Deployments saved to ${filePath}`);

                const deployedContract = CONTRACTS.find(
                    (d) => d.type === deployment.type && d.chain === network && d.upgradable === deployment.upgradable
                );

                if (!deployedContract?.functionCalls || deployedContract?.functionCalls?.length === 0) {
                    continue;
                }

                for (const call of deployedContract?.functionCalls) {
                    console.log(
                        `[CALLING]: ${deployedContract.contractName} on ${deployedContract.chain} for ${tenant} `
                    );
                    const _call = await prepFunctionOne(
                        hre,
                        call as FunctionCall,
                        network as string,
                        tenant,
                        deployment.contractAddress
                    );
                    calls.push(_call);
                }
            }

            // execute function calls
            await executeFunctionCallBatch(calls, tenant);
        }
    });
