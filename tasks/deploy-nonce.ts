import fs from 'fs';
import { exec } from 'node:child_process';
import path from 'path';

import { CONTRACT_NAME } from '@constants/contract';
import { ChainId, Currency, NetworkConfigFile, NetworkExplorer, NetworkName, rpcUrls } from '@constants/network';
import { CONTRACTS } from '@constants/nonce-deployments';
import { TENANT } from '@constants/tenant';
import { getContractFromDB, submitContractDeploymentsToDB } from '@helpers/contract';
import { encryptPrivateKey } from '@helpers/encrypt';
import { getABIFilePath } from '@helpers/folder';
import { log } from '@helpers/logger';
import * as ethers from 'ethers';
import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Deployment, DeploymentContract } from 'types/deployment-type';
import { utils, Provider as zkProvider, Wallet as zkWallet, ContractFactory as zkContractFactory } from 'zksync-ethers';

const { PRIVATE_KEY = '' } = process.env;

if (!PRIVATE_KEY) {
    throw new Error('Private key not detected! Add it to the .env file!');
}

const encoder = (types: readonly (string | ethers.ethers.ParamType)[], values: readonly any[]) => {
    const abiCoder = new ethers.AbiCoder();
    const encodedParams = abiCoder.encode(types, values);
    return encodedParams.slice(2);
};

const create2Address = (
    hre: HardhatRuntimeEnvironment,
    isZkSync: boolean,
    factoryAddress: string,
    initCode: string,
    saltHex: string
) => {
    let create2Addr;
    if (isZkSync) {
        create2Addr = utils.create2Address(factoryAddress, utils.hashBytecode(initCode), saltHex, '0x'); // zkSync
    } else {
        create2Addr = hre.ethers.getCreate2Address(factoryAddress, saltHex, ethers.keccak256(initCode)); // EVM chains
    }

    return create2Addr;
};

const deployOne = async (
    hre: HardhatRuntimeEnvironment,
    networkName: string,
    contract: DeploymentContract,
    saltString: string
): Promise<Deployment> => {
    const encryptedPrivateKey = await encryptPrivateKey(PRIVATE_KEY);
    const saltHex = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(saltString));
    const isZkSync = networkName.toLowerCase().includes('zksync');

    const abiPath = getABIFilePath(isZkSync, contract.contractFileName);
    const abiContent = fs.readFileSync(path.resolve(abiPath), 'utf8');
    const { abi: contractAbi, bytecode } = JSON.parse(abiContent);

    const networkNameKey = Object.keys(NetworkName)[Object.values(NetworkName).indexOf(networkName)];
    const chainId = ChainId[networkNameKey as keyof typeof ChainId];
    const blockExplorerBaseUrl = NetworkExplorer[networkNameKey as keyof typeof NetworkExplorer];
    const rpcUrl = rpcUrls[chainId];
    const currency = Currency[networkNameKey as keyof typeof Currency];

    let deployerWallet;
    let contractAddress: string;

    console.log('chainId', networkName, chainId);

    const factoryContract = await getContractFromDB(CONTRACT_NAME.DETERMINISTIC_FACTORY_CONTRACT, chainId);

    if (!factoryContract) {
        throw new Error(`Factory contract not found for ${networkName}`);
    }

    const factoryAddr = factoryContract?.contractAddress;

    if (!factoryAddr) {
        throw new Error(`Factory address not found for ${networkName}`);
    }

    if (isZkSync) {
        const ethNetworkName = networkName.split('zkSync')[1].toLowerCase() || 'mainnet';
        const ethNetworkNameKey = Object.keys(NetworkName)[Object.values(NetworkName).indexOf(ethNetworkName)];
        const ethChainId = ChainId[ethNetworkNameKey as keyof typeof ChainId];
        const ethRpcUrl = rpcUrls[ethChainId];

        const provider = new zkProvider(rpcUrl);
        const ethProvider = hre.ethers.getDefaultProvider(ethRpcUrl);

        deployerWallet = new zkWallet(PRIVATE_KEY, provider, ethProvider);

        const factory = new zkContractFactory(contractAbi, bytecode, deployerWallet);
        const achievoContract = await factory.deploy(deployerWallet.address);
        await achievoContract.waitForDeployment();
        contractAddress = await achievoContract.getAddress();
        console.log('Contract deployed to:', networkName, '::', contractAddress);
    } else {
        const provider = new hre.ethers.JsonRpcProvider(rpcUrl);
        deployerWallet = new hre.ethers.Wallet(PRIVATE_KEY, provider);

        const initCode = bytecode + encoder(['address'], [deployerWallet.address]);
        const create2Addr = create2Address(hre, isZkSync, factoryAddr, initCode, saltHex);
        console.log('precomputed address:', networkName, create2Addr);

        const Factory = await hre.ethers.getContractFactory(
            CONTRACT_NAME.DETERMINISTIC_FACTORY_CONTRACT,
            deployerWallet
        );
        const factory = Factory.attach(factoryAddr);
        const deployment = await factory.deploy(initCode, saltHex);
        const txReceipt = await deployment.wait();

        // find the log with the name Deployed
        const log = txReceipt.logs.find((log: { fragment: { name: string } }) => {
            return log.fragment.name === 'Deployed';
        });
        contractAddress = log.args[0];
        console.log('Contract deployed to:', networkName, '::', contractAddress);
    }

    // call initialize() function
    // check if contract has initialize function
    const hasInitializeFunction = contractAbi.some((abi: any) => abi.type === 'function' && abi.name === 'initialize');
    if (hasInitializeFunction) {
        const contractInstance = new hre.ethers.Contract(contractAddress, contractAbi, deployerWallet);
        const initializeArgs = contract.args ? [...Object.values(contract.args)] : []; // Add any arguments required for the initialize function
        console.log('initializeArgs', networkName, initializeArgs);
        const initializeTx = await contractInstance.initialize(...initializeArgs);
        await initializeTx.wait();
    } else {
        console.log('Contract does not have an initialize function');
    }

    // verify
    if (contract.verify) {
        const networkConfigFile = NetworkConfigFile[networkNameKey as keyof typeof NetworkConfigFile];
        exec(
            `npx hardhat verify ${contractAddress} ${deployerWallet.address} --network ${networkName} --config ${networkConfigFile}`,
            (error) => {
                if (error) {
                    console.warn(error);
                }
            }
        );
    }

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
        publicKey: deployerWallet.address,
        paymasterAddresses: [],
        fakeContractAddress: '',
        explorerUrl: `${blockExplorerBaseUrl}/address/${contractAddress}#contract`,
    };

    return deploymentPayload;
};

