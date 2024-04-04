import { log } from '@helpers/logger';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import * as hre from 'hardhat';

import getWallet from '../getWallet';

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

const PROXY_ADDRESS = '0xf9e0CeAdA11328b7A84EF9ECa839423ADA8A937d';

if (!PRIVATE_KEY) throw '⛔️ Private key not detected! Add it to the .env file!';

const VERSION = 'V2';

async function main() {
    const wallet = getWallet(PRIVATE_KEY);

    // Create deployer object and load the artifact of the contract you want to deploy.
    const deployer = new Deployer(hre, wallet);

    const LevelsBoundNewVersion = await deployer.loadArtifact(`LevelsBound${VERSION}`);

    await hre.zkUpgrades.upgradeProxy(deployer.zkWallet, PROXY_ADDRESS, LevelsBoundNewVersion);

    log(`LevelsBound upgraded to =>  LevelsBound${VERSION}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
