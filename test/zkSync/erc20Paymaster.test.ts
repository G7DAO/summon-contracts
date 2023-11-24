import { ethers } from 'hardhat';
import { expect } from 'chai';
import { Wallet, utils, Provider, Contract } from 'zksync2-js';
import { log } from '../../helpers/logger';

// load env file
import * as dotenv from 'dotenv';
import hardhatConfig from '../../hardhat.config';
import zkSyncConfig from '../../zkSync.config';
import { deployContract, fundAccount, setupDeployer } from '../../helpers/zkUtils';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
dotenv.config();

// load wallet private key from env file
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

describe.only('ERC20Paymaster', function () {
    let provider: Provider;
    let minterAccount: Wallet;
    let deployer: Deployer;
    let token: Contract;
    let paymaster: Contract;
    let playerAccount: Wallet;
    let mockERC721Soulbound: Contract;

    const USDC_PRICE_ID = '0x41f3625971ca2ed2263e78573fe5ce23e13d2558ed3f2e47ab0f84fb9e7ae722';
    const ETH_PRICE_ID = '0xca80ba6dc32e08d06f1aa886011eed1d77c77be9eb761cc10d72b7d0a2fd57a6';
    const PYTH_ORACLE_ADDRESS = '0xC38B1dd611889Abc95d4E0a472A667c3671c08DE';

    async function executeMintTransaction(user: Wallet) {
        const tokenAddress = await token.getAddress();
        const paymasterAddress = await paymaster.getAddress();

        const paymasterParams = utils.getPaymasterParams(paymasterAddress, {
            type: 'ApprovalBased',
            token: tokenAddress,
            minimalAllowance: BigInt(1).toString(),
            // empty bytes as testnet paymaster does not use innerInput
            innerInput: new Uint8Array(),
        });

        log(`Minting 1 erc721 for empty wallet via paymaster...`);

        const mintTrx = await mockERC721Soulbound.connect(user).mint(user.address, {
            customData: {
                gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
                paymasterParams,
            },
        });

        await mintTrx.wait();
        log('paymaster params:', paymasterParams);
    }

    beforeEach(async function () {
        // @ts-ignore
        const deployUrl = zkSyncConfig.networks.zkSyncLocal.url;
        // setup deployer
        [provider, minterAccount, deployer] = setupDeployer(deployUrl, PRIVATE_KEY);

        const emptyWallet = Wallet.createRandom();
        log(`Empty wallet's address: ${emptyWallet.address}`);

        playerAccount = new Wallet(emptyWallet.privateKey, provider);

        token = await deployContract(deployer, 'MockUSDC', ['MyUSDC', 'mUSDC', 18]);
        mockERC721Soulbound = await deployContract(deployer, 'Mock721Soulbound', []);
        paymaster = await deployContract(deployer, 'ERC20Paymaster', [await token.getAddress(), USDC_PRICE_ID, ETH_PRICE_ID, PYTH_ORACLE_ADDRESS]);

        // fund paymaster
        await fundAccount(minterAccount, await paymaster.getAddress(), '3');
    });

    it('user with USDCMock token can mint using that erc20 instead of eth', async function () {
        const initialMintAmount = BigInt(3);
        const success = await token.mint(playerAccount.address, initialMintAmount);
        await success.wait();

        const userInitialTokenBalance = await token.balanceOf(playerAccount.address);
        const userInitialETHBalance = await provider.getBalance(playerAccount);
        const paymasterAddress = await paymaster.getAddress();

        const initialPaymasterBalance = await provider.getBalance(paymasterAddress);

        await executeMintTransaction(playerAccount);

        const finalETHBalance = await provider.getBalance(playerAccount);
        const finalUserTokenBalance = await token.balanceOf(playerAccount.address);
        const finalPaymasterBalance = await provider.getBalance(paymasterAddress);

        console.log('finalETHBalance ETH balance:', finalETHBalance.toString());
        console.log('finalUserTokenBalance ETH balance:', finalUserTokenBalance.toString());
        console.log('finalPaymasterBalance ETH balance:', finalPaymasterBalance.toString());

        expect(await mockERC721Soulbound.balanceOf(playerAccount.address)).to.equal(1);
        expect(initialPaymasterBalance > finalPaymasterBalance).to.be.true;
        expect(userInitialETHBalance).to.eql(finalETHBalance);
        expect(userInitialTokenBalance > finalUserTokenBalance).to.be.true;
    });

    it('should allow owner to withdraw all funds', async function () {
        const paymasterAddress = await paymaster.getAddress();

        const tx = await paymaster.connect(minterAccount).withdraw(playerAccount.address);
        await tx.wait();

        const finalContractBalance = await provider.getBalance(paymasterAddress);

        expect(finalContractBalance).to.eql(BigInt(0));
    });

    it('should prevent non-owners from withdrawing funds', async function () {
        try {
            await paymaster.connect(playerAccount).withdraw(minterAccount.address);
        } catch (e) {
            expect(e.message).to.include('Ownable: caller is not the owner');
        }
    });
});
