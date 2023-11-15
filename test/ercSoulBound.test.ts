import { expect } from 'chai';
// @ts-ignore-next-line
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Mock1155SoulBound, Mock721SoulBound } from '../typechain-types';

describe('MockSoulBound', function () {
    let mockSoul1155Bound: Mock1155SoulBound;
    let mockSoul721Bound: Mock721SoulBound;
    let minterAccount: SignerWithAddress;
    let playerAccount: SignerWithAddress;
    beforeEach(async function () {
        const contract1 = (await ethers.getContractFactory('Mock1155SoulBound')) as unknown as Mock1155SoulBound;
        const contract2 = (await ethers.getContractFactory('Mock721SoulBound')) as unknown as Mock721SoulBound;
        const [adminAccount, player] = await ethers.getSigners();
        minterAccount = adminAccount;
        playerAccount = player;
        // @ts-ignore-next-line
        mockSoul1155Bound = await contract1.deploy();
        await mockSoul1155Bound.deployed();

        // @ts-ignore-next-line
        mockSoul721Bound = await contract2.deploy();
        await mockSoul721Bound.deployed();
    });

    it('_soulBoundToken - ERC721 - must bound the token id properly', async function () {
        const tx = await mockSoul721Bound.mint(playerAccount.address);
        await tx.wait();
        expect(await mockSoul721Bound.ownerOf(0)).to.be.eq(playerAccount.address);
        await expect(mockSoul721Bound.connect(playerAccount).transferFrom(playerAccount.address, minterAccount.address, 0)).to.be.revertedWith(
            'ERCSoulbound: This token is soulbounded'
        );

        const tx2 = await mockSoul721Bound.mint(minterAccount.address);
        await tx2.wait();
        expect(await mockSoul721Bound.ownerOf(1)).to.be.eq(minterAccount.address);
        await expect(mockSoul721Bound.transferFrom(minterAccount.address, playerAccount.address, 1)).to.be.revertedWith(
            'ERCSoulbound: This token is soulbounded'
        );
    });

    it('_soulBoundToken - ERC721 - must bound the token id properly - safeTransferFrom', async function () {
        const tx = await mockSoul721Bound.mint(playerAccount.address);
        await tx.wait();
        const approveTrx = await mockSoul721Bound.connect(playerAccount).setApprovalForAll(minterAccount.address, true);
        await approveTrx.wait();
        await expect(
            mockSoul721Bound.connect(playerAccount)['safeTransferFrom(address,address,uint256)'](playerAccount.address, minterAccount.address, 0)
        ).to.be.revertedWith('ERCSoulbound: This token is soulbounded');
    });

    it('_soulBound - ERC1155 - must bound the token id properly', async function () {
        const tx = await mockSoul1155Bound.mint(playerAccount.address, 1, 1, true);
        await tx.wait();
        await expect(
            mockSoul1155Bound.connect(playerAccount).safeTransferFrom(playerAccount.address, minterAccount.address, 1, 1, ethers.utils.toUtf8Bytes(''))
        ).to.be.revertedWith('ERCSoulbound: The amount of soulbounded tokens is equal to the amount of tokens to be transferred');
        await expect(
            mockSoul1155Bound.connect(playerAccount).safeTransferFrom(playerAccount.address, minterAccount.address, 1, 0, ethers.utils.toUtf8Bytes(''))
        ).to.be.revertedWith("ERCSoulbound: can't be zero amount");
        const tx2 = await mockSoul1155Bound.mint(playerAccount.address, 1, 5, false);
        await tx2.wait();
        const transferTrx = await mockSoul1155Bound
            .connect(playerAccount)
            .safeTransferFrom(playerAccount.address, minterAccount.address, 1, 5, ethers.utils.toUtf8Bytes(''));
        await transferTrx.wait();
        expect(await mockSoul1155Bound.balanceOf(playerAccount.address, 1)).to.be.eq(1);
    });

    it('_batchSoulBound - ERC1155 - must bound the token id properly', async function () {
        const tx2 = await mockSoul1155Bound.mintBatch(playerAccount.address, [1, 2, 3], [100, 200, 300], false);
        await tx2.wait();
        const transferTrx = await mockSoul1155Bound
            .connect(playerAccount)
            .safeBatchTransferFrom(playerAccount.address, minterAccount.address, [1, 2, 3], [1, 2, 3], ethers.utils.toUtf8Bytes(''));
        await transferTrx.wait();

        expect(await mockSoul1155Bound.balanceOf(playerAccount.address, 1)).to.be.eq(99);

        const tx = await mockSoul1155Bound.mintBatch(playerAccount.address, [1, 2, 3], [2, 5, 19], true);
        await tx.wait();

        await expect(
            mockSoul1155Bound
                .connect(playerAccount)
                .safeBatchTransferFrom(playerAccount.address, minterAccount.address, [1, 2, 3], [1, 2, 3], ethers.utils.toUtf8Bytes(''))
        ).to.be.revertedWith('ERCSoulbound: The amount of soulbounded tokens is more than the amount of tokens to be transferred');
    });

    it('burn - ERC1155 - must burn/sync tokens correctly', async function () {
        const tx = await mockSoul1155Bound.mint(playerAccount.address, 1, 5, true);
        await tx.wait();
        expect(await mockSoul1155Bound.balanceOf(playerAccount.address, 1)).to.be.eq(5);

        const burnTrx = await mockSoul1155Bound.connect(playerAccount).burn(playerAccount.address, 1, 1);
        await burnTrx.wait();
        expect(await mockSoul1155Bound.balanceOf(playerAccount.address, 1)).to.be.eq(4);

        const tx2 = await mockSoul1155Bound.mint(playerAccount.address, 1, 1, false);
        await tx2.wait();

        await expect(
            mockSoul1155Bound.connect(playerAccount).safeTransferFrom(playerAccount.address, minterAccount.address, 1, 4, ethers.utils.toUtf8Bytes(''))
        ).to.be.revertedWith('ERCSoulbound: The amount of soulbounded tokens is equal to the amount of tokens to be transferred');

        const burnTrx2 = await mockSoul1155Bound.connect(playerAccount).burn(playerAccount.address, 1, 4);
        await burnTrx2.wait();

        expect(await mockSoul1155Bound.balanceOf(playerAccount.address, 1)).to.be.eq(1);

        const trx3 = await mockSoul1155Bound
            .connect(playerAccount)
            .safeTransferFrom(playerAccount.address, minterAccount.address, 1, 1, ethers.utils.toUtf8Bytes(''));
        await trx3.wait();

        expect(await mockSoul1155Bound.balanceOf(playerAccount.address, 1)).to.be.eq(0);
    });
});
