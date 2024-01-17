import * as hre from 'hardhat';
import getWallet from '../getWallet';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { log } from '@helpers/logger';

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

const PROXY_ADDRESS = '0xb4aEd40D92Ac7b01F5C75795d7f089ab70b00188';

if (!PRIVATE_KEY) throw '⛔️ Private key not detected! Add it to the .env file!';

const VERSION = 'V2';

async function main() {
    const wallet = getWallet(PRIVATE_KEY);

    // Create deployer object and load the artifact of the contract you want to deploy.
    const deployer = new Deployer(hre, wallet);

    const AvatarBoundNewVersion = await deployer.loadArtifact(`ERC20ChainlinkPaymaster${VERSION}`);

    await hre.zkUpgrades.upgradeProxy(deployer.zkWallet, PROXY_ADDRESS, AvatarBoundNewVersion);

    log(`ERC20ChainlinkPaymaster upgraded to =>  ERC20ChainlinkPaymaster${VERSION}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
