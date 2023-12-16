import fs from 'fs';
import { exec } from 'node:child_process';
import path from 'path';

import { ConstructorArgs } from '@constants/constructor-args';
import { ChainId, NetworkName, Currency, NetworkExplorer, rpcUrls } from '@constants/network';
import { encryptPrivateKey } from '@helpers/encrypt';
import { log } from '@helpers/logger';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeploymentMap } from 'types/deployment-type';

import getWallet from './getWallet';

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const encryptedPrivateKey = encryptPrivateKey(PRIVATE_KEY);

if (!PRIVATE_KEY) throw '⛔️ Private key not detected! Add it to the .env file!';

export default async function (
    hre: HardhatRuntimeEnvironment,
    deploymentArgs: { CONTRACT_NAME: string; CONTRACT_TYPE: string; ABI_PATH: string },
    constructorArgs: ConstructorArgs
) {
    const { CONTRACT_NAME, CONTRACT_TYPE, ABI_PATH } = deploymentArgs;
    const { name, symbol, baseURI, contractURI, maxPerMint, isPaused, royalty, tenants } = constructorArgs;

    log(`Running deploy script for the ${CONTRACT_NAME} Proxy featuring ZkSync`);

    const networkName = hre.network.name as NetworkName;
    const networkNameKey = Object.keys(NetworkName)[Object.values(NetworkName).indexOf(networkName)]; // get NetworkName Key from Value
    const chainId = ChainId[networkNameKey as keyof typeof ChainId];
    const rpcUrl = rpcUrls[chainId as keyof typeof rpcUrls];
    const currency = Currency[networkNameKey as keyof typeof Currency];
    const blockExplorerBaseUrl = NetworkExplorer[networkNameKey as keyof typeof NetworkExplorer];

    const wallet = getWallet(PRIVATE_KEY);
    const deployments: DeploymentMap = {};

    // Create deployer object and load the artifact of the contract you want to deploy.
    const deployer = new Deployer(hre, wallet);
    const artifact = await deployer.loadArtifact(CONTRACT_NAME);

    const abiPath = path.resolve(ABI_PATH);

    // Read the file content
    const abiContent = fs.readFileSync(abiPath, 'utf8');
    const { abi: contractAbi } = JSON.parse(abiContent);

    for (const tenant of tenants) {
        const achievoContract = await hre.zkUpgrades.deployProxy(deployer.zkWallet as any, artifact, [
            `${tenant}${name}`,
            symbol,
            baseURI,
            contractURI,
            maxPerMint,
            isPaused,
            wallet.address,
            royalty,
        ]);

        await achievoContract.waitForDeployment();

        // Show the contract info.
        const contractAddress = await achievoContract.getAddress();

        log(
            `${CONTRACT_TYPE}(${artifact.contractName}) for ${tenant} was deployed to https://sepolia.explorer.zksync.io/address/${contractAddress}#contract`
        );

        deployments[tenant] = {
            dbPayload: {
                contractAbi,
                contractAddress,
                type: CONTRACT_TYPE,
                active: true,
                networkName,
                chainId,
                rpcUrl,
                currency,
                blockExplorerBaseUrl,
                privateKey: encryptedPrivateKey,
                publicKey: wallet.address,
                paymasterAddresses: [],
                fakeContractAddress: '',
            },
            explorerUrl: `${blockExplorerBaseUrl}/address/${contractAddress}#contract`,
        };

        log(
            `Deployed ${CONTRACT_TYPE}(${artifact.contractName}) for ${tenant} to :\n ${blockExplorerBaseUrl}/address/${contractAddress}#contract`
        );

        if (process.env.AUTO_VERIFY === 'true') {
            await new Promise((resolve, reject) => {
                exec(
                    `npx hardhat verify --network zkSyncTestnet ${contractAddress} --config zkSync.config.ts`,
                    (error, stdout, stderr) => {
                        if (error) {
                            console.warn(error);
                            reject(error);
                        }
                        resolve(stdout ? stdout : stderr);
                    }
                );
            });

            log(`${CONTRACT_TYPE}(${artifact.contractName}) for ${tenant} verified!`);
        }
    }

    // Define the path to the file
    const filePath = path.resolve(`deployments-${CONTRACT_TYPE}.json`);

    // Convert deployments to JSON
    const deploymentsJson = JSON.stringify(deployments, null, 2);

    // Write to the file
    fs.writeFileSync(filePath, deploymentsJson);
}
