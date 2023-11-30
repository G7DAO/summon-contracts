import * as hre from 'hardhat';
import getWallet from '../getWallet';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { log } from '@helpers/logger';

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

const PROXY_ADDRESS = '0xd34b70262CE2a82F08710fc97fA23c9F2741FA59';

if (!PRIVATE_KEY) throw '⛔️ Private key not detected! Add it to the .env file!';

const VERSION = 'V6';

async function main() {
    const wallet = getWallet(PRIVATE_KEY);

    // Create deployer object and load the artifact of the contract you want to deploy.
    const deployer = new Deployer(hre, wallet);

    const AvatarBoundNewVersion = await deployer.loadArtifact(`AvatarBound${VERSION}`);

    await hre.zkUpgrades.upgradeProxy(deployer.zkWallet, PROXY_ADDRESS, AvatarBoundNewVersion);

    log(`AvatarBound upgraded to =>  AvatarBound${VERSION}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
