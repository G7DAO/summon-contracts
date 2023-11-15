import { log } from '@helpers/logger';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import getWallet from './getWallet';

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const CONTRACT_NAME = 'AvatarBoundV1';

if (!PRIVATE_KEY) throw '⛔️ Private key not detected! Add it to the .env file!';

export default async function (hre: HardhatRuntimeEnvironment) {
    log(`Running deploy script for the ${CONTRACT_NAME} Proxy featuring ZkSync`);

    const wallet = await getWallet(PRIVATE_KEY);

    // Create deployer object and load the artifact of the contract you want to deploy.
    const deployer = new Deployer(hre, wallet);
    const artifact = await deployer.loadArtifact(CONTRACT_NAME);

    // // Estimate contract deployment fee
    const achievoContract = await hre.zkUpgrades.deployProxy(deployer.zkWallet, artifact, ['AvatarBoundTest', 'Avatar']);
    log('AvatarBoundV1 deployed to:', achievoContract.address);

    // Show the contract info.
    const contractAddress = achievoContract.address;
    log(`${artifact.contractName} was deployed to https://explorer.zksync.io/address/${contractAddress}#contract`);

    log(`Verification must be done by console command: npx hardhat verify --network zkSync ${contractAddress} --config zkSync.config.ts`);
}
