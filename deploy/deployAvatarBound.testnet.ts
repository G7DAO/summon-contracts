import fs from 'fs';
import path from 'path';

import { AvatarBoundArgs } from '@constants/constructor-args';
import { log } from '@helpers/logger';
import { DeploymentMap } from '@helpers/types';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import getWallet from './getWallet';

const {
    name,
    symbol,
    baseURI,
    tenants,
    contractURI,
    revealURI,
    gatingNftAddress,
    itemsNftAddress,
    mintNFtWithoutGatingEnabled,
    mintRandomItemEnabled,
    mintNftGatingEnabled,
    mintSpecialItemEnabled,
    blockExplorerBaseUrl,
} = AvatarBoundArgs.TESTNET;

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const CONTRACT_NAME = 'AvatarBoundV1';
const CONTRACT_TYPE = 'Avatar';

const ABI_PATH = 'artifacts/contracts/upgradeables/AvatarBoundV1.sol/AvatarBoundV1.json';

if (!PRIVATE_KEY) throw '⛔️ Private key not detected! Add it to the .env file!';

export default async function (hre: HardhatRuntimeEnvironment) {
    log(`Running deploy script for the ${CONTRACT_NAME} Proxy featuring ZkSync`);

    const wallet = getWallet(PRIVATE_KEY);

    // Create deployer object and load the artifact of the contract you want to deploy.
    const deployer = new Deployer(hre, wallet);
    const artifact = await deployer.loadArtifact(CONTRACT_NAME);

    // Read the ABI
    const abiPath = path.resolve(ABI_PATH);

    // Read the file content
    const abiContent = fs.readFileSync(abiPath, 'utf8');
    const { abi: contractAbi } = JSON.parse(abiContent);

    const DEFAULT_CONTRACT_PAYLOAD = {
        type: CONTRACT_TYPE,
        chainId: 280,
        blockExplorerBaseUrl,
        privateKey: PRIVATE_KEY,
        publicKey: wallet.address,
        currency: 'ETH',
        active: true,
        rpcUrl: 'https://testnet.era.zksync.dev',
        networkName: 'zkSyncTestnet',
    };

    const deployments: DeploymentMap = {};

    for (const tenant of tenants) {
        const achievoContract = await hre.zkUpgrades.deployProxy(deployer.zkWallet as any, artifact, [
            name,
            symbol,
            baseURI,
            contractURI,
            revealURI,
            wallet.address,
            gatingNftAddress,
            itemsNftAddress,
            mintNFtWithoutGatingEnabled,
            mintRandomItemEnabled,
            mintNftGatingEnabled,
            mintSpecialItemEnabled,
        ]);

        // Show the contract info.
        const contractAddress = achievoContract.target;
        log(`${CONTRACT_TYPE}(${artifact.contractName}) for ${tenant} was deployed to https://goerli.explorer.zksync.io/address/${contractAddress}#contract`);

        // const verificationId = await hre.run('verify:verify', {
        //     address: contractAddress,
        //     contract: `contracts/${CONTRACT_NAME}.sol:${CONTRACT_NAME}`,
        //     constructorArguments: [
        //         name,
        //         symbol,
        //         baseURI,
        //         contractURI,
        //         revealURI,
        //         wallet.address,
        //         gatingNftAddress,
        //         itemsNftAddress,
        //         mintNFtWithoutGatingEnabled,
        //         mintRandomItemEnabled,
        //         mintNftGatingEnabled,
        //     ],
        // });

        // log(`Verification ID: ${verificationId}`);

        deployments[tenant] = {
            dbPayload: {
                ...DEFAULT_CONTRACT_PAYLOAD,
                contractAbi,
                contractAddress,
            },
            explorerUrl: `https://goerli.explorer.zksync.io/address/${contractAddress}#contract`,
        };

        log(`Verification must be done by console command: npx hardhat verify --network zkSyncTestnet ${contractAddress} --config zkSync.config.ts`);
    }

    // Define the path to the file
    const filePath = path.resolve(`deployments-${CONTRACT_TYPE}.json`);

    // Convert deployments to JSON
    const deploymentsJson = JSON.stringify(deployments, null, 2);

    // Write to the file
    fs.writeFileSync(filePath, deploymentsJson);
}
