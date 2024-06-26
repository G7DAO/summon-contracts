import fs from 'fs';
import path from 'path';

import { ChainId, NetworkName, Currency, NetworkExplorer, rpcUrls } from '@constants/network';
import { encryptPrivateKey } from '@helpers/encrypt';
import { getFilePath } from '@helpers/folder';
import { log } from '@helpers/logger';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import getWallet from './getWallet';

// load wallet private key from env file
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const ENCRYPTION_KEY = process.env.PRIVATE_KEY || '';

export default async function (
    hre: HardhatRuntimeEnvironment,
    contract: any,
    constructorArgs: any,
    abiPath: string,
    tenant: any
) {
    const isHardhatNetwork = hre.network.name === 'hardhat';
    if (!PRIVATE_KEY && !isHardhatNetwork) throw '⛔️ Private key not detected! Add it to the .env file!';
    if (!ENCRYPTION_KEY && !isHardhatNetwork) throw '⛔️ Encryption key not detected! Add it to the .env file!';
    const encryptedPrivateKey = !isHardhatNetwork ? await encryptPrivateKey(PRIVATE_KEY) : '';
    const networkName = hre.network.name as NetworkName;
    const networkNameKey = Object.keys(NetworkName)[Object.values(NetworkName).indexOf(networkName)]; // get NetworkName Key from Value
    const chainId = ChainId[networkNameKey as keyof typeof ChainId];
    const rpcUrl = rpcUrls[chainId as keyof typeof rpcUrls];
    const currency = Currency[networkNameKey as keyof typeof Currency];
    const blockExplorerBaseUrl = NetworkExplorer[networkNameKey as keyof typeof NetworkExplorer];

    log('\n\n');
    log('=====================================================');
    log(`[DEPLOYING] deploying ${contract.name} contract for [[${tenant}]] on ${networkName}`);
    log('=====================================================');

    const { name, ...rest } = constructorArgs;
    const restArgs = Object.values(rest);

    log('=====================================================');
    log(`Args ${restArgs}`);
    log('=====================================================');

    let achievoContract;

    const wallet = getWallet(PRIVATE_KEY);

    if (hre.network.zksync) {
        const deployer = new Deployer(hre, wallet);
        const artifact = await deployer.loadArtifact(contract.contractFileName);

        if (name) {
            achievoContract = await deployer.deploy(artifact, [`${name}${tenant}`, ...restArgs]);
        } else {
            achievoContract = await deployer.deploy(artifact, restArgs);
        }
    } else {
        if (name) {
            achievoContract = await hre.ethers.deployContract(contract.contractFileName, [
                `${name}${tenant}`,
                ...restArgs,
            ]);
        } else {
            console.info('Constructor arguments:', JSON.stringify(restArgs, null, 2));
            achievoContract = await hre.ethers.deployContract(contract.contractFileName, restArgs);
        }
    }

    await achievoContract.waitForDeployment();

    // Show the contract info.
    const contractAddress = await achievoContract.getAddress();

    const contractPath = getFilePath('contracts', `${contract.contractFileName}.sol`);

    if (!contractPath) {
        throw new Error(`File ${contract.contractFileName}.sol not found`);
    }

    if (contract.verify) {
        log('Waiting for contract to be confirmed...');
        if (hre.network.name === NetworkName.Game7OrbitArbSepolia || hre.network.name === NetworkName.Game7Testnet) {
            // This L3 provided network requires only 1 confirmation
            await achievoContract.deploymentTransaction()?.wait(1); // wait for 1 confirmation
        } else {
            await achievoContract.deploymentTransaction()?.wait(5); // wait for 5 confirmations
        }

        log('=====================================================');
        log(`Verifying ${contract.type}(${contract.name}) for ${tenant} on ${networkName}`);
        log('=====================================================');
        try {
            await hre.run('verify:verify', {
                address: contractAddress,
                contract: `${contractPath}:${contract.contractFileName}`,
                constructorArguments: name ? [`${name}${tenant}`, ...restArgs] : restArgs,
            });
        } catch (error) {
            console.warn(error);
        }
    }

    // Read the file content
    const abiContent = fs.readFileSync(path.resolve(abiPath), 'utf8');
    const { abi: contractAbi } = JSON.parse(abiContent);

    const deploymentPayload = {
        contractAbi,
        contractAddress,
        type: contract.type,
        name: contract.name,
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
        `Deployed ${contract.name}(${contract.contractFileName}) for ${tenant} to :\n ${blockExplorerBaseUrl}/address/${contractAddress}#contract`
    );
    log(`*****************************************************`);

    return deploymentPayload;
}
