import { ethers } from 'hardhat';
import { expect } from 'chai';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { Forwarder } from '../../typechain-types';

export async function setupFixture() {
    const [parentWallet, admin, user, user2, user3] = await ethers.getSigners();

    const Forwarder = await ethers.getContractFactory('Forwarder');
    const forwarder: Forwarder = await Forwarder.deploy(parentWallet, admin);

    await forwarder.waitForDeployment();

    const ERC20 = await ethers.getContractFactory('MockERC20');
    const erc20 = await ERC20.deploy('ERC20TEST', 'TERC20');

    const provider = ethers.provider;

    const forwarderWithAdmin = forwarder.connect(admin);

    return { parentWallet, erc20, admin, user, user2, user3, forwarder, provider, forwarderWithAdmin };
}

describe.only('Forwarder', function () {
    it('Should deploy successfully a forwarder contract', async function () {
        const { forwarder } = await loadFixture(setupFixture);
        expect(await forwarder.getAddress()).to.be.properAddress;
    });

    it('Every transfer of native tokens should be transferred without use the deposit function to the motherWallet', async function () {
        const { forwarder, parentWallet, user, provider } = await loadFixture(setupFixture);

        const amount = ethers.parseEther('1');
        const initialBalance = await provider.getBalance(await parentWallet.getAddress());
        const tx = await user.sendTransaction({ to: forwarder.target, value: amount });
        await expect(tx).to.emit(forwarder, 'ForwarderDeposited').withArgs(user.address, user.address, amount);
        await tx.wait();
        const finalBalance = await provider.getBalance(await parentWallet.getAddress());
        expect(finalBalance).to.equal(amount + initialBalance);
    });

    it('Call the deposit function must forward the money to the parent wallet if I call it as user correctly', async function () {
        const { forwarder, parentWallet, user, provider } = await loadFixture(setupFixture);

        const forwarderWithUser = forwarder.connect(user);
        const amount = ethers.parseEther('1');
        const initialBalance = await provider.getBalance(await parentWallet.getAddress());
        const tx = await forwarderWithUser.deposit({ value: amount });
        await expect(tx).to.emit(forwarder, 'ForwarderDeposited').withArgs(user.address, user.address, amount);
        await tx.wait();
        const finalBalance = await provider.getBalance(await parentWallet.getAddress());
        expect(finalBalance).to.equal(amount + initialBalance);
    });

    it('Call the depositTo function must work if I do it as an external payer', async function () {
        const { forwarder, parentWallet, user, provider, user2 } = await loadFixture(setupFixture);

        const forwarderWithUser1 = forwarder.connect(user);
        const amount = ethers.parseEther('1');
        const initialBalance = await provider.getBalance(await parentWallet.getAddress());
        const tx = await forwarderWithUser1.depositTo(user2, { value: amount });
        await expect(tx).to.emit(forwarder, 'ForwarderDeposited').withArgs(user2.address, user.address, amount);
        await tx.wait();
        const finalBalance = await provider.getBalance(await parentWallet.getAddress());
        expect(finalBalance).to.equal(amount + initialBalance);
    });
});
