import fs from 'fs';
import path from 'path';

import { task, types } from 'hardhat/config';

import { CONTRACTS } from '@constants/deployments';
import * as ConstructorArgs from '@constants/constructor-args';
import { log } from '@helpers/logger';
import { isAlreadyDeployed, writeChecksumToFile } from '@helpers/checksum';
import { submitContractDeploymentsToDB, executeFunctionCallBatch } from '@helpers/contract';

import deploy from '../deploy/deploy';
import deployUpgradeable from '../deploy/deployUpgradeable';
import getWallet from 'deploy/getWallet';

const ABI_PATH_ZK = 'artifacts-zk/contracts/';
const ABI_PATH = 'artifacts/contracts/';
const TMP_DIR = '.achievo';

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const wallet = getWallet(PRIVATE_KEY);

export async function populateParam(
    param: string | number | boolean,
    constructorArgs: Record<string, string>,
    tenant?: string
): Promise<string> {
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
        const contract = CONTRACTS.find((c) => c.contractName === contractName);
        const _isAlreadyDeployed = isAlreadyDeployed(contract, tenant);

        const filePathDeploymentLatest = path.resolve(
            `.achievo/${contract.upgradable ? 'upgradeables/' : ''}deployments-${contract.type}-${tenant}-latest.json`
        );

        let deploymentPayload;
        if (_isAlreadyDeployed) {
            log('SKIPPED: Already deployed, using existing deploymentPayload');

            const deploymentPayloadContent = fs.readFileSync(filePathDeploymentLatest, 'utf8');
            deploymentPayload = JSON.parse(deploymentPayloadContent);
        } else {
            if (contract.upgradable) {
                deploymentPayload = await deployUpgradeable(hre, contract, constructorArgs, abiPath, tenant);
            } else {
                deploymentPayload = await deploy(hre, contract, constructorArgs, abiPath, tenant);
            }

            writeChecksumToFile(contract.contractName, tenant);

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

export async function populateConstructorArgs(constructorArgs: Record<string, string>, tenant?: string) {
    for (const key in constructorArgs) {
        constructorArgs[key] = await populateParam(key, constructorArgs, tenant);
    }

    return constructorArgs;
}

const deployOne = async (hre: HardhatRuntimeEnvironment, contract, tenant) => {
    // then deploy the contract
    const constructorArgs = await populateConstructorArgs(
        ConstructorArgs[`${contract.contractName}Args`][`${contract?.networkType}`],
        tenant
    );

    const abiPath = `${hre.network.zksync ? ABI_PATH_ZK : ABI_PATH}${contract?.upgradable ? 'upgradeables/' : ''}${
        contract.contractName
    }.sol/${contract.contractName}.json`;

    const _isAlreadyDeployed = isAlreadyDeployed(contract, tenant);

    const filePathDeploymentLatest = path.resolve(
        `.achievo/${contract.upgradable ? 'upgradeables/' : ''}deployments-${contract.type}-${tenant}-latest.json`
    );

    let deploymentPayload;
    if (_isAlreadyDeployed) {
        log('SKIPPED: Already deployed, using existing deploymentPayload');

        const deploymentPayloadContent = fs.readFileSync(filePathDeploymentLatest, 'utf8');
        deploymentPayload = JSON.parse(deploymentPayloadContent);
    } else {
        if (contract.upgradable) {
            deploymentPayload = await deployUpgradeable(hre, contract, constructorArgs, abiPath, tenant);
        } else {
            deploymentPayload = await deploy(hre, contract, constructorArgs, abiPath, tenant);
        }

        writeChecksumToFile(contract.contractName, tenant);

        // Convert deployments to JSON
        const deploymentsJson = JSON.stringify(deploymentPayload, null, 2);
        // Write to the file
        fs.writeFileSync(filePathDeploymentLatest, deploymentsJson);
        log(`Deployments saved to ${filePathDeploymentLatest}`);
    }

    return deploymentPayload;
};

const prepFunctionOne = async (
    call,
    constructorArgs: Record<string, string>,
    tenant?: string,
    contractAddress: string
) => {
    //
    const populatedArgs = [];
    for (const arg of call.args) {
        populatedArgs.push(await populateParam(arg, constructorArgs, tenant));
    }

    return {
        ...call,
        args: populatedArgs,
        contractAddress,
    };

    // call the function
};

const createDefaultFolders = () => {
    if (!fs.existsSync(`${TMP_DIR}`)) {
        fs.mkdirSync(`${TMP_DIR}`);
    }
    if (!fs.existsSync(`${TMP_DIR}/checksums`)) {
        fs.mkdirSync(`${TMP_DIR}/checksums`);
    }
    if (!fs.existsSync(`${TMP_DIR}/upgradeables`)) {
        fs.mkdirSync(`${TMP_DIR}/upgradeables`);
    }

    if (!fs.existsSync(`${TMP_DIR}/deployments`)) {
        fs.mkdirSync(`${TMP_DIR}/deployments`);
    }

    if (!fs.existsSync(`${TMP_DIR}/deployments/upgradeables`)) {
        fs.mkdirSync(`${TMP_DIR}/deployments/upgradeables`);
    }
};

const getDependencies = (contractName: string) => {
    const dependencies = new Set([contractName]);

    function collect(contractName) {
        const contract = CONTRACTS.find((c) => c.contractName === contractName);
        contract.dependencies?.forEach((dep) => {
            if (!dependencies.has(dep)) {
                dependencies.add(dep);
                collect(dep);
            }
        });
    }

    collect(contractName);

    return [...dependencies];
};

task('deploy', 'Deploys Smart contracts')
    .addParam('contractname', 'Contract Name you want to deploy', undefined, types.string)
    .addParam('chain', 'Chain you want to deploy to, e.g., zkSyncTest, mainnet, etc', undefined, types.string)
    .setAction(async (_args, hre) => {
        createDefaultFolders();

        const { contractname: contractName, chain } = _args;

        if (!contractName) {
            throw new Error('Contract name is required');
        }

        const contract = CONTRACTS.find((d) => d.contractName === contractName && d.chain === chain);

        if (!contract) {
            throw new Error(`Contract ${contractName} not found on ${chain}`);
        }

        const contractsToDeploy = getDependencies(contract.contractName);

        for (const tenant of contract.tenants) {
            log('=====================================================');
            log('=====================================================');
            log(`[STARTING] Deploy ${contractName} contract on ${chain} for [[${tenant}]]`);
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

            const deployments = [];

            for (const contractName of contractsToDeploy) {
                const contract = CONTRACTS.find((d) => d.contractName === contractName && d.chain === chain);
                log(`[PREPPING] Get ready to deploy ${contractName} contract on ${chain} for ${tenant}`);

                const deployment = await deployOne(hre, contract, tenant);
                deployments.push(deployment);
            }

            log('=====================================================');
            log(`[DONE] ${contractName} contract deployment on ${chain} for [[${tenant}]] is DONE!`);
            log('=====================================================');
            log('\n');

            // submit to db
            try {
                await submitContractDeploymentsToDB(deployments, tenant);
            } catch (error) {
                console.error(error.message);
            }

            const calls = [];
            for (const deployment of deployments) {
                // write deployment payload per tenant
                // Define the path to the file
                const filePath = path.resolve(
                    `.achievo/deployments/${contract.upgradable ? 'upgradeables/' : ''}deployments-${
                        deployment.type
                    }-${tenant}-${Date.now()}.json`
                );
                // Convert deployments to JSON
                const deploymentsJson = JSON.stringify(deployment, null, 2);
                // Write to the file
                // fs.writeFileSync(filePath, deploymentsJson);

                log(`Deployments saved to ${filePath}`);

                const deployedContract = CONTRACTS.find((d) => d.type === deployment.type && d.chain === chain);
                if (!deployedContract?.functionCalls || deployedContract?.functionCalls?.length === 0) {
                    continue;
                }

                for (const call of deployedContract?.functionCalls) {
                    const _call = await prepFunctionOne(
                        call,
                        ConstructorArgs[`${deployedContract.contractName}Args`][`${deployedContract?.networkType}`],
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
