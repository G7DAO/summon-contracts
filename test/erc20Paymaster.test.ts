import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ERC20Paymaster, MockUSDC } from '../typechain-types';

describe.skip('ERC20Paymaster', function () {
    let mockUSDC: MockUSDC;
    let paymaster: ERC20Paymaster;
    let minterAccount: SignerWithAddress;
    let playerAccount: SignerWithAddress;
    beforeEach(async function () {
        const erc20Paymaster = (await ethers.getContractFactory('ERC20Paymaster')) as unknown as ERC20Paymaster;
        const usdcContract = (await ethers.getContractFactory('MockUSDC')) as unknown as MockUSDC;
        const [adminAccount, player] = await ethers.getSigners();

        minterAccount = adminAccount;
        playerAccount = player;
        // @ts-ignore-next-line
        paymaster = await erc20Paymaster.deploy();
        await erc20Paymaster.waitForDeployment();

        // @ts-ignore-next-line
        mockUSDC = await usdcContract.deploy();
        await mockUSDC.waitForDeployment();

        // Supplying the ERC20 tokens to the user wallet:
        const mint5kTx = await usdcContract.mint(player, 10n);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        await mint5kTx.wait();
    });
});
