import { exec } from 'node:child_process';

import { log } from '@helpers/logger';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import * as hre from 'hardhat';

import getWallet from '../getWallet';

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

const PROXY_ADDRESS = '0x9d9A8FD106C054f5DA7Ab2944ac53738a7b99F1e';

if (!PRIVATE_KEY) throw '⛔️ Private key not detected! Add it to the .env file!';

const VERSION = 'V2';

async function main() {
    const wallet = getWallet(PRIVATE_KEY);

    // Create deployer object and load the artifact of the contract you want to deploy.
    const deployer = new Deployer(hre, wallet);

    const LegacyAvatarBoundNewVersion = await deployer.loadArtifact(`LegacyAvatarUpgradeable${VERSION}`);

    await hre.zkUpgrades.upgradeProxy(deployer.zkWallet, PROXY_ADDRESS, LegacyAvatarBoundNewVersion);

    log(`LegacyAvatarBound upgraded to =>  LegacyAvatarBound${VERSION}`);

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
