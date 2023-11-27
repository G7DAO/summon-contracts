import { expect } from 'chai';
// @ts-ignore-next-line
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { LevelsBound } from '../typechain-types';

describe('LevelsBound', function () {
    let levelsBound: LevelsBound;
    let minterAccount: SignerWithAddress;
    let playerAccount: SignerWithAddress;
    let playerAccount2: SignerWithAddress;
    beforeEach(async function () {
        const contract = (await ethers.getContractFactory('LevelsBound')) as unknown as LevelsBound;
        const [adminAccount, player, player2] = await ethers.getSigners();
        minterAccount = adminAccount;
        playerAccount = player;
        playerAccount2 = player2;
        // @ts-ignore-next-line
        levelsBound = await contract.deploy(adminAccount.address);
        await levelsBound.waitForDeployment();
    });

    it('As admin I can mint levels for a player', async function () {
        const tx = await levelsBound.levelUp(playerAccount.address, 1);
        await tx.wait();
        const balance = await levelsBound.connect(playerAccount).balanceOf(playerAccount.address, 1);
        expect(balance).to.be.eq(1);
    });

    it("As user I can't mint levels for a player", async function () {
        await expect(levelsBound.connect(playerAccount).levelUp(playerAccount.address, 1)).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it("The user can't have the same level token twice", async function () {
        const tx = await levelsBound.levelUp(playerAccount.address, 1);
        await tx.wait();
        await expect(levelsBound.levelUp(playerAccount.address, 1)).to.be.revertedWith('Player already has this level token');
    });

    it('Sent the level 0 as new level is not allowed', async function () {
        await expect(levelsBound.levelUp(playerAccount.address, 0)).to.be.revertedWith('New level must be greater than 0');
    });

    it('User only can lvl up once per level, more than once is not allowed', async function () {
        const tx = await levelsBound.levelUp(playerAccount.address, 1);
        await tx.wait();
        await expect(levelsBound.levelUp(playerAccount.address, 3)).to.be.revertedWith('Player does not have the previous level token');
    });

    it('Level down is not allowed', async function () {
        const tx = await levelsBound.levelUp(playerAccount.address, 1);
        await tx.wait();
        await expect(levelsBound.levelUp(playerAccount.address, 3)).to.be.revertedWith('Player does not have the previous level token');
    });

    it('Level up to the level 1 twice is not possible', async function () {
        const tx = await levelsBound.levelUp(playerAccount.address, 1);
        await tx.wait();
        await expect(levelsBound.levelUp(playerAccount.address, 1)).to.be.revertedWith('Player already has this level token');
    });

    it("As user I can't transfer the level tokens", async function () {
        await expect(
            levelsBound.connect(playerAccount).safeTransferFrom(playerAccount.address, minterAccount.address, 1, 1, ethers.toUtf8Bytes(''))
        ).to.be.revertedWith("You can't transfer this token");
    });

    it("As user I can't transfer the level tokens using the batch as well", async function () {
        await expect(
            levelsBound.connect(playerAccount).safeBatchTransferFrom(playerAccount.address, minterAccount.address, [1], [1], ethers.toUtf8Bytes(''))
        ).to.be.revertedWith("You can't transfer this token");
    });

    it('As user I can burn my level tokens', async function () {
        await levelsBound.levelUp(playerAccount.address, 1);
        const tx = await levelsBound.connect(playerAccount).burn(1, 1);
        await tx.wait();
        const balance = await levelsBound.connect(playerAccount).balanceOf(playerAccount.address, 1);
        expect(balance).to.be.eq(0);
    });

    describe('LevelUp', function () {
        it('playerLevel should increase when mintLevel()', async function () {
            expect(await levelsBound.playerLevel(playerAccount.address)).to.be.eq(0);
            await levelsBound.levelUp(playerAccount.address, 1);
            await levelsBound.levelUp(playerAccount.address, 2);
            await levelsBound.levelUp(playerAccount2.address, 1);
            expect(await levelsBound.playerLevel(playerAccount.address)).to.be.eq(2);
            expect(await levelsBound.playerLevel(playerAccount2.address)).to.be.eq(1);
        });

        it('playerLevel should reset to 0 when burn() or burnBatch()', async function () {
            expect(await levelsBound.getCurrentLevel(playerAccount.address)).to.be.eq(0);
            await levelsBound.levelUp(playerAccount.address, 1);
            await levelsBound.levelUp(playerAccount.address, 2);
            expect(await levelsBound.getCurrentLevel(playerAccount.address)).to.be.eq(2);
            expect(await levelsBound.balanceOf(playerAccount.address, 1)).to.be.eq(0);
            expect(await levelsBound.balanceOf(playerAccount.address, 2)).to.be.eq(1);
            await levelsBound.connect(playerAccount).burn(2, 1);
            expect(await levelsBound.getCurrentLevel(playerAccount.address)).to.be.eq(0);

            await levelsBound.levelUp(playerAccount2.address, 1);
            expect(await levelsBound.getCurrentLevel(playerAccount2.address)).to.be.eq(1);

            await levelsBound.connect(playerAccount2).burnBatch([1], [1]);
            expect(await levelsBound.getCurrentLevel(playerAccount2.address)).to.be.eq(0);
        });
    });
});
