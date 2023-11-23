import { logExplorerAddress, log } from '@helpers/logger';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import * as dotenv from 'dotenv';
import * as ethers from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Wallet, Contract } from 'zksync2-js';

dotenv.config();

// load wallet private key from env file
const { PRIVATE_KEY, ERC20_TOKEN_ADDRESS } = process.env;

if (!PRIVATE_KEY) {
    throw new Error('Private key not detected! Add it to the .env file!');
}

if (!ERC20_TOKEN_ADDRESS) {
    throw new Error('ERC20 Token address not detected! Add it to the .env file!');
}

const USER_WALLET_ADDRESS = 'FILLMEEEEEEEE';

const USDC_PRICE_ID = '0x41f3625971ca2ed2263e78573fe5ce23e13d2558ed3f2e47ab0f84fb9e7ae722';

const ETH_PRICE_ID = '0xca80ba6dc32e08d06f1aa886011eed1d77c77be9eb761cc10d72b7d0a2fd57a6';

const PYTH_ORACLE_ADDRESS = '0xC38B1dd611889Abc95d4E0a472A667c3671c08DE';

const CONTRACT_NAME = 'ERC20Paymaster';

export default async function (hre: HardhatRuntimeEnvironment) {
    const wallet = new Wallet(PRIVATE_KEY as string);

    const deployer = new Deployer(hre, wallet);

    const erc20Artifact = await deployer.loadArtifact('MockUSDC');
    const erc20 = await deployer.deploy(erc20Artifact, ['oUSDC', 'oUSDC', 18]);

    // Supplying the ERC20 tokens to the user wallet:
    const mint5kTx = await erc20.mint(USER_WALLET_ADDRESS, 5000n);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await mint5kTx.wait();

    log('Minted 5000 oUSDC for the user wallet');

    await hre.run('verify:verify', {
        address: erc20.address,
        contract: `contracts/mocks/MockUSDC.sol:MockUSDC`,
        constructorArguments: ['oUSDC', 'oUSDC', 18],
    });

    const paymasterArtifact = await deployer.loadArtifact(CONTRACT_NAME);
    const paymaster = (await deployer.deploy(paymasterArtifact, [
        ERC20_TOKEN_ADDRESS,
        USDC_PRICE_ID,
        ETH_PRICE_ID,
        PYTH_ORACLE_ADDRESS,
    ])) as unknown as Contract;

    await (
        await deployer.zkWallet.sendTransaction({
            // @ts-ignore-next-line
            to: paymaster.address,
            value: ethers.parseEther('0.05'),
        })
    ).wait();

    await hre.run('verify:verify', {
        address: paymaster.address,
        contract: `contracts/${CONTRACT_NAME}.sol:${CONTRACT_NAME}`,
        constructorArguments: [ERC20_TOKEN_ADDRESS, USDC_PRICE_ID, ETH_PRICE_ID, PYTH_ORACLE_ADDRESS],
    });

    // @ts-ignore-next-line
    logExplorerAddress(hre.network.config.chainId as number, paymaster.address);
}
