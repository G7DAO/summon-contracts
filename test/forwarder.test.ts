import { ethers } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { Forwarder } from '../typechain-types';

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

describe('Forwarder', function () {
    it('Should deploy successfully a forwarder contract', async function () {
        const { forwarder } = await loadFixture(setupFixture);
        expect(await forwarder.getAddress()).to.be.properAddress;
    });

    it('Every transfer of native tokens should be transferred without use the deposit function to the motherWallet', async function () {
        const { forwarder, parentWallet, user, provider } = await loadFixture(setupFixture);

        const amount = ethers.parseEther('1');
        const initialBalance = await provider.getBalance(await parentWallet.getAddress());
        const tx = await user.sendTransaction({ to: forwarder.target, value: amount });
        await expect(tx)
            .to.emit(forwarder, 'ForwarderDeposited')
            .withArgs(user.address, user.address, amount, parentWallet);
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
        await expect(tx)
            .to.emit(forwarder, 'ForwarderDeposited')
            .withArgs(user.address, user.address, amount, parentWallet);
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
        await expect(tx)
            .to.emit(forwarder, 'ForwarderDeposited')
            .withArgs(user2.address, user.address, amount, parentWallet);
        await tx.wait();
        const finalBalance = await provider.getBalance(await parentWallet.getAddress());
        expect(finalBalance).to.equal(amount + initialBalance);
    });

    it('Should revert when trying to deposit 0 amount', async function () {
        const { forwarder, user } = await loadFixture(setupFixture);
        const forwarderWithUser = forwarder.connect(user);
        await expect(forwarderWithUser.deposit({ value: 0 })).to.be.revertedWithCustomError(forwarder, 'InvalidAmount');
    });

    it('Should revert when trying to depositTo with 0 amount', async function () {
        const { forwarder, user, user2 } = await loadFixture(setupFixture);
        const forwarderWithUser = forwarder.connect(user);
        await expect(forwarderWithUser.depositTo(user2.address, { value: 0 })).to.be.revertedWithCustomError(
            forwarder,
            'InvalidAmount'
        );
    });

    it('Should allow admin to update parent address', async function () {
        const { forwarderWithAdmin, user } = await loadFixture(setupFixture);
        const newParentAddress = user.address;
        await expect(forwarderWithAdmin.updateParentAddress(newParentAddress))
            .to.emit(forwarderWithAdmin, 'ParentAddressUpdated')
            .withArgs(newParentAddress);
        expect(await forwarderWithAdmin.parentAddress()).to.equal(newParentAddress);
    });

    it('Should revert when non-admin tries to update parent address', async function () {
        const { forwarder, user } = await loadFixture(setupFixture);
        const forwarderWithUser = forwarder.connect(user);
        await expect(forwarderWithUser.updateParentAddress(user.address)).to.be.reverted;
    });

    it('Should revert when trying to update parent address to zero address', async function () {
        const { forwarderWithAdmin } = await loadFixture(setupFixture);
        await expect(forwarderWithAdmin.updateParentAddress(ethers.ZeroAddress)).to.be.revertedWithCustomError(
            forwarderWithAdmin,
            'InvalidParentAddress'
        );
    });

    it('Should allow pauser to pause the contract', async function () {
        const { forwarderWithAdmin } = await loadFixture(setupFixture);
        await expect(forwarderWithAdmin.pause()).to.not.be.reverted;
        expect(await forwarderWithAdmin.paused()).to.be.true;
    });

    it('Should allow pauser to unpause the contract', async function () {
        const { forwarderWithAdmin } = await loadFixture(setupFixture);
        await forwarderWithAdmin.pause();
        await expect(forwarderWithAdmin.unpause()).to.not.be.reverted;
        expect(await forwarderWithAdmin.paused()).to.be.false;
    });

    it('Should revert when non-pauser tries to pause the contract', async function () {
        const { forwarder, user } = await loadFixture(setupFixture);
        const forwarderWithUser = forwarder.connect(user);
        await expect(forwarderWithUser.pause()).to.be.reverted;
    });

    it('Should revert deposits when contract is paused', async function () {
        const { forwarderWithAdmin, user } = await loadFixture(setupFixture);
        await forwarderWithAdmin.pause();
        const forwarderWithUser = forwarderWithAdmin.connect(user);
        await expect(forwarderWithUser.deposit({ value: ethers.parseEther('1') })).to.be.revertedWithCustomError(
            forwarderWithUser,
            'EnforcedPause'
        );
    });

    it('Should handle receive function correctly', async function () {
        const { forwarder, user, parentWallet, provider } = await loadFixture(setupFixture);
        const amount = ethers.parseEther('1');
        const initialBalance = await provider.getBalance(parentWallet.address);
        await expect(user.sendTransaction({ to: forwarder.target, value: amount }))
            .to.emit(forwarder, 'ForwarderDeposited')
            .withArgs(user.address, user.address, amount, parentWallet);
        const finalBalance = await provider.getBalance(parentWallet.address);
        expect(finalBalance).to.equal(initialBalance + amount);
    });

    it('Should handle fallback function correctly', async function () {
        const { forwarder, user, parentWallet, provider } = await loadFixture(setupFixture);
        const amount = ethers.parseEther('1');
        const initialBalance = await provider.getBalance(parentWallet.address);
        const data = '0x1234'; // Some non-empty calldata
        await expect(user.sendTransaction({ to: forwarder.target, value: amount, data }))
            .to.emit(forwarder, 'ForwarderDeposited')
            .withArgs(user.address, user.address, amount, parentWallet);
        const finalBalance = await provider.getBalance(parentWallet.address);
        expect(finalBalance).to.equal(initialBalance + amount);
    });
});
