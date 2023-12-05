import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

import { task, types } from 'hardhat/config';

import { CONTRACTS } from '@constants/deployments';
import * as ConstructorArgs from '@constants/constructor-args';
import { log } from '@helpers/logger';
import { isAlreadyDeployed, writeChecksumToFile } from '@helpers/checksum';
import { submitContractToDB } from '@helpers/submit-contract-to-db';

import deploy from '../deploy/deploy';
import deployUpgradeable from '../deploy/deployUpgradeable';

const ABI_PATH_ZK = 'artifacts-zk/contracts/';
const ABI_PATH = 'artifacts/contracts/';
const GAME7_TMP_DIR = '.game7';

const deployEach = async (hre, contract, chain, tenant) => {
    let deployments = [];

    // then deploy the contract
    const constructorArgs = ConstructorArgs[`${contract.contractName}Args`][`${contract?.networkType}`];
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
        console.log('Existing deploymentPayload:', deploymentPayload);

        deployments.push(deploymentPayload);
    } else {
        if (contract.upgradable) {
            deploymentPayload = await deployUpgradeable(hre, contract, constructorArgs, abiPath, tenant);
        } else {
            deploymentPayload = await deploy(hre, contract, constructorArgs, abiPath, tenant);
        }

        writeChecksumToFile(contract.contractName, tenant);

        deployments.push(deploymentPayload);

        // Convert deployments to JSON
        const deploymentsJson = JSON.stringify(deploymentPayload, null, 2);
        // Write to the file
        fs.writeFileSync(filePathDeploymentLatest, deploymentsJson);
        log(`Deployments saved to ${filePathDeploymentLatest}`);
    }

    if (contract.dependencies.length > 0) {
        // deploy dependencies first
        for (const dependency of contract.dependencies) {
            const _contract = CONTRACTS.find((d) => d.contractName === dependency && d.chain === chain);

            if (!isAlreadyDeployed(_contract, tenant)) {
                const _deployments = await deployEach(hre, _contract, chain, tenant);
                deployments = [...deployments, ..._deployments];
            }
        }
    }

    return deployments;
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

        // loop through the contracts and deploy them per tenant
        for (const tenant of contract.tenants) {
            log('=====================================================');
            log(`[STARTING] Deploy script for the ${contractName} on ${chain} for ${tenant}`);
            log('=====================================================');
            log('\n');
            log(`[DEPLOYING] Dependencies for ${contractName} on ${chain} for ${tenant}`);

            const deployments = await deployEach(hre, contract, chain, tenant);

            log('=====================================================');
            log(`[DONE] Deploy script for the ${contractName} on ${chain} for ${tenant}`);
            log('=====================================================');

            // write deployment payload per tenant
            for (const deployment of deployments) {
                // await submitContractToDB(deployments);

                // Define the path to the file
                const filePath = path.resolve(
                    `.game7/deployments/${contract.upgradable ? 'upgradeables/' : ''}deployments-${
                        deployment.type
                    }-${tenant}-${Date.now()}.json`
                );
                // Convert deployments to JSON
                const deploymentsJson = JSON.stringify(deployment, null, 2);
                // Write to the file
                fs.writeFileSync(filePath, deploymentsJson);
                log(`Deployments saved to ${filePath}`);
            }

            // TODO * call functions at the end...
        }
    });
