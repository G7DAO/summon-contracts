import fs from 'fs';
import path from 'path';

import { ChainId, NetworkName, Currency, NetworkExplorer, rpcUrls } from '@constants/network';
import { encryptPrivateKey } from '@helpers/encrypt';
import { log } from '@helpers/logger';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeploymentContract } from 'types/deployment-type';

import getWallet from './getWallet';

// load wallet private key from env file
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const ENCRYPTION_KEY = process.env.PRIVATE_KEY || '';

if (!PRIVATE_KEY) throw '⛔️ Private key not detected! Add it to the .env file!';

if (!ENCRYPTION_KEY) throw '⛔️ Encryption key not detected! Add it to the .env file!';

export default async function (hre: HardhatRuntimeEnvironment, contractInfo: DeploymentContract, tenant: string) {
    const proxyAddressToUse = contractInfo.proxyAddress;
    if (!proxyAddressToUse) {
        throw new Error(
            `Proxy address not found in contract configuration for ${contractInfo.name} (version ${contractInfo.version}). Please ensure 'proxyAddress' is set.`
        );
    }
    const constructorArgsToUse = contractInfo.args || {};
    const factoryNameToUse = contractInfo.contractFileName;
    const logicalContractName = contractInfo.name;
    const contractVersion = contractInfo.version;

    const encryptedPrivateKey = await encryptPrivateKey(PRIVATE_KEY);
    const networkName = hre.network.name as NetworkName;
    const networkNameKey = Object.keys(NetworkName)[Object.values(NetworkName).indexOf(networkName)];
    const chainId = ChainId[networkNameKey as keyof typeof ChainId];
    const rpcUrl = rpcUrls[chainId as keyof typeof rpcUrls];
    const currency = Currency[networkNameKey as keyof typeof Currency];
    const blockExplorerBaseUrl = NetworkExplorer[networkNameKey as keyof typeof NetworkExplorer];

    log('=====================================================');
    log(
        `[UPGRADING] Upgrading ${factoryNameToUse} (logical name: ${logicalContractName}, version: ${contractVersion}) contract for [[${tenant}]] on ${networkName} at proxy ${proxyAddressToUse}`
    );
    log('=====================================================');

    const { name: argNameFromArgs, ...rest } = constructorArgsToUse;
    const restArgs = Object.values(rest);
    const fullConstructorArgsForVerify = argNameFromArgs ? [`${argNameFromArgs}${tenant}`, ...restArgs] : restArgs;

    log('=====================================================');
    log(
        `Processed constructor/initializer arguments (for verification/re-initialization if any): ${JSON.stringify(fullConstructorArgsForVerify)}`
    );
    log('=====================================================');

    const wallet = getWallet(PRIVATE_KEY).connect(hre.ethers.provider);
    log(`Upgrading with account: ${wallet.address}`);

    log(`Contract name from parameter (contractInfo.contractName): ${factoryNameToUse}`);
    log(`Using factory name: ${factoryNameToUse} for getContractFactory`);

    const ContractFactory = await hre.ethers.getContractFactory(factoryNameToUse, {
        signer: wallet,
    });

    log(`Attempting to upgrade proxy at ${proxyAddressToUse} to new implementation of ${factoryNameToUse}...`);

    const upgradedContractInstance = await hre.upgrades.upgradeProxy(proxyAddressToUse, ContractFactory, {});

    await upgradedContractInstance.waitForDeployment();
    const contractAddress = await upgradedContractInstance.getAddress();

    log(`Successfully upgraded ${factoryNameToUse} at proxy: ${contractAddress}`);
    const newImplementationAddress = await hre.upgrades.erc1967.getImplementationAddress(contractAddress);
    log(`New implementation address: ${newImplementationAddress}`);

    log(`Upgraded ${factoryNameToUse} (version: ${contractVersion || 'N/A'})`);

    const contractVerificationPath = `contracts/upgradeables/games/${factoryNameToUse}.sol:${factoryNameToUse}`;
    log(`Using verification path: ${contractVerificationPath}`);

    if (contractInfo.verify) {
        log('Waiting for contract upgrade transaction to be confirmed...');
        const upgradeTx = upgradedContractInstance.deploymentTransaction();
        if (upgradeTx) {
            await upgradeTx.wait(5);
            log('Transaction confirmed.');
        } else {
            log('No deployment transaction found for waiting, assuming already confirmed or handled.');
        }

        log('=====================================================');
        log(`Verifying new implementation for ${factoryNameToUse} on ${networkName}`);
        log('=====================================================');
        try {
            log(`Verifying implementation contract at: ${newImplementationAddress}`);
            await hre.run('verify:verify', {
                address: newImplementationAddress,
                contract: contractVerificationPath,
            });
            log(`Successfully verified implementation contract ${newImplementationAddress}`);
        } catch (error) {
            console.warn(`Verification failed or is not applicable for this network/contract: ${error}`);
        }
    }

    const artifact = await hre.artifacts.readArtifact(factoryNameToUse);
    const contractAbi = artifact.abi;

    const deploymentPayload = {
        contractAbi,
        contractAddress,
        implementationAddress: newImplementationAddress,
        type: contractInfo.type,
        networkType: contractInfo.networkType,
        name: logicalContractName,
        contractName: factoryNameToUse,
        version: contractVersion,
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
        explorerUrl: `${blockExplorerBaseUrl}/address/${contractAddress}#contract`,
        upgradable: true,
        tenant: tenant,
    };

    log(`*****************************************************`);
    log(
        `Upgraded ${contractInfo.type}(${factoryNameToUse}) for ${tenant} to proxy address:\\n ${deploymentPayload.explorerUrl}`
    );
    log(`New implementation at: ${deploymentPayload.implementationAddress}`);
    log(`*****************************************************`);

    return deploymentPayload;
}
