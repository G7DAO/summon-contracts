import hre, { ethers } from 'hardhat';
import * as dotenv from 'dotenv';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';

import { ChainId, rpcUrls } from '@constants/network';

import getWallet from './getWallet';

dotenv.config();

const { DETERMINISTIC_DEPLOYER_PRIVATE_KEY } = process.env;
const DETERMINISTIC_FACTORY_CONTRACT = 'DeterministicDeployFactory';

async function main() {
    const chainsToDeploy = [
        // ChainId.ZkSyncSepolia,
        // ChainId.ArbitrumSepolia,
        // ChainId.Sepolia,
        // ChainId.PolygonMumbai,
        // ChainId.MantleWadsley,
    ];

    if (chainsToDeploy.length === 0) {
        throw new Error('No chains to deploy');
    }

    const walletData = await Promise.all(
        chainsToDeploy.map(async (chainId) => {
            const rpcUrl = rpcUrls[chainId];
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            const wallet = new ethers.Wallet(DETERMINISTIC_DEPLOYER_PRIVATE_KEY, provider);
            const nonce = await provider.getTransactionCount(wallet.address);

            const balance = ethers.formatEther(await provider.getBalance(wallet.address));

            console.log('chain', chainId, 'nonce', nonce);
            return { chainId, nonce, balance };
        })
    );

    const isSameNonce = walletData.every(({ nonce }) => nonce === walletData[0]);
    if (!isSameNonce) {
        throw new Error('Nonces are not the same in each chain');
    }

    // check balance across all chains
    const minBalance = ethers.parseEther('0.06');
    const hasEnoughBalance = walletData.every(({ chainId, balance }: { balance: string }) => {
        console.log(chainId, ethers.parseEther(balance) >= minBalance);
        return ethers.parseEther(balance) >= minBalance;
    });
    if (!hasEnoughBalance) {
        throw new Error('Not enough balance in one or more wallets');
    }

    await Promise.all(
        chainsToDeploy.map(async (chainId) => {
            console.log('chainId', chainId);
            if (chainId === ChainId.ZkSyncSepolia || chainId === ChainId.ZkSync) {
                const wallet = getWallet(DETERMINISTIC_DEPLOYER_PRIVATE_KEY);
                const deployer = new Deployer(hre, wallet);
                const artifact = await deployer.loadArtifact(DETERMINISTIC_FACTORY_CONTRACT);

                const achievoContract = await deployer.deploy(artifact);
                console.log('Factory deployed to:', achievoContract.target);
            } else {
                const rpcUrl = rpcUrls[chainId];
                const provider = new ethers.JsonRpcProvider(rpcUrl);
                const deployerWallet = new ethers.Wallet(DETERMINISTIC_DEPLOYER_PRIVATE_KEY, provider);
                const achievoContract = await ethers.deployContract(DETERMINISTIC_FACTORY_CONTRACT, deployerWallet);
                console.log('Factory deployed to:', achievoContract.target);
            }
        })
    );

    // upload to db
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
