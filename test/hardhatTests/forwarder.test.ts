import { ethers } from 'hardhat';
import { expect } from 'chai';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';

export async function setupFixture() {
    const [motherWallet, admin, user, user2, user3] = await ethers.getSigners();

    const Forwarder = await ethers.getContractFactory('Forwarder');
    const forwarder = await Forwarder.deploy(motherWallet, admin);

    const ERC20 = await ethers.getContractFactory('MockERC20');
    const erc20 = await ERC20.deploy('ERC20TEST', 'TERC20');

    const provider = ethers.provider;

    return { motherWallet, erc20, admin, user, user2, user3, forwarder, provider };
}

describe('Forwarder', function () {
    it('Should deploy successfully a forwarder contract', async function () {
        const { forwarder } = await loadFixture(setupFixture);
        expect(await forwarder.getAddress()).to.be.properAddress;
    });

    it('Every deposit of native tokens should be transferred to the motherWallet', async function () {
        const { forwarder, motherWallet, user, provider } = await loadFixture(setupFixture);
        expect(await forwarder.parentAddress()).to.equal(motherWallet.address);

        const initialBalance = await provider.getBalance(await motherWallet.getAddress());

        const amount = ethers.parseEther('1');
        const tx = await user.sendTransaction({ to: forwarder.target, value: amount });
        await expect(tx).to.emit(forwarder, 'ForwarderDeposited').withArgs(user.address, amount);
        await tx.wait();
        const finalBalance = await provider.getBalance(await motherWallet.getAddress());
        expect(finalBalance).to.equal(amount + initialBalance);
    });
});
