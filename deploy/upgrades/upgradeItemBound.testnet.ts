import * as hre from 'hardhat';
import getWallet from '../getWallet';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { log } from '@helpers/logger';

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

const PROXY_ADDRESS = '0xbF26f57D85f5b0376627752e6dF79648b1937Aa0';

if (!PRIVATE_KEY) throw '⛔️ Private key not detected! Add it to the .env file!';

// TODO: change me
const VERSION = 'V2';

// TODO: change me
const CONTRACT_NAME = 'ItemBound';

async function main() {
    const wallet = getWallet(PRIVATE_KEY);

    // Create deployer object and load the artifact of the contract you want to deploy.
    const deployer = new Deployer(hre, wallet);

    const newVersionArtifact = await deployer.loadArtifact(`${CONTRACT_NAME}${VERSION}`);

    await hre.zkUpgrades.upgradeProxy(deployer.zkWallet, PROXY_ADDRESS, newVersionArtifact);

    log(`${CONTRACT_NAME}${VERSION} upgraded to =>  ${CONTRACT_NAME}${VERSION}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
