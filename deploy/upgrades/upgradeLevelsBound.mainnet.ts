import { exec } from 'node:child_process';

import { log } from '@helpers/logger';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import * as hre from 'hardhat';

import getWallet from '../getWallet';

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

const PROXY_ADDRESS = '0xF473487C507fdCD4BF21b989512FaBE3Ad032CC3'; // TODO * ADD PROXY ADDRESS to upgrade

if (!PRIVATE_KEY) throw '⛔️ Private key not detected! Add it to the .env file!';

// TODO: change me
const VERSION = 'V3';

// TODO: change me
const CONTRACT_NAME = 'LevelsBound';

async function main() {
    const wallet = getWallet(PRIVATE_KEY);

    // Create deployer object and load the artifact of the contract you want to deploy.
    const deployer = new Deployer(hre, wallet);

    const newVersionArtifact = await deployer.loadArtifact(`${CONTRACT_NAME}${VERSION}`);

    await hre.zkUpgrades.upgradeProxy(deployer.zkWallet, PROXY_ADDRESS, newVersionArtifact);

    log(`${CONTRACT_NAME}${VERSION} upgraded to =>  ${CONTRACT_NAME}${VERSION}`);

    await new Promise((resolve, reject) => {
        exec(
            `npx hardhat verify --network ${hre.network.name} ${PROXY_ADDRESS} --config zkSync.config.ts`,
            (error, stdout, stderr) => {
                if (error) {
                    console.warn(error);
                    reject(error);
                }
                resolve(stdout ? stdout : stderr);
            }
        );
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
