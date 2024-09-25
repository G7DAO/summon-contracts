import { log } from '@helpers/logger';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import * as hre from 'hardhat';

import getWallet from '../getWallet';
import { exec } from 'node:child_process';

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

const PROXY_ADDRESS = '0x023938455d7A9B90984E38d9069fA4b34345a63c';

if (!PRIVATE_KEY) throw '⛔️ Private key not detected! Add it to the .env file!';

const VERSION = 'V3';

async function main() {
    const wallet = getWallet(PRIVATE_KEY);

    // Create deployer object and load the artifact of the contract you want to deploy.
    const deployer = new Deployer(hre, wallet);

    const AvatarBoundNewVersion = await deployer.loadArtifact(`AvatarBound${VERSION}`);

    await hre.zkUpgrades.upgradeProxy(deployer.zkWallet, PROXY_ADDRESS, AvatarBoundNewVersion);

    log(`AvatarBound upgraded to =>  AvatarBound${VERSION}`);

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
