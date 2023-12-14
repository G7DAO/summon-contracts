import { exec } from 'node:child_process';
import * as hre from 'hardhat';
import getWallet from '../getWallet';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { log } from '@helpers/logger';

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

const PROXY_ADDRESS = ''; // TODO * ADD PROXY ADDRESS to upgrade

if (!PRIVATE_KEY) throw '⛔️ Private key not detected! Add it to the .env file!';

// TODO: change me
const VERSION = 'V2';

// TODO: change me
const CONTRACT_NAME = 'LevelsBound';

async function main() {
    const wallet = getWallet(PRIVATE_KEY);

    // Create deployer object and load the artifact of the contract you want to deploy.
    const deployer = new Deployer(hre, wallet);

    const newVersionArtifact = await deployer.loadArtifact(`${CONTRACT_NAME}${VERSION}`);

    await hre.zkUpgrades.upgradeProxy(deployer.zkWallet, PROXY_ADDRESS, newVersionArtifact);

    log(`${CONTRACT_NAME}${VERSION} upgraded to =>  ${CONTRACT_NAME}${VERSION}`);

    // if (contract.verify) {
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
    // }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