task('deploy-nonce', 'Deploys Smart contracts to same address across chain')
    .addParam('name', 'Contract Name you want to deploy', undefined, types.string)
    .addParam('tenant', 'Tenant you want to deploy', undefined, types.string)
    .addParam('salt', 'Fixed Salt', undefined, types.string)
    .addParam('chains', 'Chains in this order chain1,chain2,chain3', undefined, types.string)
    .setAction(
        async (
            _args: { name: CONTRACT_NAME; tenant: TENANT; chains: string; salt: string },
            hre: HardhatRuntimeEnvironment
        ) => {
            const { name, tenant, chains, salt } = _args;
            log('└─ args :\n');
            log(`   ├─ tenant : ${tenant}\n`);
            log(`   ├─ contractFileName : ${name}\n`);
            log(`   └─ chains : ${chains}\n`);

            const networksToDeploy: NetworkName[] = chains.split(',').map((chain) => {
                if (Object.values(NetworkName).includes(chain as NetworkName)) {
                    return chain as NetworkName;
                } else {
                    throw new Error(`Invalid chain: ${chain}`);
                }
            });

            const infoPerNetwork = await Promise.all(
                networksToDeploy.map(async (networkName: NetworkName) => {
                    const networkNameKey = Object.keys(NetworkName)[Object.values(NetworkName).indexOf(networkName)];
                    const chainId = ChainId[networkNameKey as keyof typeof ChainId];

                    const rpcUrl = rpcUrls[chainId];
                    const provider = new hre.ethers.JsonRpcProvider(rpcUrl);
                    const wallet = new hre.ethers.Wallet(PRIVATE_KEY, provider);
                    const nonce = await provider.getTransactionCount(wallet.address);

                    const balance = hre.ethers.formatEther(await provider.getBalance(wallet.address));

                    console.log(networkName, 'chain', chainId, 'nonce', nonce);

                    const contract = CONTRACTS.find((d) => d.name === name && d.chain === networkName);

                    if (!contract) {
                        throw new Error(`Contract ${name} not found on ${networkName}`);
                    }

                    return { chainId, nonce, balance };
                })
            );

            console.log('infoPerNetwork', infoPerNetwork);

            // check balance across all chains
            const minBalance = hre.ethers.parseEther('0.06'); // should have at least 0.06 eth
            const hasEnoughBalance = infoPerNetwork.every(({ chainId, balance }: { balance: string }) => {
                console.log(chainId, hre.ethers.parseEther(balance) >= minBalance);
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
                    log(`[STARTING] Deploy ${name} contract on ${networkName} for [[${tenant}]] via Create2 Contract`);
                    log('=====================================================');
                    log('=====================================================');
                    log('\n');
                    log('\n');

                    const contract = CONTRACTS.find((d) => d.name === name && d.chain === networkName);
                    if (!contract) {
                        throw new Error(`Contract ${name} not found on ${networkName}`);
                    }

                    const deployment = await deployOne(hre, networkName, contract, salt);
                    deployments.push(deployment);

                    log('=====================================================');
                    log(
                        `[DONE] ${name} contract deployment on ${networkName} for [[${tenant}]] via Create2 Contract is DONE!`
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
        }
    );
