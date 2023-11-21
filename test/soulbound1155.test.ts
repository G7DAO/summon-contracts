import { expect } from 'chai';
// @ts-ignore-next-line
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Soulbound1155 } from '../typechain-types';
import { SoulboundBadgesArgs } from '../constants/constructor-args';
import { generateSignature } from '../helpers/signature';

const { name, symbol, baseURI, maxPerMint, isPaused, royalty } = SoulboundBadgesArgs.TESTNET;

describe('Soulbound1155', function () {
    let soulbound1155: Soulbound1155;
    let minterAccount: SignerWithAddress;
    let playerAccount: SignerWithAddress;
    let player2Account: SignerWithAddress;
    let player3Account: SignerWithAddress;
    let craftingAccount: SignerWithAddress;
    let nonce: number;
    let signature: string;
    let nonce2: number;
    let signature2: string;
    beforeEach(async function () {
        const contract1 = (await ethers.getContractFactory('Soulbound1155')) as unknown as Soulbound1155;
        const [adminAccount, player, player2, player3, player4] = await ethers.getSigners();
        minterAccount = adminAccount;
        playerAccount = player;
        player2Account = player2;
        player3Account = player3;
        craftingAccount = player4;

        // @ts-ignore-next-line
        soulbound1155 = await contract1.deploy(name, symbol, baseURI, maxPerMint, isPaused, minterAccount.address, royalty);
        await soulbound1155.deployed();
        await soulbound1155.unpause();

        ({ nonce, signature } = await generateSignature({ walletAddress: playerAccount.address, signer: minterAccount }));
        ({ nonce: nonce2, signature: signature2 } = await generateSignature({ walletAddress: player2Account.address, signer: minterAccount }));
    });

    // pause and unpause
    // fail cannot do if not manager role
    // pass if manager role
    describe('Token Exists', () => {
        it('should fail to mint if putting wrong token id and vice versa', async function () {
            expect(await soulbound1155.paused()).to.be.false;
            await soulbound1155.pause();
            expect(await soulbound1155.paused()).to.be.true;

            await expect(soulbound1155.connect(playerAccount).mint(1, 1, true, nonce, signature)).to.be.rejectedWith('TokenNotExist()');

            await soulbound1155.unpause();
            await soulbound1155.addNewToken(1);
            expect(await soulbound1155.paused()).to.be.false;

            const tx = await soulbound1155.connect(playerAccount).mint(1, 1, true, nonce, signature);
        });
    });

    describe('Pause Mint', () => {
        it('should fail to mint if contract is paused and vice versa', async function () {
            expect(await soulbound1155.paused()).to.be.false;
            await soulbound1155.pause();
            expect(await soulbound1155.paused()).to.be.true;

            await soulbound1155.addNewToken(22);
            await expect(soulbound1155.connect(playerAccount).mint(22, 1, true, nonce, signature)).to.be.revertedWith('Pausable: paused');

            await soulbound1155.unpause();
            expect(await soulbound1155.paused()).to.be.false;

            const tx = await soulbound1155.connect(playerAccount).mint(22, 1, true, nonce, signature);
        });
    });

    describe('Verify Signature', () => {
        it('should fail when try to use invalid signature', async function () {
            const tokenId = 1;
            await soulbound1155.addNewToken(tokenId);
            await expect(soulbound1155.connect(playerAccount).mint(tokenId, 1, true, nonce, signature2)).to.be.rejectedWith('InvalidSignature');
        });

        it('should fail when try to reuse used signature with mint()', async function () {
            const tokenId = 1;
            await soulbound1155.addNewToken(tokenId);
            await soulbound1155.addNewToken(2);

            await soulbound1155.connect(playerAccount).mint(tokenId, 1, true, nonce, signature);

            expect(await soulbound1155.usedSignatures(signature)).to.be.true;

            await expect(soulbound1155.connect(playerAccount).mint(1, 1, true, nonce, signature)).to.be.rejectedWith('AlreadyUsedSignature');
        });

        it('should fail when try to reuse used signature with mintBatch()', async function () {
            await soulbound1155.addNewToken(1);
            await soulbound1155.addNewToken(2);
            await soulbound1155.addNewToken(3);

            await soulbound1155.connect(playerAccount).mintBatch([1, 2, 3], [1, 1, 1], true, nonce, signature);

            expect(await soulbound1155.usedSignatures(signature)).to.be.true;
            await expect(soulbound1155.connect(playerAccount).mintBatch([1, 2, 3], [1, 1, 1], true, nonce, signature)).to.be.rejectedWith(
                'AlreadyUsedSignature'
            );
        });
    });

    describe('Mint', () => {
        const tokenId = 1;

        it('must bound the token id properly', async function () {
            await soulbound1155.addNewToken(tokenId);
            const tx = await soulbound1155.connect(playerAccount).mint(tokenId, 1, true, nonce, signature);
            await tx.wait();
            await expect(
                soulbound1155.connect(playerAccount).safeTransferFrom(playerAccount.address, minterAccount.address, tokenId, 1, ethers.utils.toUtf8Bytes(''))
            ).to.be.revertedWith('ERCSoulbound: The amount of soulbounded tokens is equal to the amount of tokens to be transferred');
            await expect(
                soulbound1155.connect(playerAccount).safeTransferFrom(playerAccount.address, minterAccount.address, tokenId, 0, ethers.utils.toUtf8Bytes(''))
            ).to.be.revertedWith("ERCSoulbound: can't be zero amount");

            const tx2 = await soulbound1155.connect(player2Account).mint(tokenId, 1, false, nonce2, signature2);
            await tx2.wait();
            const transferTrx = await soulbound1155
                .connect(player2Account)
                .safeTransferFrom(player2Account.address, minterAccount.address, tokenId, 1, ethers.utils.toUtf8Bytes(''));
            await transferTrx.wait();
            expect(await soulbound1155.balanceOf(playerAccount.address, tokenId)).to.be.eq(1);
            expect(await soulbound1155.balanceOf(player2Account.address, tokenId)).to.be.eq(0);
        });

        it('fail if try to mint more than the limit', async function () {
            await soulbound1155.addNewToken(tokenId);

            await expect(soulbound1155.connect(playerAccount).mint(tokenId, 2, true, nonce, signature)).to.be.rejectedWith('ExceedMaxMint()');
        });

        it('fail if already minted', async function () {
            await soulbound1155.addNewToken(tokenId);
            await soulbound1155.connect(playerAccount).mint(tokenId, 1, true, nonce, signature);

            const { nonce: newNonce, signature: newSignature } = await generateSignature({ walletAddress: playerAccount.address, signer: minterAccount });
            await expect(soulbound1155.connect(playerAccount).mint(tokenId, 1, true, newNonce, newSignature)).to.be.rejectedWith('AlreadyMinted()');
        });

        it('fail if try to mint invalid tokenId', async function () {
            const tokenId = 30;

            await expect(soulbound1155.connect(playerAccount).mint(tokenId, 1, true, nonce, signature)).to.be.rejectedWith('TokenNotExist()');
        });

        it('fail sender has no minter role', async function () {
            await expect(soulbound1155.connect(playerAccount).adminMint(playerAccount.address, tokenId, 1, true)).to.be.revertedWith(
                `AccessControl: account ${playerAccount.address.toLowerCase()} is missing role 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6`
            );
        });

        it('adminMint should pass', async function () {
            await soulbound1155.addNewToken(tokenId);
            await soulbound1155.adminMint(playerAccount.address, tokenId, 1, true);
        });
    });

    describe('BatchMint', () => {
        it('must bound the token id properly', async function () {
            await soulbound1155.addNewToken(1);
            await soulbound1155.addNewToken(2);
            await soulbound1155.addNewToken(3);

            const tx2 = await soulbound1155.connect(playerAccount).mintBatch([1, 2, 3], [1, 1, 1], false, nonce, signature);
            await tx2.wait();
            const transferTrx = await soulbound1155
                .connect(playerAccount)
                .safeBatchTransferFrom(playerAccount.address, minterAccount.address, [1, 2, 3], [1, 1, 1], ethers.utils.toUtf8Bytes(''));
            await transferTrx.wait();
            expect(await soulbound1155.balanceOf(playerAccount.address, 1)).to.be.eq(0);

            const tx = await soulbound1155.connect(player2Account).mintBatch([1, 2, 3], [1, 1, 1], true, nonce2, signature2);
            await tx.wait();

            await expect(
                soulbound1155
                    .connect(player2Account)
                    .safeBatchTransferFrom(player2Account.address, minterAccount.address, [1, 2, 3], [1, 1, 1], ethers.utils.toUtf8Bytes(''))
            ).to.be.revertedWith('ERCSoulbound: The amount of soulbounded tokens is equal to the amount of tokens to be transferred');
        });

        it('fail if try to mint more than the limit', async function () {
            await soulbound1155.addNewToken(1);
            await soulbound1155.addNewToken(2);
            await soulbound1155.addNewToken(3);

            await expect(soulbound1155.connect(playerAccount).mintBatch([1, 2, 3], [100, 200, 300], false, nonce, signature)).to.be.rejectedWith(
                'ExceedMaxMint()'
            );
        });

        it('fail if already minted', async function () {
            await soulbound1155.addNewToken(1);
            await soulbound1155.addNewToken(2);
            await soulbound1155.addNewToken(3);

            await soulbound1155.connect(playerAccount).mintBatch([1, 2], [1, 1], true, nonce, signature);

            const { nonce: newNonce, signature: newSignature } = await generateSignature({ walletAddress: playerAccount.address, signer: minterAccount });

            await expect(soulbound1155.connect(playerAccount).mintBatch([1, 2, 3], [1, 1, 1], true, newNonce, newSignature)).to.be.rejectedWith(
                'AlreadyMinted()'
            );
        });

        it('fail if try to mint invalid tokenId', async function () {
            await expect(soulbound1155.connect(playerAccount).mintBatch([33, 299], [1, 1], true, nonce, signature)).to.be.rejectedWith('TokenNotExist()');
        });

        it('fail sender has no minter role', async function () {
            await expect(soulbound1155.connect(playerAccount).adminMintBatch(playerAccount.address, [1, 2, 3], [100, 200, 300], false)).to.be.revertedWith(
                `AccessControl: account ${playerAccount.address.toLowerCase()} is missing role 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6`
            );
        });

        it('adminMintBatch should pass', async function () {
            await soulbound1155.addNewToken(111);
            await soulbound1155.addNewToken(222);
            await soulbound1155.addNewToken(333);
            await soulbound1155.adminMintBatch(playerAccount.address, [111, 222, 333], [1, 1, 1], false);
        });
    });

    it('burn - ERC1155 - must burn tokens correctly', async function () {
        await soulbound1155.addNewToken(1);
        const tx = await soulbound1155.connect(playerAccount).mint(1, 1, true, nonce, signature);
        await tx.wait();
        expect(await soulbound1155.balanceOf(playerAccount.address, 1)).to.be.eq(1);

        await expect(
            soulbound1155.connect(playerAccount).safeTransferFrom(playerAccount.address, minterAccount.address, 1, 1, ethers.utils.toUtf8Bytes(''))
        ).to.be.revertedWith('ERCSoulbound: The amount of soulbounded tokens is equal to the amount of tokens to be transferred');

        const burnTrx = await soulbound1155.connect(playerAccount).burn(playerAccount.address, 1, 1);
        await burnTrx.wait();
        expect(await soulbound1155.balanceOf(playerAccount.address, 1)).to.be.eq(0);

        const tx2 = await soulbound1155.connect(player2Account).mint(1, 1, false, nonce2, signature2);
        await tx2.wait();

        const trx3 = await soulbound1155
            .connect(player2Account)
            .safeTransferFrom(player2Account.address, player3Account.address, 1, 1, ethers.utils.toUtf8Bytes(''));
        await trx3.wait();

        expect(await soulbound1155.balanceOf(player3Account.address, 1)).to.be.eq(1);

        const burnTrx2 = await soulbound1155.connect(player3Account).burn(player3Account.address, 1, 1);
        await burnTrx2.wait();

        expect(await soulbound1155.balanceOf(player3Account.address, 1)).to.be.eq(0);
    });

    describe('Token URI', () => {
        it('Get Uri() should fail if tokenId not exists', async function () {
            const tokenId = 1;
            await expect(soulbound1155.uri(tokenId)).to.be.rejectedWith('TokenNotExist()');
        });

        it('Get Uri() should return tokenUri if tokenId exists', async function () {
            const tokenId = 1;
            await soulbound1155.addNewToken(tokenId);
            const tokenUri = await soulbound1155.uri(tokenId);
            expect(tokenUri).to.be.eq(`${baseURI}${tokenId}`);
        });

        it('updateBaseUri() should fail to update new baseuri if has no manager role', async function () {
            const newBaseURI = 'https://something-new.com/';

            await expect(soulbound1155.connect(playerAccount).updateBaseUri(newBaseURI)).to.be.revertedWith(
                `AccessControl: account ${playerAccount.address.toLowerCase()} is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08`
            );
        });

        it('updateBaseUri() should pass to update new baseuri if has manager role', async function () {
            const newBaseURI = 'https://something-new.com/';
            const tokenId = 1;

            await soulbound1155.addNewToken(tokenId);
            expect(await soulbound1155.uri(tokenId)).to.be.eq(`${baseURI}${tokenId}`);

            await soulbound1155.updateBaseUri(newBaseURI);
            expect(await soulbound1155.uri(tokenId)).to.be.eq(`${newBaseURI}${tokenId}`);
        });
    });

    describe('Token Transfer', () => {
        const tokenId = 1;
        it('should able to transfer non-soulbound token', async function () {
            await soulbound1155.addNewToken(tokenId);
            await soulbound1155.connect(player2Account).mint(tokenId, 1, false, nonce2, signature2);
            const transferTrx = await soulbound1155
                .connect(player2Account)
                .safeTransferFrom(player2Account.address, minterAccount.address, tokenId, 1, ethers.utils.toUtf8Bytes(''));
            await transferTrx.wait();
            expect(await soulbound1155.balanceOf(player2Account.address, tokenId)).to.be.eq(0);
            expect(await soulbound1155.balanceOf(minterAccount.address, tokenId)).to.be.eq(1);
        });

        it('should not able to transfer soulbound token', async function () {
            await soulbound1155.addNewToken(tokenId);
            const tx = await soulbound1155.connect(playerAccount).mint(tokenId, 1, true, nonce, signature);
            await tx.wait();
            await expect(
                soulbound1155.connect(playerAccount).safeTransferFrom(playerAccount.address, minterAccount.address, tokenId, 1, ethers.utils.toUtf8Bytes(''))
            ).to.be.revertedWith('ERCSoulbound: The amount of soulbounded tokens is equal to the amount of tokens to be transferred');
            await expect(
                soulbound1155.connect(playerAccount).safeTransferFrom(playerAccount.address, minterAccount.address, tokenId, 0, ethers.utils.toUtf8Bytes(''))
            ).to.be.revertedWith("ERCSoulbound: can't be zero amount");
        });

        it('should only transfer to/from whitelist address only', async function () {
            await soulbound1155.addNewToken(tokenId);
            const tx = await soulbound1155.connect(playerAccount).mint(tokenId, 1, true, nonce, signature);
            await tx.wait();
            await expect(
                soulbound1155.connect(playerAccount).safeTransferFrom(playerAccount.address, craftingAccount.address, tokenId, 1, ethers.utils.toUtf8Bytes(''))
            ).to.be.revertedWith('ERCSoulbound: The amount of soulbounded tokens is equal to the amount of tokens to be transferred');

            await soulbound1155.updateWhitelistAddress(craftingAccount.address, true);

            await soulbound1155
                .connect(playerAccount)
                .safeTransferFrom(playerAccount.address, craftingAccount.address, tokenId, 1, ethers.utils.toUtf8Bytes(''));

            await soulbound1155
                .connect(craftingAccount)
                .safeTransferFrom(craftingAccount.address, playerAccount.address, tokenId, 1, ethers.utils.toUtf8Bytes(''));

            await soulbound1155.updateWhitelistAddress(craftingAccount.address, false);

            await expect(
                soulbound1155.connect(playerAccount).safeTransferFrom(playerAccount.address, craftingAccount.address, tokenId, 1, ethers.utils.toUtf8Bytes(''))
            ).to.be.revertedWith('ERCSoulbound: The amount of soulbounded tokens is equal to the amount of tokens to be transferred');
        });
    });

    describe('Token Royalty', () => {
        const mintPrice = ethers.utils.parseEther('1');
        let expectedRoyalty = ethers.utils.parseEther('1').mul(royalty).div(10000);
        // default royalty on deploy
        it('should have default royalty on deploy', async function () {
            const [receiver, royaltyAmount] = await soulbound1155.royaltyInfo(0, mintPrice);
            expect(receiver).to.be.eq(minterAccount.address);
            expect(royaltyAmount).to.be.eq(expectedRoyalty);
        });

        it('Manager role should be able to update royalty', async function () {
            expectedRoyalty = ethers.utils.parseEther('1').mul(300).div(10000);
            await soulbound1155.setRoyaltyInfo(playerAccount.address, 300);

            const [receiver, royaltyAmount] = await soulbound1155.royaltyInfo(0, mintPrice);
            expect(receiver).to.be.eq(playerAccount.address);
            expect(royaltyAmount).to.be.eq(expectedRoyalty);
        });
    });
});