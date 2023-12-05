import fs from 'fs';
import path from 'path';

import { task, types } from 'hardhat/config';

import { CONTRACTS } from '@constants/deployments';
import * as ConstructorArgs from '@constants/constructor-args';
import { log } from '@helpers/logger';
import { isAlreadyDeployed, writeChecksumToFile } from '@helpers/checksum';
import { submitContractToDB } from '@helpers/submit-contract-to-db';

import deploy from '../deploy/deploy';
import deployUpgradeable from '../deploy/deployUpgradeable';
import getWallet from 'deploy/getWallet';

const ABI_PATH_ZK = 'artifacts-zk/contracts/';
const ABI_PATH = 'artifacts/contracts/';
const GAME7_TMP_DIR = '.game7';

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const wallet = getWallet(PRIVATE_KEY);

export async function populateConstructorArgs(constructorArgs: Record<string, string>, tenant?: string) {
    for (const key in constructorArgs) {
        if (constructorArgs[key] === 'DEPLOYER_WALLET') {
            constructorArgs[key] = wallet.address;
        }

        if (typeof constructorArgs[key] === 'string' && constructorArgs[key].startsWith('CONTRACT_')) {
            const contractName = constructorArgs[key].substring('CONTRACT_'.length);
            // Do something with contractName
            const contract = CONTRACTS.find((c) => c.contractName === contractName);
            const _isAlreadyDeployed = isAlreadyDeployed(contract, tenant);

            const filePathDeploymentLatest = path.resolve(
                `.game7/${contract.upgradable ? 'upgradeables/' : ''}deployments-${contract.type}-${tenant}-latest.json`
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

            // replace the constructorArgs[key] with the address
            constructorArgs[key] = deploymentPayload.contractAddress;
        }
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
        `.game7/${contract.upgradable ? 'upgradeables/' : ''}deployments-${contract.type}-${tenant}-latest.json`
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

const createDefaultFolders = () => {
    if (!fs.existsSync(`${GAME7_TMP_DIR}`)) {
        fs.mkdirSync(`${GAME7_TMP_DIR}`);
    }
    if (!fs.existsSync(`${GAME7_TMP_DIR}/checksums`)) {
        fs.mkdirSync(`${GAME7_TMP_DIR}/checksums`);
    }
    if (!fs.existsSync(`${GAME7_TMP_DIR}/upgradeables`)) {
        fs.mkdirSync(`${GAME7_TMP_DIR}/upgradeables`);
    }

    if (!fs.existsSync(`${GAME7_TMP_DIR}/deployments`)) {
        fs.mkdirSync(`${GAME7_TMP_DIR}/deployments`);
    }

    if (!fs.existsSync(`${GAME7_TMP_DIR}/deployments/upgradeables`)) {
        fs.mkdirSync(`${GAME7_TMP_DIR}/deployments/upgradeables`);
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

            // write deployment payload per tenant
            for (const deployment of deployments) {
                // await submitContractToDB(deployments);
                // // Define the path to the file
                // const filePath = path.resolve(
                //     `.game7/deployments/${contract.upgradable ? 'upgradeables/' : ''}deployments-${
                //         deployment.type
                //     }-${tenant}-${Date.now()}.json`
                // );
                // // Convert deployments to JSON
                // const deploymentsJson = JSON.stringify(deployment, null, 2);
                // // Write to the file
                // fs.writeFileSync(filePath, deploymentsJson);
                // log(`Deployments saved to ${filePath}`);
            }

            // TODO * call functions at the end...
        }
    });
