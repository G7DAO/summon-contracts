import fs from 'fs';
import path from 'path';

import { ChainId, NetworkName, Currency, NetworkExplorer, rpcUrls } from '@constants/network';
import { encryptPrivateKey } from '@helpers/encrypt';
import { log } from '@helpers/logger';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import getWallet from './getWallet';
import { getFilePath } from '@helpers/folder';

// load wallet private key from env file
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const ENCRYPTION_KEY = process.env.PRIVATE_KEY || '';

if (!PRIVATE_KEY) throw '⛔️ Private key not detected! Add it to the .env file!';

if (!ENCRYPTION_KEY) throw '⛔️ Encryption key not detected! Add it to the .env file!';

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
    log(`[DEPLOYING] deploying ${contract.contractName} contract for [[${tenant}]] on ${networkName}`);
    log('=====================================================');

    const { name, ...rest } = constructorArgs;
    const restArgs = Object.values(rest);

    const wallet = getWallet(PRIVATE_KEY);
    const deployer = new Deployer(hre, wallet);
    const artifact = await deployer.loadArtifact(contract.contractName);

    let achievoContract;
    if (name) {
        achievoContract = await deployer.deploy(artifact, [`${name}${tenant}`, ...restArgs]);
    } else {
        achievoContract = await deployer.deploy(artifact, restArgs);
    }

    await achievoContract.waitForDeployment();
    // Show the contract info.
    const contractAddress = await achievoContract.getAddress();

    const contractPath = getFilePath('contracts', `${contract.contractName}.sol`);

    if (!contractPath) {
        throw new Error(`File ${contract.contractName}.sol not found`);
    }

    const relativeContractPath = path.relative('', contractPath);

    if (contract.verify) {
        await hre.run('verify:verify', {
            address: contractAddress,
            contract: `${relativeContractPath}:${contract.contractName}`,
            constructorArguments: name ? [`${name}${tenant}`, ...restArgs] : restArgs,
        });
    }

    // Read the file content
    const abiContent = fs.readFileSync(path.resolve(abiPath), 'utf8');
    const { abi: contractAbi } = JSON.parse(abiContent);

    const deploymentPayload = {
        contractAbi,
        contractAddress,
        type: contract.type,
        networkType: contract.networkType,
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
        upgradable: false,
    };

    log(`*****************************************************`);
    log(
        `Deployed ${contract.type}(${artifact.contractName}) for ${tenant} to :\n ${blockExplorerBaseUrl}/address/${contractAddress}#contract`
    );
    log(`*****************************************************`);

    return deploymentPayload;
}
