import { expect } from 'chai';
// @ts-ignore-next-line
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { SoulBound1155 } from '../typechain-types';
import { SoulBoundBadgesArgs } from '../constants/constructor-args';

const { name, symbol, baseURI, maxPerMint, isPaused, royalty } = SoulBoundBadgesArgs.TESTNET;

describe.only('SoulBound1155', function () {
    let soulBound1155: SoulBound1155;
    let minterAccount: SignerWithAddress;
    let playerAccount: SignerWithAddress;
    let player2Account: SignerWithAddress;
    let player3Account: SignerWithAddress;
    let craftingAccount: SignerWithAddress;
    beforeEach(async function () {
        const contract1 = (await ethers.getContractFactory('SoulBound1155')) as unknown as SoulBound1155;
        const [adminAccount, player, player2, player3, player4] = await ethers.getSigners();
        minterAccount = adminAccount;
        playerAccount = player;
        player2Account = player2;
        player3Account = player3;
        craftingAccount = player4;

        // @ts-ignore-next-line
        soulBound1155 = await contract1.deploy(name, symbol, baseURI, maxPerMint, isPaused, minterAccount.address, royalty);
        await soulBound1155.deployed();
        await soulBound1155.unpause();
    });

    // pause and unpause
    // fail cannot do if not manager role
    // pass if manager role
    describe('Token Exists', () => {
        it('should fail to mint if putting wrong token id and vice versa', async function () {
            expect(await soulBound1155.paused()).to.be.false;
            await soulBound1155.pause();
            expect(await soulBound1155.paused()).to.be.true;

            await expect(soulBound1155.mint(playerAccount.address, 1, 1, true)).to.be.rejectedWith('TokenNotExist()');

            await soulBound1155.unpause();
            await soulBound1155.addNewToken(1);
            expect(await soulBound1155.paused()).to.be.false;

            const tx = await soulBound1155.mint(playerAccount.address, 1, 1, true);
        });
    });

    describe('Pause Mint', () => {
        it('should fail to mint if contract is paused and vice versa', async function () {
            expect(await soulBound1155.paused()).to.be.false;
            await soulBound1155.pause();
            expect(await soulBound1155.paused()).to.be.true;

            await soulBound1155.addNewToken(22);
            await expect(soulBound1155.mint(playerAccount.address, 22, 1, true)).to.be.revertedWith('Pausable: paused');

            await soulBound1155.unpause();
            expect(await soulBound1155.paused()).to.be.false;

            const tx = await soulBound1155.mint(playerAccount.address, 22, 1, true);
        });
    });

    describe('Mint', () => {
        const tokenId = 1;

        it('must bound the token id properly', async function () {
            await soulBound1155.addNewToken(tokenId);
            const tx = await soulBound1155.mint(playerAccount.address, tokenId, 1, true);
            await tx.wait();
            await expect(
                soulBound1155.connect(playerAccount).safeTransferFrom(playerAccount.address, minterAccount.address, tokenId, 1, ethers.utils.toUtf8Bytes(''))
            ).to.be.revertedWith('ERCSoulbound: The amount of soul bounded tokens is equal to the amount of tokens to be transferred');
            await expect(
                soulBound1155.connect(playerAccount).safeTransferFrom(playerAccount.address, minterAccount.address, tokenId, 0, ethers.utils.toUtf8Bytes(''))
            ).to.be.revertedWith("ERCSoulbound: can't be zero amount");
            const tx2 = await soulBound1155.mint(player2Account.address, tokenId, 1, false);
            await tx2.wait();
            const transferTrx = await soulBound1155
                .connect(player2Account)
                .safeTransferFrom(player2Account.address, minterAccount.address, tokenId, 1, ethers.utils.toUtf8Bytes(''));
            await transferTrx.wait();
            expect(await soulBound1155.balanceOf(playerAccount.address, tokenId)).to.be.eq(1);
            expect(await soulBound1155.balanceOf(player2Account.address, tokenId)).to.be.eq(0);
        });

        it('fail if try to mint more than the limit', async function () {
            await soulBound1155.addNewToken(tokenId);

            await expect(soulBound1155.mint(playerAccount.address, tokenId, 2, true)).to.be.rejectedWith('ExceedMaxMint()');
        });

        it('fail if already minted', async function () {
            await soulBound1155.addNewToken(tokenId);
            await soulBound1155.mint(playerAccount.address, tokenId, 1, true);

            await expect(soulBound1155.mint(playerAccount.address, tokenId, 1, true)).to.be.rejectedWith('AlreadyMinted()');
        });

        it('fail if try to mint invalid tokenId', async function () {
            const tokenId = 30;

            await expect(soulBound1155.mint(playerAccount.address, tokenId, 1, true)).to.be.rejectedWith('TokenNotExist()');
        });

        it('fail sender has no minter role', async function () {
            await expect(soulBound1155.connect(playerAccount).mint(playerAccount.address, tokenId, 1, true)).to.be.revertedWith(
                `AccessControl: account ${playerAccount.address.toLowerCase()} is missing role 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6`
            );
        });
    });

    describe('BatchMint', () => {
        it('must bound the token id properly', async function () {
            await soulBound1155.addNewToken(1);
            await soulBound1155.addNewToken(2);
            await soulBound1155.addNewToken(3);

            const tx2 = await soulBound1155.mintBatch(playerAccount.address, [1, 2, 3], [1, 1, 1], false);
            await tx2.wait();
            const transferTrx = await soulBound1155
                .connect(playerAccount)
                .safeBatchTransferFrom(playerAccount.address, minterAccount.address, [1, 2, 3], [1, 1, 1], ethers.utils.toUtf8Bytes(''));
            await transferTrx.wait();
            expect(await soulBound1155.balanceOf(playerAccount.address, 1)).to.be.eq(0);

            const tx = await soulBound1155.mintBatch(player2Account.address, [1, 2, 3], [1, 1, 1], true);
            await tx.wait();

            await expect(
                soulBound1155
                    .connect(player2Account)
                    .safeBatchTransferFrom(player2Account.address, minterAccount.address, [1, 2, 3], [1, 1, 1], ethers.utils.toUtf8Bytes(''))
            ).to.be.revertedWith('ERCSoulbound: The amount of soul bounded tokens is equal to the amount of tokens to be transferred');
        });

        it('fail if try to mint more than the limit', async function () {
            await soulBound1155.addNewToken(1);
            await soulBound1155.addNewToken(2);
            await soulBound1155.addNewToken(3);

            await expect(soulBound1155.mintBatch(playerAccount.address, [1, 2, 3], [100, 200, 300], false)).to.be.rejectedWith('ExceedMaxMint()');
        });

        it('fail if already minted', async function () {
            await soulBound1155.addNewToken(1);
            await soulBound1155.addNewToken(2);
            await soulBound1155.addNewToken(3);

            await soulBound1155.mintBatch(playerAccount.address, [1, 2], [1, 1], true);

            await expect(soulBound1155.mintBatch(playerAccount.address, [1, 2, 3], [1, 1, 1], true)).to.be.rejectedWith('AlreadyMinted()');
        });

        it('fail if try to mint invalid tokenId', async function () {
            await expect(soulBound1155.mintBatch(playerAccount.address, [33, 299], [1, 1], true)).to.be.rejectedWith('TokenNotExist()');
        });

        it('fail sender has no minter role', async function () {
            await expect(soulBound1155.connect(playerAccount).mintBatch(playerAccount.address, [1, 2, 3], [100, 200, 300], false)).to.be.revertedWith(
                `AccessControl: account ${playerAccount.address.toLowerCase()} is missing role 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6`
            );
        });
    });

    it('burn - ERC1155 - must burn tokens correctly', async function () {
        await soulBound1155.addNewToken(1);
        const tx = await soulBound1155.mint(playerAccount.address, 1, 1, true);
        await tx.wait();
        expect(await soulBound1155.balanceOf(playerAccount.address, 1)).to.be.eq(1);

        await expect(
            soulBound1155.connect(playerAccount).safeTransferFrom(playerAccount.address, minterAccount.address, 1, 1, ethers.utils.toUtf8Bytes(''))
        ).to.be.revertedWith('ERCSoulbound: The amount of soul bounded tokens is equal to the amount of tokens to be transferred');

        const burnTrx = await soulBound1155.connect(playerAccount).burn(playerAccount.address, 1, 1);
        await burnTrx.wait();
        expect(await soulBound1155.balanceOf(playerAccount.address, 1)).to.be.eq(0);

        const tx2 = await soulBound1155.mint(player2Account.address, 1, 1, false);
        await tx2.wait();

        const trx3 = await soulBound1155
            .connect(player2Account)
            .safeTransferFrom(player2Account.address, player3Account.address, 1, 1, ethers.utils.toUtf8Bytes(''));
        await trx3.wait();

        expect(await soulBound1155.balanceOf(player3Account.address, 1)).to.be.eq(1);

        const burnTrx2 = await soulBound1155.connect(player3Account).burn(player3Account.address, 1, 1);
        await burnTrx2.wait();

        expect(await soulBound1155.balanceOf(player3Account.address, 1)).to.be.eq(0);
    });

    describe('Token URI', () => {
        it('Get Uri() should fail if tokenId not exists', async function () {
            const tokenId = 1;
            await expect(soulBound1155.uri(tokenId)).to.be.rejectedWith('TokenNotExist()');
        });

        it('Get Uri() should return tokenUri if tokenId exists', async function () {
            const tokenId = 1;
            await soulBound1155.addNewToken(tokenId);
            const tokenUri = await soulBound1155.uri(tokenId);
            expect(tokenUri).to.be.eq(`${baseURI}${tokenId}`);
        });

        it('updateBaseUri() should fail to update new baseuri if has no manager role', async function () {
            const newBaseURI = 'https://something-new.com/';

            await expect(soulBound1155.connect(playerAccount).updateBaseUri(newBaseURI)).to.be.revertedWith(
                `AccessControl: account ${playerAccount.address.toLowerCase()} is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08`
            );
        });

        it('updateBaseUri() should pass to update new baseuri if has manager role', async function () {
            const newBaseURI = 'https://something-new.com/';
            const tokenId = 1;

            await soulBound1155.addNewToken(tokenId);
            expect(await soulBound1155.uri(tokenId)).to.be.eq(`${baseURI}${tokenId}`);

            await soulBound1155.updateBaseUri(newBaseURI);
            expect(await soulBound1155.uri(tokenId)).to.be.eq(`${newBaseURI}${tokenId}`);
        });
    });

    describe.only('Token Transfer', () => {
        const tokenId = 1;
        it('should able to transfer non-soulbound token', async function () {
            await soulBound1155.addNewToken(tokenId);
            await soulBound1155.mint(player2Account.address, tokenId, 1, false);
            const transferTrx = await soulBound1155
                .connect(player2Account)
                .safeTransferFrom(player2Account.address, minterAccount.address, tokenId, 1, ethers.utils.toUtf8Bytes(''));
            await transferTrx.wait();
            expect(await soulBound1155.balanceOf(player2Account.address, tokenId)).to.be.eq(0);
            expect(await soulBound1155.balanceOf(minterAccount.address, tokenId)).to.be.eq(1);
        });

        it('should not able to transfer soulbound token', async function () {
            await soulBound1155.addNewToken(tokenId);
            const tx = await soulBound1155.mint(playerAccount.address, tokenId, 1, true);
            await tx.wait();
            await expect(
                soulBound1155.connect(playerAccount).safeTransferFrom(playerAccount.address, minterAccount.address, tokenId, 1, ethers.utils.toUtf8Bytes(''))
            ).to.be.revertedWith('ERCSoulbound: The amount of soul bounded tokens is equal to the amount of tokens to be transferred');
            await expect(
                soulBound1155.connect(playerAccount).safeTransferFrom(playerAccount.address, minterAccount.address, tokenId, 0, ethers.utils.toUtf8Bytes(''))
            ).to.be.revertedWith("ERCSoulbound: can't be zero amount");
        });

        it('should only transfer to/from whitelist address only', async function () {
            await soulBound1155.addNewToken(tokenId);
            const tx = await soulBound1155.mint(playerAccount.address, tokenId, 1, true);
            await tx.wait();
            await expect(
                soulBound1155.connect(playerAccount).safeTransferFrom(playerAccount.address, craftingAccount.address, tokenId, 1, ethers.utils.toUtf8Bytes(''))
            ).to.be.revertedWith('ERCSoulbound: The amount of soul bounded tokens is equal to the amount of tokens to be transferred');

            await soulBound1155.updateWhitelistAddress(craftingAccount.address, true);

            await soulBound1155
                .connect(playerAccount)
                .safeTransferFrom(playerAccount.address, craftingAccount.address, tokenId, 1, ethers.utils.toUtf8Bytes(''));

            await soulBound1155
                .connect(craftingAccount)
                .safeTransferFrom(craftingAccount.address, playerAccount.address, tokenId, 1, ethers.utils.toUtf8Bytes(''));

            await soulBound1155.updateWhitelistAddress(craftingAccount.address, false);

            await expect(
                soulBound1155.connect(playerAccount).safeTransferFrom(playerAccount.address, craftingAccount.address, tokenId, 1, ethers.utils.toUtf8Bytes(''))
            ).to.be.revertedWith('ERCSoulbound: The amount of soul bounded tokens is equal to the amount of tokens to be transferred');
        });
    });

    describe('Token Royalty', () => {
        const mintPrice = ethers.utils.parseEther('1');
        let expectedRoyalty = ethers.utils.parseEther('1').mul(royalty).div(10000);
        // default royalty on deploy
        it('should have default royalty on deploy', async function () {
            const [receiver, royaltyAmount] = await soulBound1155.royaltyInfo(0, mintPrice);
            expect(receiver).to.be.eq(minterAccount.address);
            expect(royaltyAmount).to.be.eq(expectedRoyalty);
        });

        it('Manager role should be able to update royalty', async function () {
            expectedRoyalty = ethers.utils.parseEther('1').mul(300).div(10000);
            await soulBound1155.setRoyaltyInfo(playerAccount.address, 300);

            const [receiver, royaltyAmount] = await soulBound1155.royaltyInfo(0, mintPrice);
            expect(receiver).to.be.eq(playerAccount.address);
            expect(royaltyAmount).to.be.eq(expectedRoyalty);
        });
    });
});
