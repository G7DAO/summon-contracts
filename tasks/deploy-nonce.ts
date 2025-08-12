import fs from 'fs';
import { exec } from 'node:child_process';
import path from 'path';

import { CONTRACT_NAME } from '@constants/contract';
import { ChainId, Currency, NetworkConfigFile, NetworkExplorer, NetworkName, rpcUrls } from '@constants/network';
import { CONTRACTS } from '@constants/nonce-deployments';
import { TENANT } from '@constants/tenant';
import { getContractFromDB, submitContractDeploymentsToDB } from '@helpers/contract';
import { encoder } from '@helpers/encoder';
import { encryptPrivateKey } from '@helpers/encrypt';
import { getABIFilePath } from '@helpers/folder';
import { log } from '@helpers/logger';
import getWallet from 'deploy/getWallet';
import * as ethers from 'ethers';
import { Contract } from 'ethers';
import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Deployment, DeploymentContract } from 'types/deployment-type';

const { PRIVATE_KEY = '' } = process.env;

if (!PRIVATE_KEY) {
    throw new Error('Private key not detected! Add it to the .env file!');
}

const wallet = getWallet(PRIVATE_KEY);
const MINTER_ROLE = '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6';

const create2Address = (hre: HardhatRuntimeEnvironment, factoryAddress: string, initCode: string, saltHex: string) => {
    const create2Addr = hre.ethers.getCreate2Address(factoryAddress, saltHex, ethers.keccak256(initCode)); // EVM chains
    return create2Addr;
};

export function populateNonceParam(
    param: string | number | boolean,
    networkName: NetworkName,
    deployments: Deployment[],
    salt: string
): string | number | boolean {
    let value = param;

    if (param === 'DEPLOYER_WALLET') {
        return wallet.address;
    }

    if (param === 'MINTER_ROLE') {
        return MINTER_ROLE;
    }

    if (typeof param === 'string' && param.startsWith('CONTRACT_')) {
        const name = param.substring('CONTRACT_'.length);
        const deployedContract = deployments?.find(
            (d) => d.name === name && d.networkName === networkName && d.networkName === networkName && d.salt === salt
        );

        if (!deployedContract) {
            throw new Error(`Contract ${name} not found`);
        }

        value = deployedContract.contractAddress;
    }

    return value;
}

const deployOne = async (
    hre: HardhatRuntimeEnvironment,
    networkName: NetworkName,
    contract: DeploymentContract,
    saltString: string
): Promise<Deployment> => {
    const encryptedPrivateKey = await encryptPrivateKey(PRIVATE_KEY);
    const saltHex = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(saltString));

    const abiPath = getABIFilePath(contract.contractFileName);
    const abiContent = fs.readFileSync(path.resolve(abiPath as string), 'utf8');
    const { abi: contractAbi, bytecode } = JSON.parse(abiContent);

    const networkNameKey = Object.keys(NetworkName)[ Object.values(NetworkName).indexOf(networkName) ];
    const chainId = ChainId[ networkNameKey as keyof typeof ChainId ];
    const blockExplorerBaseUrl = NetworkExplorer[ networkNameKey as keyof typeof NetworkExplorer ];
    const rpcUrl = rpcUrls[ chainId ];
    const currency = Currency[ networkNameKey as keyof typeof Currency ];

    console.log('chainId', networkName, chainId);

    const factoryContract = await getContractFromDB(CONTRACT_NAME.DETERMINISTIC_FACTORY_CONTRACT, chainId);

    if (!factoryContract) {
        throw new Error(`Factory contract not found for ${networkName}`);
    }

    const factoryAddr = factoryContract?.contractAddress;

    if (!factoryAddr) {
        throw new Error(`Factory address not found for ${networkName}`);
    }

    const provider = new hre.ethers.JsonRpcProvider(rpcUrl);
    const deployerWallet = new hre.ethers.Wallet(PRIVATE_KEY, provider);

    const initCode = bytecode + encoder([ 'address' ], [ deployerWallet.address ], 2);
    const create2Addr = create2Address(hre, factoryAddr, initCode, saltHex);
    console.log('precomputed address:', networkName, create2Addr);

    const Factory = await hre.ethers.getContractFactory(CONTRACT_NAME.DETERMINISTIC_FACTORY_CONTRACT, deployerWallet);
    const factory = Factory.attach(factoryAddr) as Contract;
    const deployment = await factory.deploy(initCode, saltHex);
    const txReceipt = await deployment.wait();

    // find the log with the name Deployed
    const log = txReceipt.logs.find((log: { fragment: { name: string } }) => {
        return log.fragment.name === 'Deployed';
    });
    const contractAddress = log.args[ 0 ];
    console.log('Contract deployed to:', networkName, '::', contractAddress);

    // verify
    if (contract.verify) {
        const networkConfigFile = NetworkConfigFile[ networkNameKey as keyof typeof NetworkConfigFile ];
        exec(
            `npx hardhat verify ${contractAddress} ${deployerWallet.address} --network ${networkName} --config ${networkConfigFile}`,
            (error) => {
                if (error) {
                    console.warn(error);
                }
            }
        );
    }

    return {
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
        upgradable: contract.upgradable,
        salt: saltString,
    };
};

const getDependencies = (contractName: string, chain: string) => {
    const dependencies = new Set([ contractName ]);

    function collect(contractName: string) {
        const contract = CONTRACTS.find((c) => c.name === contractName && c.chain === chain);
        if (contract) {
            contract.dependencies?.forEach((dep) => {
                if (!dependencies.has(dep)) {
                    dependencies.add(dep);
                    collect(dep);
                }
            });
        }
    }

    collect(contractName);

    return [ ...dependencies ];
};

