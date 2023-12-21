import { logExplorerAddress, log } from '@helpers/logger';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import * as dotenv from 'dotenv';
import * as ethers from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Wallet, Contract } from 'zksync-ethers';

dotenv.config();

// load wallet private key from env file
const { PRIVATE_KEY, ERC20_TOKEN_ADDRESS } = process.env;

if (!PRIVATE_KEY) {
    throw new Error('Private key not detected! Add it to the .env file!');
}

if (!ERC20_TOKEN_ADDRESS) {
    throw new Error('ERC20 Token address not detected! Add it to the .env file!');
}

const USDC_PRICE_ID = '0x41f3625971ca2ed2263e78573fe5ce23e13d2558ed3f2e47ab0f84fb9e7ae722';

const ETH_PRICE_ID = '0xca80ba6dc32e08d06f1aa886011eed1d77c77be9eb761cc10d72b7d0a2fd57a6';

const PYTH_ORACLE_ADDRESS = '0xC38B1dd611889Abc95d4E0a472A667c3671c08DE';

const CONTRACT_NAME = 'ERC20Paymaster';

export default async function (hre: HardhatRuntimeEnvironment) {
    const wallet = new Wallet(PRIVATE_KEY as string);

    const deployer = new Deployer(hre, wallet);

    const paymasterArtifact = await deployer.loadArtifact(CONTRACT_NAME);
    const paymaster = (await deployer.deploy(paymasterArtifact, [
        ERC20_TOKEN_ADDRESS,
        USDC_PRICE_ID,
        ETH_PRICE_ID,
        PYTH_ORACLE_ADDRESS,
    ])) as unknown as Contract;

    await paymaster.waitForDeployment();

    const paymasterAddress = await paymaster.getAddress();

    log(`Paymaster address: ${paymasterAddress}`);

    await (
        await deployer.zkWallet.sendTransaction({
            // @ts-ignore-next-line
            to: paymasterAddress,
            value: ethers.parseEther('0.05'),
        })
    ).wait();

    log(`Paymaster funded with 0.05 ETH`);

    await hre.run('verify:verify', {
        address: paymasterAddress,
        contract: `contracts/paymasters/${CONTRACT_NAME}.sol:${CONTRACT_NAME}`,
        constructorArguments: [ERC20_TOKEN_ADDRESS, USDC_PRICE_ID, ETH_PRICE_ID, PYTH_ORACLE_ADDRESS],
    });

    // @ts-ignore-next-line
    logExplorerAddress(hre.network.config.chainId as number, paymasterAddress);
}
