import fs from 'fs';
import path from 'path';

import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

// TODO: change here if you want to deploy/use to another contract type
import { SoulBound1155 } from '../typechain-types';
import { log } from '@helpers/logger';
import getWallet from './getWallet';
import { ItemsBoundArgs } from '@constants/constructor-args';

const { name, symbol, baseURI, maxPerMint, isPaused, devWallet, royalty, tenants } = ItemsBoundArgs.TESTNET;

// load wallet private key from env file
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

const CONTRACT_NAME = 'SoulBound1155';
const CONTRACT_TYPE = 'Items';
const ABI_PATH = 'artifacts/contracts/SoulBound1155.sol/SoulBound1155.json';

interface DeploymentMap {
    [key: string]: {
        dbPayload: object;
        explorerUrl: string;
    };
}

if (!PRIVATE_KEY) throw '⛔️ Private key not detected! Add it to the .env file!';

export default async function (hre: HardhatRuntimeEnvironment) {
    log(`Running deploy script for the ${CONTRACT_NAME} featuring ZkSync`);

    const wallet = await getWallet(PRIVATE_KEY);
    const deployments: DeploymentMap = {};

    // Create deployer object and load the artifact of the contract you want to deploy.
    const deployer = new Deployer(hre, wallet);
    const artifact = await deployer.loadArtifact(CONTRACT_NAME);

    const abiPath = path.resolve(ABI_PATH);

    // Read the file content
    const abiContent = fs.readFileSync(abiPath, 'utf8');
    const { abi: contractAbi } = JSON.parse(abiContent);

    const DEFAULT_CONTRACT_PAYLOAD = {
        type: CONTRACT_TYPE,
        chainId: 280,
        blockExplorerBaseUrl: 'https://goerli.explorer.zksync.io',
        privateKey: PRIVATE_KEY,
        publicKey: wallet.address,
        currency: 'ETH',
        active: true,
        rpcUrl: 'https://testnet.era.zksync.dev',
        networkName: 'zkSyncTestnet',
    };

    for (const tenant of tenants) {
        const achievoContract = (await deployer.deploy(artifact, [
            `${tenant}${name}`,
            symbol,
            baseURI,
            maxPerMint,
            isPaused,
            devWallet,
            royalty,
        ])) as SoulBound1155;

        // Show the contract info.
        const contractAddress = achievoContract.address;
        log(`${CONTRACT_TYPE}(${artifact.contractName}) for ${tenant} was deployed to https://explorer.zksync.io/address/${contractAddress}#contract`);

        const verificationId = await hre.run('verify:verify', {
            address: contractAddress,
            contract: `contracts/${CONTRACT_NAME}.sol:${CONTRACT_NAME}`,
            constructorArguments: [`${tenant}${name}`, symbol, baseURI, maxPerMint, isPaused, devWallet, royalty],
        });
        log(`Verification ID: ${verificationId}`);

        deployments[tenant] = {
            dbPayload: {
                ...DEFAULT_CONTRACT_PAYLOAD,
                contractAbi,
                contractAddress,
            },
            explorerUrl: `https://explorer.zksync.io/address/${contractAddress}#contract`,
        };
    }

    console.log('Deployments:', JSON.stringify(deployments, null, 2));

    // Define the path to the file
    const filePath = path.resolve(`deployments-${CONTRACT_TYPE}.json`);

    // Convert deployments to JSON
    const deploymentsJson = JSON.stringify(deployments, null, 2);

    // Write to the file
    fs.writeFileSync(filePath, deploymentsJson);
}
