import fs from 'fs';
import path from 'path';
import { exec } from 'node:child_process';

import { ChainId, NetworkName, Currency, NetworkExplorer, rpcUrls } from '@constants/network';
import { encryptPrivateKey } from '@helpers/encrypt';
import { log } from '@helpers/logger';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import getWallet from './getWallet';

// load wallet private key from env file
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
if (!PRIVATE_KEY) throw '⛔️ Private key not detected! Add it to the .env file!';

export default async function (
    hre: HardhatRuntimeEnvironment,
    contract: any,
    constructorArgs: any,
    abiPath: string,
    tenant: any
) {
    const encryptedPrivateKey = await encryptPrivateKey(PRIVATE_KEY);
    const networkName = hre.network.name as NetworkName;
    const networkNameKey = Object.keys(NetworkName)[Object.values(NetworkName).indexOf(networkName)]; // get NetworkName Key from Value
    const chainId = ChainId[networkNameKey as keyof typeof ChainId];
    const rpcUrl = rpcUrls[chainId as keyof typeof rpcUrls];
    const currency = Currency[networkNameKey as keyof typeof Currency];
    const blockExplorerBaseUrl = NetworkExplorer[networkNameKey as keyof typeof NetworkExplorer];

    log('=====================================================');
    log(`Running deploy script for the ${contract.contractName} for ${tenant} on ${networkName}`);
    log('=====================================================');

    const { name, ...rest } = constructorArgs;
    const restArgs = Object.values(rest);

    const wallet = getWallet(PRIVATE_KEY);
    const deployer = new Deployer(hre, wallet);
    const artifact = await deployer.loadArtifact(contract.contractName);

    const achievoContract = await hre.zkUpgrades.deployProxy(deployer.zkWallet as any, artifact, [
        `${tenant}${name}`,
        ...restArgs,
    ]);

    await achievoContract.waitForDeployment();

    // Show the contract info.
    const contractAddress = await achievoContract.getAddress();

    if (contract.verify) {
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
    }

    // Read the file content
    const abiContent = fs.readFileSync(path.resolve(abiPath), 'utf8');
    const { abi: contractAbi } = JSON.parse(abiContent);

    const deploymentPayload = {
        contractAbi,
        contractAddress,
        type: contract.type,
        active: false,
        networkName,
        chainId,
        rpcUrl,
        currency,
        blockExplorerBaseUrl,
        privateKey: encryptedPrivateKey,
        publicKey: wallet.address,
        paymasterAddresses: [],
        fakeContractAddress: '',
        explorerUrl: `${blockExplorerBaseUrl}/address/${contractAddress}#contract`,
    };

    log(`*****************************************************`);
    log(
        `Deployed ${contract.type}(${artifact.contractName}) for ${tenant} to :\n ${blockExplorerBaseUrl}/address/${contractAddress}#contract`
    );
    log(`*****************************************************`);

    return deploymentPayload;
}
