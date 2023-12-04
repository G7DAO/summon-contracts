import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

import { task, types } from 'hardhat/config';

import { CONTRACTS } from '@constants/deployments';
import * as ConstructorArgs from '@constants/constructor-args';
import { log } from '@helpers/logger';
import { isAlreadyDeployed } from '@helpers/checksum';
import { submitContractToDB } from '@helpers/submit-contract-to-db';

import deploy from '../deploy/deploy';

const ABI_PATH_ZK = 'artifacts-zk/contracts/';
const ABI_PATH = 'artifacts/contracts/';
const GAME7_TMP_DIR = '.game7';

task('deploy', 'Deploys Smart contracts')
    .addParam('contractname', 'Contract Name you want to deploy', undefined, types.string)
    .addParam('chain', 'Chain you want to deploy to, e.g., zkSyncTest, mainnet, etc', undefined, types.string)
    .setAction(async (_args, hre) => {
        if (!fs.existsSync(GAME7_TMP_DIR)) {
            fs.mkdirSync(GAME7_TMP_DIR);
        }

        // read deployment checksum file

        const { contractname: CONTRACT_NAME, chain: CHAIN } = _args;

        if (!CONTRACT_NAME) {
            throw new Error('Contract name is required');
        }

        const contract = CONTRACTS.find((d) => d.contractName === CONTRACT_NAME && d.chain === CHAIN);

        if (!contract) {
            throw new Error(`Contract ${CONTRACT_NAME} not found on ${CHAIN}`);
        }

        const deploymentChecksumFile = path.join(GAME7_TMP_DIR, 'deploymentchecksum.json');
        let deploymentChecksum = {};

        if (fs.existsSync(deploymentChecksumFile)) {
            const deploymentChecksumData = fs.readFileSync(deploymentChecksumFile, 'utf8');
            deploymentChecksum = JSON.parse(deploymentChecksumData);
        }

        // loop through the contracts and deploy them per tenant
        for (const tenant of contract.tenants) {
            const deployments = [];

            log(`Running deploy script for the ${CONTRACT_NAME} on ${CHAIN}`);

            // in each tenant deploy the dependencies first
            for (const dependency of contract.dependencies) {
                const _contract = CONTRACTS.find((d) => d.contractName === dependency && d.chain === CHAIN);
                const _constructorArgs = ConstructorArgs[`${_contract.contractName}Args`][`${_contract?.networkType}`];
                const _abiPath = `${hre.network.zksync ? ABI_PATH_ZK : ABI_PATH}${_contract.contractName}.sol/${
                    _contract.contractName
                }.json`;

                let _isAlreadyDeployed = false;
                // check if deployed yet first
                if (deploymentChecksum?.[_contract.contractName]) {
                    console.log('deploymentChecksum->', deploymentChecksum);
                    _isAlreadyDeployed = isAlreadyDeployed(
                        _contract.contractName,
                        deploymentChecksum[_contract.contractName]
                    );
                }

                if (_isAlreadyDeployed) {
                    log('SKIPPED: Already deployed');
                    // TODO * reuse deployment payload
                } else {
                    if (_contract.upgradable) {
                        //
                    } else {
                        const _deploymentPayload = await deploy(hre, _contract, _constructorArgs, _abiPath, tenant);
                        deployments.push(_deploymentPayload);
                    }
                }
            }

            // then deploy the main contract

            const constructorArgs = ConstructorArgs[`${CONTRACT_NAME}Args`][`${contract?.networkType}`];
            const abiPath = `${hre.network.zksync ? ABI_PATH_ZK : ABI_PATH}${contract.contractName}.sol/${
                contract.contractName
            }.json`;

            let _isAlreadyDeployed = false;
            // check if deployed yet first
            if (deploymentChecksum?.[_contract.contractName]) {
                console.log('deploymentChecksum->', deploymentChecksum);
                _isAlreadyDeployed = isAlreadyDeployed(
                    _contract.contractName,
                    deploymentChecksum[_contract.contractName]
                );
            }

            if (_isAlreadyDeployed) {
                log('SKIPPED: Already deployed');

                // TODO * reuse deployment payload
            } else {
                if (contract.upgradable) {
                    //
                } else {
                    const deploymentPayload = await deploy(hre, contract, constructorArgs, abiPath, tenant);
                    deployments.push(deploymentPayload);
                }
            }

            // write deployment payload per tenant
            for (const deployment of deployments) {
                console.log('deployment->', deployment);
                // await submitContractToDB(deployments);

                // Define the path to the file
                const filePath = path.resolve(`deployments-${deployment.type}-${tenant}-${Date.now()}.json`);
                // Convert deployments to JSON
                const deploymentsJson = JSON.stringify(deployment, null, 2);
                // Write to the file
                fs.writeFileSync(filePath, deploymentsJson);
                log(`Deployments saved to ${filePath}`);
            }

            // TODO * call functions at the end...
        }
    });
