import fs from 'fs';
import path from 'path';

import { log } from '@helpers/logger';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { NFTGatingArgs } from '@constants/constructor-args';
import { DeploymentMap } from '@helpers/types';
import getWallet from './getWallet';
import { ChainId, Currency, NetworkExplorer, NetworkName, rpcUrls } from '@constants/network';
import { encryptPrivateKey } from '@helpers/encrypt';

const { name, symbol, baseURI, superAdminTokenURI, adminTokenURI, tenants } = NFTGatingArgs.TESTNET;

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const encryptedPrivateKey = encryptPrivateKey(PRIVATE_KEY);
const CONTRACT_NAME = 'NFTGating';
const CONTRACT_TYPE = 'NFTGating';

const ABI_PATH = 'artifacts-zk/contracts/NFTGating.sol/NFTGating.json';

if (!PRIVATE_KEY) throw '⛔️ Private key not detected! Add it to the .env file!';

export default async function (hre: HardhatRuntimeEnvironment) {
    log(`Running deploy script for the ${CONTRACT_NAME} Proxy featuring ZkSync`);

    // Read the ABI

    const networkName = hre.network.name as NetworkName;
    const networkNameKey = Object.keys(NetworkName)[Object.values(NetworkName).indexOf(networkName)];
    const chainId = ChainId[networkNameKey as keyof typeof ChainId];
    const rpcUrl = rpcUrls[chainId as keyof typeof rpcUrls];
    const currency = Currency[networkNameKey as keyof typeof Currency];
    const blockExplorerBaseUrl = NetworkExplorer[networkNameKey as keyof typeof NetworkExplorer];

    const wallet = getWallet(PRIVATE_KEY);
    const deployments: DeploymentMap = {};

    const deployer = new Deployer(hre, wallet);
    const artifact = await deployer.loadArtifact(CONTRACT_NAME);

    const abiPath = path.resolve(ABI_PATH);
    const abiContent = fs.readFileSync(abiPath, 'utf8');
    const { abi: contractAbi } = JSON.parse(abiContent);

    for (const tenant of tenants) {
        const achievoContract = await deployer.deploy(artifact, [name, symbol, wallet.address, baseURI, adminTokenURI, superAdminTokenURI]);

        await achievoContract.waitForDeployment();

        const contractAddress = await achievoContract.getAddress();

        const verificationId = await hre.run('verify:verify', {
            address: contractAddress,
            contract: `contracts/${CONTRACT_NAME}.sol:${CONTRACT_NAME}`,
            constructorArguments: [name, symbol, wallet.address, baseURI, adminTokenURI, superAdminTokenURI],
        });

        log(`Verification ID: ${verificationId}`);

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
        log(`Deployed ${CONTRACT_TYPE}(${artifact.contractName}) for ${tenant} to :\n ${blockExplorerBaseUrl}/address/${contractAddress}#contract`);
    }

    // Define the path to the file
    const filePath = path.resolve(`deployments-${CONTRACT_TYPE}.json`);

    // Convert deployments to JSON
    const deploymentsJson = JSON.stringify(deployments, null, 2);

    // Write to the file
    fs.writeFileSync(filePath, deploymentsJson);
}
