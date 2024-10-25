import { log } from '@helpers/logger';
import * as hre from 'hardhat';
import { exec } from 'node:child_process';
import { ethers, upgrades } from 'hardhat';

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

const PROXY_ADDRESS = '0x84865664f4307160caB290a7606a26Ef94C1cad7';

if (!PRIVATE_KEY) throw '⛔️ Private key not detected! Add it to the .env file!';

const VERSION = 'V1';

// npx hardhat run deploy/upgrades/upgradeAvatarBound.testnet.ts --config zkSync.config.ts --network zkSync
async function main() {
    const NewContract = await ethers.getContractFactory(`LevelsBound${VERSION}`);
    await upgrades.upgradeProxy(PROXY_ADDRESS, NewContract);
    console.log('Contract upgraded');

    log(`upgraded to =>  NewContract -> ${VERSION}`);

    await new Promise((resolve, reject) => {
        exec(
            `npx hardhat verify --network ${hre.network.name} ${PROXY_ADDRESS} --config g7.config.ts`,
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
