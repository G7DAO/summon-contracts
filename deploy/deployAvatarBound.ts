import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

// TODO: change here if you want to deploy/use to another contract type
import { AvatarBound, LevelsBound } from '../typechain-types';
import { log } from '@helpers/logger';
import getWallet from './getWallet';
import { AvatarBoundArgs, SoulBoundBadgesArgs } from '@constants/constructor-args';

// load wallet private key from env file
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

const CONTRACT_NAME = 'AvatarBound';

if (!PRIVATE_KEY) throw '⛔️ Private key not detected! Add it to the .env file!';

const { name, symbol, baseURI } = AvatarBoundArgs.MAINNET;

export default async function (hre: HardhatRuntimeEnvironment) {
    log(`Running deploy script for the ${CONTRACT_NAME} featuring ZkSync`);

    const wallet = await getWallet(PRIVATE_KEY);

    // Create deployer object and load the artifact of the contract you want to deploy.
    const deployer = new Deployer(hre, wallet);
    const artifact = await deployer.loadArtifact(CONTRACT_NAME);

    const achievoContract = (await deployer.deploy(artifact, [name, symbol, baseURI])) as AvatarBound;

    // Show the contract info.
    const contractAddress = achievoContract.address;
    log(`${artifact.contractName} was deployed to https://explorer.zksync.io/address/${contractAddress}#contract`);

    const verificationId = await hre.run('verify:verify', {
        address: contractAddress,
        contract: `contracts/${CONTRACT_NAME}.sol:${CONTRACT_NAME}`,
        constructorArguments: [name, symbol, baseURI],
    });
    log(`Verification ID: ${verificationId}`);
}
