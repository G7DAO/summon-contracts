import fs from 'fs';
import path from 'path';

import { CONTRACTS, ACHIEVO_TMP_DIR } from '@constants/deployments';
import { isAlreadyDeployed, writeChecksumToFile } from '@helpers/checksum';
import { submitContractDeploymentsToDB, executeFunctionCallBatch } from '@helpers/contract';
import { createDefaultFolders, getABIFilePath } from '@helpers/folder';
import { log } from '@helpers/logger';
import getWallet from 'deploy/getWallet';
import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Deployment, DeploymentContract, FunctionCall } from 'types/deployment-type';

import deploy from '../deploy/deploy';
import deployUpgradeable from '../deploy/deployUpgradeable';

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const wallet = getWallet(PRIVATE_KEY);

const MINTER_ROLE = '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6';

export async function populateParam(
    hre: HardhatRuntimeEnvironment,
    param: string | number | boolean,
    tenant?: string
): Promise<string | number | boolean> {
    const chain = hre.network.name;
    let value = param;

    if (param === 'DEPLOYER_WALLET') {
        return wallet.address;
    }

    if (param === 'MINTER_ROLE') {
        return MINTER_ROLE;
    }

    if (param === 'ZERO_ADDRESS') {
        return hre.ethers.ZeroAddress;
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
            `${ACHIEVO_TMP_DIR}/${contract?.chain}/${contract?.upgradable ? 'upgradeables/' : ''}deployments-${
                contract?.name
            }-${tenant}-latest.json`
        );

        let deploymentPayload;
        if (!goingToDeploy) {
            log(`SKIPPED: ${contract?.contractFileName} Already deployed, using existing deploymentPayload`);

            const deploymentPayloadContent = fs.readFileSync(filePathDeploymentLatest, 'utf8');
            deploymentPayload = JSON.parse(deploymentPayloadContent);
        } else {
            const abiPath = getABIFilePath(contract?.contractFileName);

            // @ts-ignore-next-line
            // eslint-disable-next-line
            const constructorArgs = await populateConstructorArgs(
                hre,
                // @ts-ignore-next-line
                contract.args,
                tenant as string
            );

            if (contract?.upgradable) {
                deploymentPayload = await deployUpgradeable(hre, contract, constructorArgs, abiPath as string, tenant);
            } else {
                deploymentPayload = await deploy(hre, contract, constructorArgs, abiPath as string, tenant);
            }

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

export async function populateConstructorArgs(
    hre: HardhatRuntimeEnvironment,
    constructorArgs: Record<string, string | number | boolean>,
    tenant: string
) {
    for (const key in constructorArgs) {
        constructorArgs[key] = await populateParam(hre, constructorArgs[key], tenant);
    }
    return constructorArgs;
}

const deployOne = async (
    hre: HardhatRuntimeEnvironment,
    contract: DeploymentContract,
    tenant: string,
    force: boolean
): Promise<Deployment> => {
    // @ts-ignore-next-line
    const constructorArgs = await populateConstructorArgs(hre, contract.args, tenant);

    const abiPath = getABIFilePath(contract.contractFileName);

    let goingToDeploy = true;
    if (!force) {
        goingToDeploy = !isAlreadyDeployed(contract, tenant);
    }

    const filePathDeploymentLatest = path.resolve(
        `${ACHIEVO_TMP_DIR}/${contract.chain}/${contract.upgradable ? 'upgradeables/' : ''}deployments-${
            contract.name
        }-${tenant}-latest.json`
    );

    let deploymentPayload: Deployment;
    // TODO: this is wrong, this must save the artifact and ask if the bytecode is the same, instead of just the file, tech-debt @max
    if (!goingToDeploy) {
        log(`SKIPPED: ${contract?.name} Already deployed, using existing deploymentPayload`);
        const deploymentPayloadContent = fs.readFileSync(filePathDeploymentLatest, 'utf8');
        deploymentPayload = JSON.parse(deploymentPayloadContent);
    } else {
        if (contract.upgradable) {
            deploymentPayload = await deployUpgradeable(hre, contract, constructorArgs, abiPath as string, tenant);
        } else {
            deploymentPayload = await deploy(hre, contract, constructorArgs, abiPath as string, tenant);
        }

        writeChecksumToFile(contract.contractFileName, contract.name as unknown as string, tenant);

        // Convert deployments to JSON
        const deploymentsJson = JSON.stringify(deploymentPayload, null, 2);
        // Write to the file
        fs.writeFileSync(filePathDeploymentLatest, deploymentsJson);
        log(`Deployments saved to ${filePathDeploymentLatest}`);
    }

    return deploymentPayload;
};

export const prepFunctionOne = async (
    hre: HardhatRuntimeEnvironment,
    call: FunctionCall,
    tenant: string,
    contractAddress: string
) => {
    const populatedArgs = [];
    for (const arg of call.args) {
        // @ts-ignore-next-line
        populatedArgs.push(await populateParam(hre, arg, tenant));
    }

    return {
        ...call,
        args: populatedArgs,
        contractAddress,
    };
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

task('deploy', 'Deploys Smart contracts')
    .addParam('name', 'Contract Name you want to deploy', undefined, types.string)
    .addFlag('force', 'Do you want to force deploy?')
    .setAction(async (_args: { name: string; force: boolean }, hre: HardhatRuntimeEnvironment) => {
        const { name, force } = _args;
        const network = hre.network.name;
        log('└─ args :\n');
        log(`   ├─ contractFileName : ${name}\n`);
        log(`   ├─ network : ${network}\n`);
        log(`   └─ force : ${force}\n`);
        createDefaultFolders(network); // create default folders

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
                ) as unknown as DeploymentContract;
                log(
                    `[PREPPING] Get ready to deploy ${name}:<${contract.contractFileName}> contract on ${network} for ${tenant}`
                );

                const deployment = await deployOne(hre, contract, tenant, force);
                deployments.push(deployment);
            }

            log('=====================================================');
            log(`[DONE] ${name} contract deployment on ${network} for [[${tenant}]] is DONE!`);
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
    });
