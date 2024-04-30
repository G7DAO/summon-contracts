import fs from 'fs';
import { exec } from 'node:child_process';
import path from 'path';

import { ChainId, NetworkName, Currency, NetworkExplorer, rpcUrls, NetworkConfigFile } from '@constants/network';
import { encryptPrivateKey } from '@helpers/encrypt';
import { log } from '@helpers/logger';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import * as ethers from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Wallet } from 'zksync-ethers';

import getZkWallet from './getWallet';
import { PROXY_CONTRACT_TYPE } from '@constants/contract';
import { Deployment } from 'types/deployment-type';
import { PROXY_ADMIN_PATH } from '@constants/proxy-deployments';

const { Wallet: EthersWallet } = ethers;

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
    log(`[DEPLOYING] deploying ${contract.name} UPGRADEABLE contract for [[${tenant}]] on ${networkName}`);
    log('=====================================================');

    log('=====================================================');
    log(`Upgradeable ${contract.upgradable}`);
    log('=====================================================');

    const { name, ...rest } = constructorArgs;
    const restArgs = Object.values(rest);

    log('=====================================================');
    log(`Args ${restArgs}`);
    log('=====================================================');

    // @ts-ignore
    let wallet: Wallet | EthersWallet;
    let achievoContract;
    let artifact;

    const isZkSync = hre.network.zksync;

    if (isZkSync) {
        wallet = getZkWallet(PRIVATE_KEY);
        const deployer = new Deployer(hre, wallet);
        artifact = await deployer.loadArtifact(contract.contractFileName);
        const args = Object.values(constructorArgs);
        achievoContract = await hre.zkUpgrades.deployProxy(deployer.zkWallet as any, artifact, [...args]);
    } else {
        // @ts-ignore
        wallet = new EthersWallet(PRIVATE_KEY, hre.ethers.provider);
        artifact = await hre.ethers.getContractFactory(contract.contractFileName);
        if (!name) {
            // @ts-ignore
            achievoContract = await hre.upgrades.deployProxy(artifact, [...restArgs]);
        } else {
            // @ts-ignore
            achievoContract = await hre.upgrades.deployProxy(artifact, [`${tenant}${name}`, ...restArgs]);
        }
    }

    await achievoContract.waitForDeployment();

    // Show the contract info.
    const contractAddress = await achievoContract.getAddress();
    const implementationAddress = await hre.upgrades.erc1967.getImplementationAddress(contractAddress);

    const proxyAdminAddress = await hre.upgrades.erc1967.getAdminAddress(contractAddress);
    const proxyAdminAbiContent = fs.readFileSync(path.resolve(PROXY_ADMIN_PATH), 'utf8');
    const { abi: proxyAdminAbi } = JSON.parse(proxyAdminAbiContent);
    const proxyAdminContract = await hre.ethers.getContractAt(proxyAdminAbi, proxyAdminAddress);
    const proxyAdminOwnerAddress = await proxyAdminContract.owner();

    log('=====================================================');
    log(`VERIFY: ${contract.verify}`);
    log('=====================================================');

    if (contract.verify) {
        await new Promise((resolve, reject) => {
            const networkConfigFile = NetworkConfigFile[networkNameKey as keyof typeof NetworkConfigFile];
            exec(
                `npx hardhat verify --network ${contract.chain} ${contractAddress} --config ${networkConfigFile}`,
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

    const deploymentPayload: Deployment = {
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
        upgradable: true,
        proxyType: PROXY_CONTRACT_TYPE.TransparentUpgradeableProxy,
        proxyAdmin: {
            address: proxyAdminAddress,
            owner: proxyAdminOwnerAddress,
            abi: proxyAdminAbi,
        },
        implementation: {
            abi: contractAbi,
            address: implementationAddress,
        },
    };

    log(`*****************************************************`);
    log(
        `Deployed ${contract.name}(${contract.contractFileName}) for ${tenant} to :\n ${blockExplorerBaseUrl}/address/${contractAddress}#contract`
    );
    log(`*****************************************************`);

    return deploymentPayload;
}
