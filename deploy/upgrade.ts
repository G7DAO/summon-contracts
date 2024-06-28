import fs from 'fs';
import path from 'path';

import { ChainId, NetworkName, Currency, NetworkExplorer, rpcUrls } from '@constants/network';
import { encryptPrivateKey } from '@helpers/encrypt';
import { getFilePath } from '@helpers/folder';
import { log } from '@helpers/logger';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import getWallet from './getWallet';

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
    tenant: any,
    proxyAddress: string
) {
    const encryptedPrivateKey = await encryptPrivateKey(PRIVATE_KEY);
    const networkName = hre.network.name as NetworkName;
    const networkNameKey = Object.keys(NetworkName)[Object.values(NetworkName).indexOf(networkName)]; // get NetworkName Key from Value
    const chainId = ChainId[networkNameKey as keyof typeof ChainId];
    const rpcUrl = rpcUrls[chainId as keyof typeof rpcUrls];
    const currency = Currency[networkNameKey as keyof typeof Currency];
    const blockExplorerBaseUrl = NetworkExplorer[networkNameKey as keyof typeof NetworkExplorer];

    log('=====================================================');
    log(`[UPGRADING] Upgrading ${contract.contractName} contract for [[${tenant}]] on ${networkName}`);
    log('=====================================================');

    const { name, ...rest } = constructorArgs;
    const restArgs = Object.values(rest);

    log('=====================================================');
    log(`Args ${restArgs}`);
    log('=====================================================');

    let achievoContract;

    const wallet = getWallet(PRIVATE_KEY);

    throw new Error('Not implemented yet'); // TODO : implement upgrade to non zksync chain

    log(`AvatarBound upgraded to =>  ${contract.name} - ${contract.version}`);

    // Show the contract info.
    const contractAddress = await achievoContract.getAddress();

    const contractPath = getFilePath('contracts', `${contract.contractName}.sol`);

    if (!contractPath) {
        throw new Error(`File ${contract.contractName}.sol not found`);
    }

    if (contract.verify) {
        log('Waiting for contract to be confirmed...');
        await achievoContract.deploymentTransaction()?.wait(5); // wait for 5 confirmations

        log('=====================================================');
        log(`Verifying ${contract.type}(${contract.contractName}) for ${tenant} on ${networkName}`);
        log('=====================================================');
        try {
            await hre.run('verify:verify', {
                address: contractAddress,
                contract: `${contractPath}:${contract.contractName}`,
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
        networkType: contract.networkType,
        name: contract.name,
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
        `Deployed ${contract.type}(${contract.contractName}) for ${tenant} to :\n ${blockExplorerBaseUrl}/address/${contractAddress}#contract`
    );
    log(`*****************************************************`);

    return deploymentPayload;
}
