import { Wallet } from 'zksync-web3';
import { ethers } from 'hardhat';
import { log } from '@helpers/logger';
import { formatUnits } from 'ethers';

export default async function (privateKey: string) {
    // Initialize the wallet.
    const wallet = new Wallet(privateKey);

    const [account] = await ethers.getSigners();
    const address = account.address;
    const balance = await account.getBalance();

    log('Main account address: ', address);
    log('Main account formatted ETH: ', formatUnits(balance, 'ether'));

    return wallet;
}
