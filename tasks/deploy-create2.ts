import fs from 'fs';
import { exec } from 'node:child_process';
import path from 'path';

import { CONTRACT_FILE_NAME } from '@constants/contract';
import { ChainId, Currency, NetworkConfigFile, NetworkExplorer, NetworkName, rpcUrls } from '@constants/network';
import { TENANT } from '@constants/tenant';
import { submitContractDeploymentsToDB } from '@helpers/contract';
import { encryptPrivateKey } from '@helpers/encrypt';
import { createDefaultFolders, getABIFilePath } from '@helpers/folder';
import { log } from '@helpers/logger';
import * as ethers from 'ethers';
import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Deployment } from 'types/deployment-type';

const { DETERMINISTIC_DEPLOYER_PRIVATE_KEY = '', PRIVATE_KEY = '' } = process.env;

if (!DETERMINISTIC_DEPLOYER_PRIVATE_KEY && PRIVATE_KEY) {
    throw new Error('DETERMINISTIC_DEPLOYER_PRIVATE_KEY not detected! Add it to the .env file!');
}

const deployOne = async (
    hre: HardhatRuntimeEnvironment,
    networkName: string,
    contractFileName: string
): Promise<Deployment> => {
    const encryptedPrivateKey = await encryptPrivateKey(DETERMINISTIC_DEPLOYER_PRIVATE_KEY);

    const abiPath = getABIFilePath(contractFileName);

    const networkNameKey = Object.keys(NetworkName)[Object.values(NetworkName).indexOf(networkName as NetworkName)];
    const chainId = ChainId[networkNameKey as keyof typeof ChainId];
    const blockExplorerBaseUrl = NetworkExplorer[networkNameKey as keyof typeof NetworkExplorer];
    const rpcUrl = rpcUrls[chainId];
    const currency = Currency[networkNameKey as keyof typeof Currency];

    const abiContent = fs.readFileSync(path.resolve(abiPath as string), 'utf8');
    const { abi: contractAbi } = JSON.parse(abiContent);

    const provider = new hre.ethers.JsonRpcProvider(rpcUrl);
    const deployerWallet = new hre.ethers.Wallet(DETERMINISTIC_DEPLOYER_PRIVATE_KEY, provider);
    const managerWallet = new hre.ethers.Wallet(PRIVATE_KEY, provider);
    const achievoContract = await hre.ethers.deployContract(contractFileName, [managerWallet.address], deployerWallet);

    await achievoContract.waitForDeployment();

    // Show the contract info.
    const contractAddress = await achievoContract.getAddress();

    console.log('Factory deployed to:', networkName, '::', contractAddress);

    const networkConfigFile = NetworkConfigFile[networkNameKey as keyof typeof NetworkConfigFile];
    exec(
        `npx hardhat verify ${contractAddress} ${managerWallet.address} --network ${networkName} --config ${networkConfigFile}`,
        (error) => {
            if (error) {
                console.warn(error.message);
            }
        }
    );

    const deploymentPayload: Deployment = {
        contractAbi,
        contractAddress,
        type: contractFileName,
        name: contractFileName,
        networkName: networkName as NetworkName,
        chainId,
        rpcUrl,
        currency,
        blockExplorerBaseUrl,
        privateKey: encryptedPrivateKey,
        publicKey: deployerWallet.address,
        paymasterAddresses: [],
        fakeContractAddress: '',
        explorerUrl: `${blockExplorerBaseUrl}/address/${contractAddress}#contract`,
    };

    return deploymentPayload;
};

task('deploy-create2', 'Deploys Create2 Smart contracts')
    .addParam('tenant', 'Tenant you want to deploy', undefined, types.string)
    .addParam('chains', 'Chains in this order chain1,chain2,chain3', undefined, types.string)
    .setAction(async (_args: { tenant: TENANT; chains: string; force: boolean }, hre: HardhatRuntimeEnvironment) => {
        const { tenant, chains } = _args;
        const name = CONTRACT_FILE_NAME.DETERMINISTIC_FACTORY_CONTRACT;
        log('└─ args :\n');
        log(`   ├─ tenant : ${tenant}\n`);
        log(`   ├─ contractFileName : ${name}\n`);
        log(`   └─ chains : ${chains}\n`);

        if (!Object.values(TENANT).includes(tenant)) {
            throw new Error(`Invalid tenant: ${tenant}`);
        }

        const networksToDeploy: NetworkName[] = chains.split(',').map((chain) => {
            if (Object.values(NetworkName).includes(chain as NetworkName)) {
                return chain as NetworkName;
            } else {
                throw new Error(`Invalid chain: ${chain}`);
            }
        });

        const walletData = await Promise.all(
            networksToDeploy.map(async (networkName: NetworkName) => {
                const networkNameKey = Object.keys(NetworkName)[Object.values(NetworkName).indexOf(networkName)];
                const chainId = ChainId[networkNameKey as keyof typeof ChainId];

                const rpcUrl = rpcUrls[chainId];
                const provider = new hre.ethers.JsonRpcProvider(rpcUrl);
                const wallet = new hre.ethers.Wallet(DETERMINISTIC_DEPLOYER_PRIVATE_KEY, provider);
                const nonce = await provider.getTransactionCount(wallet.address);

                const balance = hre.ethers.formatEther(await provider.getBalance(wallet.address));

                console.log(networkName, 'chain', chainId, 'nonce', nonce);
                return { chainId, nonce, balance };
            })
        );

        console.log('walletData', walletData);

        const isSameNonce = walletData.every(({ nonce }) => nonce === walletData[0].nonce);

        console.log('isSameNonce', isSameNonce);
        // if (!isSameNonce) {
        //     throw new Error('Nonces are not the same in each chain');
        // }

        // check balance across all chains
        const minBalance = hre.ethers.parseEther('0.0003'); // should have at least 0.06 eth
        // @ts-ignore
        const hasEnoughBalance = walletData.every(({ chainId, balance }: { balance: string }) => {
            console.log(chainId, ethers.parseEther(balance) >= minBalance);
            return hre.ethers.parseEther(balance) >= minBalance;
        });
        if (!hasEnoughBalance) {
            throw new Error('Not enough balance in one or more wallets');
        }

        const deployments: Deployment[] = [];

        await Promise.all(
            networksToDeploy.map(async (networkName: NetworkName) => {
                log('\n');
                log('\n');
                log('=====================================================');
                log('=====================================================');
                log(`[STARTING] Deploy ${name} contract on ${networkName} for [[${tenant}]]`);
                log('=====================================================');
                log('=====================================================');
                log('\n');
                log('\n');

                createDefaultFolders(networkName); // create default folders

                const deployment = await deployOne(hre, networkName, name);
                deployments.push(deployment);

                log('=====================================================');
                log(
                    `[DONE] ${name} contract deployment <${deployment.contractAddress}> on ${networkName} for [[${tenant}]] is DONE!`
                );
                log('=====================================================');
                log('\n');
            })
        );

        // submit to db
        try {
            log('*******************************************');
            log('[SUBMITTING] Deployments to db');
            log('*******************************************');
            await submitContractDeploymentsToDB(deployments, tenant);
            log('*******************************************');
            log('*** Deployments submitted to db ***');
            log('*******************************************');
        } catch (error: any) {
            log('*******************************************');
            log('***', error.message, '***');
            log('*******************************************');
        }
    });
