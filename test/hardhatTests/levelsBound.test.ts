import { expect } from 'chai';
// @ts-ignore-next-line
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { LevelsBound, ERC1155Soulbound } from '../../typechain-types';
import type { AddressLike, BigNumberish } from 'ethers';
import type { NonPayableOverrides } from '../../typechain-types/common';
import { Contract } from 'zksync-ethers';

describe('LevelsBound', function () {
    let levelsBound: LevelsBound;
    let items: ERC1155Soulbound;
    let minterAccount: SignerWithAddress;
    let playerAccount: SignerWithAddress;
    let playerAccount2: SignerWithAddress;

    beforeEach(async function () {
        let levelBoundcontract = (await ethers.getContractFactory('LevelsBound')) as unknown as Contract;
        let itemsBoundContract = (await ethers.getContractFactory('ERC1155Soulbound')) as unknown as Contract;
        const [adminAccount, player, player2] = await ethers.getSigners();
        minterAccount = adminAccount;
        playerAccount = player;
        playerAccount2 = player2;

        itemsBoundContract = await itemsBoundContract.deploy(
            'myItems',
            'mIs',
            'https://app.bueno.art/api/contract/J9SFsPXBW4nXJP-fake/chain/1',
            'uri',
            1,
            false,
            adminAccount.address
        );
        await itemsBoundContract.waitForDeployment();

        const itemAddress = await itemsBoundContract.getAddress();

        levelBoundcontract = await levelBoundcontract.deploy('lvl', 'lvl', adminAccount.address, true, itemAddress);
        await levelBoundcontract.waitForDeployment();

        items = itemsBoundContract as unknown as ERC1155Soulbound;
        levelsBound = levelBoundcontract as unknown as LevelsBound;
    });

    it('As admin I can mint levels for a player', async function () {
        const tx = await levelsBound.adminMintLevel(playerAccount.address, 1);
        await tx.wait();
        const balance = await levelsBound.connect(playerAccount).balanceOf(playerAccount.address, 1);
        expect(balance).to.be.eq(1);
    });

    it(' As admin I can reset the level of a player', async function () {
        const lvlUpTrx = await levelsBound.adminMintLevel(playerAccount.address, 1);
        await lvlUpTrx.wait();
        const tx = await levelsBound.adminBurnLevel(playerAccount.address, 1);
        await tx.wait();
        const balance = await levelsBound.connect(playerAccount).balanceOf(playerAccount.address, 1);
        expect(balance).to.be.eq(0);
    });

    it.skip("The user can't have the same level token twice", async function () {
        const tx = await levelsBound.levelUp(playerAccount.address, 1);
        await tx.wait();
        await expect(levelsBound.levelUp(playerAccount.address, 1)).to.be.revertedWith(
            'Player already has this level token'
        );
    });

    it.skip('Sent the level 0 as new level is not allowed', async function () {
        await expect(levelsBound.levelUp(playerAccount.address, 0)).to.be.revertedWith(
            'New level must be greater than 0'
        );
    });

    it.skip('User only can lvl up once per level, more than once is not allowed', async function () {
        const tx = await levelsBound.levelUp(playerAccount.address, 1);
        await tx.wait();
        await expect(levelsBound.levelUp(playerAccount.address, 3)).to.be.revertedWith(
            'Player does not have the previous level token'
        );
    });

    it.skip('Level down is not allowed', async function () {
        const tx = await levelsBound.levelUp(playerAccount.address, 1);
        await tx.wait();
        await expect(levelsBound.levelUp(playerAccount.address, 3)).to.be.revertedWith(
            'Player does not have the previous level token'
        );
    });

    it.skip('Level up to the level 1 twice is not possible', async function () {
        const tx = await levelsBound.levelUp(playerAccount.address, 1);
        await tx.wait();
        await expect(levelsBound.levelUp(playerAccount.address, 1)).to.be.revertedWith(
            'Player already has this level token'
        );
    });

    it.skip("As user I can't transfer the level tokens", async function () {
        await expect(
            levelsBound
                .connect(playerAccount)
                .safeTransferFrom(playerAccount.address, minterAccount.address, 1, 1, ethers.toUtf8Bytes(''))
        ).to.be.revertedWith("You can't transfer this token");
    });

    it.skip("As user I can't transfer the level tokens using the batch as well", async function () {
        await expect(
            levelsBound
                .connect(playerAccount)
                .safeBatchTransferFrom(playerAccount.address, minterAccount.address, [1], [1], ethers.toUtf8Bytes(''))
        ).to.be.revertedWith("You can't transfer this token");
    });

    it.skip('As user I can burn my level tokens', async function () {
        await levelsBound.levelUp(playerAccount.address, 1);
        const tx = await levelsBound.connect(playerAccount).burn(1, 1);
        await tx.wait();
        const balance = await levelsBound.connect(playerAccount).balanceOf(playerAccount.address, 1);
        expect(balance).to.be.eq(0);
    });

    describe.skip('LevelUp', function () {
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
