import { log } from '@helpers/logger';
import { deployContract, setupDeployer } from '@helpers/zkUtils';
import * as dotenv from 'dotenv';
import hre from 'hardhat';

import zkSyncConfig from '../zkSync.config';

dotenv.config();

// load wallet private key from env file

async function main() {
    const { PRIVATE_KEY } = process.env;

    if (!PRIVATE_KEY) {
        throw new Error('Private key not detected! Add it to the .env file!');
    }
    const CONTRACT_NAME = 'MockUSDC';
    // @ts-ignore
    const deployUrl = zkSyncConfig.networks.zkSyncSepolia.url;
    const [_, __, deployer] = setupDeployer(deployUrl, PRIVATE_KEY);
    const token = await deployContract(deployer, 'MockUSDC', ['oUSDC', 'oUSDC', 18]);
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();
    log(`MockUSDC deployed at ${tokenAddress}`);
    await hre.run('verify:verify', {
        address: tokenAddress,
        contract: `contracts/mocks/${CONTRACT_NAME}.sol:${CONTRACT_NAME}`,
        constructorArguments: ['oUSDC', 'oUSDC', 18],
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