task('deploy-nonce', 'Deploys Smart contracts to same address across chain')
    .addParam('name', 'Contract Name you want to deploy', undefined, types.string)
    .addParam('tenant', 'Tenant you want to deploy', undefined, types.string)
    .addParam('salt', 'Fixed Salt', undefined, types.string)
    .addParam('chains', 'Chains in this order chain1,chain2,chain3', undefined, types.string)
    .addFlag('submit', 'Do you want to submit to db?')
    .setAction(
        async (
            _args: { name: CONTRACT_NAME; tenant: TENANT; chains: string; salt: string; submit: boolean },
            hre: HardhatRuntimeEnvironment
        ) => {
            const { name, tenant, chains, salt, submit } = _args;
            log('└─ args :\n');
            log(`   ├─ Tenant : ${tenant}\n`);
            log(`   ├─ Contract name : ${name}\n`);
            log(`   └─ Chains : ${chains}\n`);

            const networksToDeploy: NetworkName[] = chains.split(',').map((chain) => {
                if (Object.values(NetworkName).includes(chain as NetworkName)) {
                    return chain as NetworkName;
                } else {
                    throw new Error(`Invalid chain: ${chain}`);
                }
            });

            const infoPerNetwork = await Promise.all(
                networksToDeploy.map(async (networkName: NetworkName) => {
                    const networkNameKey = Object.keys(NetworkName)[ Object.values(NetworkName).indexOf(networkName) ];
                    const chainId = ChainId[ networkNameKey as keyof typeof ChainId ];

                    const rpcUrl = rpcUrls[ chainId ];
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
            // @ts-ignore
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

                    const contract = CONTRACTS.find(
                        (d) => d.name === name && d.chain === networkName && d.tenants.find((t) => t === tenant)
                    );
                    if (!contract) {
                        throw new Error(`Contract ${name} not found on ${networkName}`);
                    }

                    const contractsToDeploy = getDependencies(contract.name, networkName);

                    log('=====================================================');
                    log('=====================================================');
                    log(`[STARTING] Deploy ${name} contract on ${networkName} for [[${tenant}]]`);
                    log(`Contracts to deploy: ${contractsToDeploy.length}`);
                    for (const contract of contractsToDeploy) {
                        log(`contract: ${contract}`);
                    }
                    log('=====================================================');
                    log('=====================================================');
                    log('\n');
                    log('\n');
                    log('\n');
                    log('\n');

                    for (const contractName of contractsToDeploy) {
                        const contract = CONTRACTS.find(
                            (d) => d.name === contractName && d.chain === networkName
                        ) as unknown as DeploymentContract;
                        log(
                            `[PREPPING] Get ready to deploy ${name}:<${contract.contractFileName}> contract on ${networkName} for ${tenant}`
                        );

                        const deployment = await deployOne(hre, networkName, contract, salt);
                        deployments.push(deployment);
                    }

                    log('=====================================================');
                    log(
                        `[DONE] ${name} contract deployment on ${networkName} for [[${tenant}]] via Create2 Contract is DONE!`
                    );
                    log('=====================================================');
                    log('\n');
                })
            );

            // submit to db
            if (submit) {
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

            for (const deployment of deployments) {
                const { contractAbi, contractAddress, name, networkName } = deployment;

                log('\n');
                log('\n');
                log('=====================================================');
                log('=====================================================');
                log(`[INITIALIZING] Calling initialize() on ${name} contract on ${networkName} for [[${tenant}]]`);
                log('=====================================================');
                log('=====================================================');
                log('\n');
                log('\n');

                const deployedContract = CONTRACTS.find(
                    (d) =>
                        d.type === deployment.type && d.chain === networkName && d.upgradable === deployment.upgradable
                );

                if (!deployedContract) {
                    throw new Error(`Contract ${deployment.type} not found on ${networkName}`);
                }

                console.log('deployedContract', deployedContract);

                const networkNameKey = Object.keys(NetworkName)[ Object.values(NetworkName).indexOf(networkName) ];
                const chainId = ChainId[ networkNameKey as keyof typeof ChainId ];
                const rpcUrl = rpcUrls[ chainId ];

                const provider = new hre.ethers.JsonRpcProvider(rpcUrl);
                const deployerWallet = new hre.ethers.Wallet(PRIVATE_KEY, provider);

                const initializeArgs = [];
                for (const key in deployedContract?.args) {
                    const arg = populateNonceParam(deployedContract?.args[ key ], networkName, deployments, salt);
                    console.log('key:', key, 'arg:', arg);
                    initializeArgs.push(arg);
                }

                // check if contract has initialized function
                const hasInitializeFunction = contractAbi.some(
                    (abi: any) => abi.type === 'function' && abi.name === 'initialize'
                );
                if (hasInitializeFunction) {
                    const contractInstance = new hre.ethers.Contract(contractAddress, contractAbi, deployerWallet);
                    console.log('initializeArgs', networkName, initializeArgs);
                    const initializeTx = await contractInstance.initialize(...initializeArgs);
                    await initializeTx.wait();
                } else {
                    console.log('Contract does not have an initialize function');
                }

                log('\n');
                log('\n');
                log('=====================================================');
                log('=====================================================');
                log(`[DONE] Initialization is completed for ${name} contract on ${networkName} for [[${tenant}]]`);
                log('=====================================================');
                log('=====================================================');
                log('\n');
                log('\n');
            }
        }
    );
