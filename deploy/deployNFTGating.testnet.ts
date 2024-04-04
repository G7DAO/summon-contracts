import fs from 'fs';
import path from 'path';

import { NFTGatingArgs } from '@constants/constructor-args';
import { ChainId, NetworkExplorer, NetworkName } from '@constants/network';
import { encryptPrivateKey } from '@helpers/encrypt';
import { log } from '@helpers/logger';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import getWallet from './getWallet';

const { name, symbol, baseURI, superAdminTokenURI, adminTokenURI } = NFTGatingArgs.TESTNET;

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
    const blockExplorerBaseUrl = NetworkExplorer[networkNameKey as keyof typeof NetworkExplorer];

    const wallet = getWallet(PRIVATE_KEY);

    const deployer = new Deployer(hre, wallet);
    const artifact = await deployer.loadArtifact(CONTRACT_NAME);

    const abiPath = path.resolve(ABI_PATH);
    const abiContent = fs.readFileSync(abiPath, 'utf8');

    const achievoContract = await deployer.deploy(artifact, [
        name,
        symbol,
        wallet.address,
        baseURI,
        adminTokenURI,
        superAdminTokenURI,
    ]);

    await achievoContract.waitForDeployment();

    const contractAddress = await achievoContract.getAddress();

    const verificationId = await hre.run('verify:verify', {
        address: contractAddress,
        contract: `contracts/${CONTRACT_NAME}.sol:${CONTRACT_NAME}`,
        constructorArguments: [name, symbol, wallet.address, baseURI, adminTokenURI, superAdminTokenURI],
    });

    log(`Verification ID: ${verificationId}`);

    log(
        `Deployed ${CONTRACT_TYPE}(${artifact.contractName}) to :\n ${blockExplorerBaseUrl}/address/${contractAddress}#contract`
    );
}
