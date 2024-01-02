import { expect } from 'chai';
// @ts-ignore-next-line
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { GameSummary } from '../../typechain-types';
import { generateSignature } from '../../helpers/signature';
import { hashIds } from '../../helpers/hashing';
import { log } from 'debug';

describe('GameSummary', function () {
    let GameSummary: GameSummary;
    let minterAccount: SignerWithAddress;
    let playerAccount: SignerWithAddress;
    const DEFAULT_GAME_ID = 11;
    const DEFAULT_STORE_ID = 22;
    const DEFAULT_TOKEN_ID = hashIds(DEFAULT_STORE_ID, DEFAULT_GAME_ID);
    const defaultBaseURI = 'https://summon.mypinata.cloud/ipfs/';
    let defaultCommonGameSummary: GameSummary.GameSummaryStruct;
    beforeEach(async function () {
        const contract = (await ethers.getContractFactory('GameSummary')) as unknown as GameSummary;
        const [adminAccount, player] = await ethers.getSigners();
        minterAccount = adminAccount;
        playerAccount = player;
        // @ts-ignore-next-line
        GameSummary = await contract.deploy(defaultBaseURI);
        await GameSummary.waitForDeployment();
        const minterRole = await GameSummary.MINTER_ROLE();
        const gameCreatorRole = await GameSummary.GAME_CREATOR_ROLE();
        await GameSummary.grantRole(minterRole, minterAccount.address);
        await GameSummary.grantRole(gameCreatorRole, minterAccount.address);
        await (
            await GameSummary.createCommonGameSummary(
                DEFAULT_STORE_ID,
                DEFAULT_GAME_ID,
                'GameTest1234',
                'test://on_chain_uri',
                'external_uri',
                500
            )
        ).wait();

        defaultCommonGameSummary = await GameSummary.getGameSummary(DEFAULT_TOKEN_ID);
    });

    it('As Player must mint game summary achievement', async function () {
        const { signature, nonce } = await generateSignature({
            walletAddress: playerAccount.address,
            signer: minterAccount,
        });
        const whitelistTx = await GameSummary.setSigner(minterAccount.address);
        await whitelistTx.wait();
        const randomAchievementIds = ['100_KILLS_WITH_AWP', 'WEAPON_MASTER', 'X_ACHIEVEMENT'];
        const tx = await GameSummary.connect(playerAccount).mintGameSummaryWithSignature(
            DEFAULT_GAME_ID,
            randomAchievementIds.length,
            DEFAULT_STORE_ID,
            nonce,
            signature
        );
        await tx.wait();
        const tokenId = await GameSummary.getTokenId(DEFAULT_STORE_ID, DEFAULT_GAME_ID);
        const balance = await GameSummary.balanceOf(playerAccount.address, tokenId.toString());
        expect(Number(balance)).to.equal(1);
    });

    it('As Admin must mint a game summary for a player', async function () {
        const randomAchievementIds = [1234, 65441, 12312];
        const tx = await GameSummary.adminMintGameSummary(
            playerAccount.address,
            DEFAULT_GAME_ID,
            randomAchievementIds.length,
            DEFAULT_STORE_ID,
            true
        );
        await tx.wait();
        const balance = await GameSummary.balanceOf(playerAccount.address, hashIds(DEFAULT_STORE_ID, DEFAULT_GAME_ID));
        const balanceInt = Number(balance);
        expect(balanceInt).to.equal(1);
    });

    it('As Admin must mint a game summary but not the same game summary twice', async function () {
        const randomAchievementIds = [1234, 65441, 12312];
        const tx = await GameSummary.adminMintGameSummary(
            playerAccount.address,
            DEFAULT_GAME_ID,
            randomAchievementIds.length,
            DEFAULT_STORE_ID,
            true
        );
        await tx.wait();

        await expect(
            GameSummary.adminMintGameSummary(
                playerAccount.address,
                DEFAULT_GAME_ID,
                randomAchievementIds.length,
                DEFAULT_STORE_ID,
                true
            )
            // @ts-ignore-next-line
        ).to.be.revertedWith('Token already exists');
    });

    it('The pause functionality should works as expected', async function () {
        const randomAchievementIds = [1234, 65441, 12312];
        const tx = await GameSummary.adminMintGameSummary(
            playerAccount.address,
            DEFAULT_GAME_ID,
            randomAchievementIds.length,
            DEFAULT_STORE_ID,
            true
        );
        await tx.wait();

        await GameSummary.pause();

        await expect(
            GameSummary.adminMintGameSummary(
                playerAccount.address,
                DEFAULT_GAME_ID + 1,
                randomAchievementIds.length,
                DEFAULT_STORE_ID,
                true
            )
            // @ts-ignore-next-line
        ).to.be.revertedWith('Pausable: paused');

        await GameSummary.unpause();

        await (
            await await GameSummary.createCommonGameSummary(
                DEFAULT_STORE_ID,
                DEFAULT_GAME_ID + 2,
                'GameTest1234',
                'test://on_chain_uri',
                'external_uri',
                500
            )
        ).wait();
        const tx2 = await GameSummary.adminMintGameSummary(
            playerAccount.address,
            DEFAULT_GAME_ID + 2,
            randomAchievementIds.length,
            DEFAULT_STORE_ID,
            true
        );
        await tx2.wait();
        const balance = await GameSummary.balanceOf(
            playerAccount.address,
            hashIds(DEFAULT_STORE_ID, DEFAULT_GAME_ID + 2)
        );
        expect(Number(balance)).to.equal(1);
    });

    it('As admin must mint a batch of game summaries achievement for players', async function () {
        const GAME_IDS = [208, 444, 555];
        const randomArrayAchievementsIds1 = [12345, 654421, 123132, 12312];
        const randomArrayAchievementsIds2 = [1231234, 6545641, 9999];
        const randomArrayAchievementsIds3 = [6661234, 33365441, 22212312];

        for await (const gameID of GAME_IDS) {
            await (
                await GameSummary.createCommonGameSummary(
                    DEFAULT_STORE_ID,
                    gameID,
                    'GameTest1234',
                    'test://on_chain_uri',
                    'external_uri',
                    9999999999
                )
            ).wait();
        }

        const tx = await GameSummary.adminBatchMintGameSummary(
            [playerAccount.address, playerAccount.address, playerAccount.address],
            GAME_IDS,
            [
                randomArrayAchievementsIds1.length,
                randomArrayAchievementsIds2.length,
                randomArrayAchievementsIds3.length,
            ],
            [DEFAULT_STORE_ID, DEFAULT_STORE_ID, DEFAULT_STORE_ID],
            [true, false, true]
        );
        await tx.wait();

        for (let i = 0; i < GAME_IDS.length; i++) {
            const tokenId = hashIds(DEFAULT_STORE_ID, GAME_IDS[i]);
            const balance = await GameSummary.balanceOf(playerAccount.address, tokenId);
            const balanceInt = Number(balance);
            expect(balanceInt).to.equal(1);
        }
    });

    it('As game creator role I can create game summaries', async function () {
        const summary = await GameSummary.getGameSummary(hashIds(DEFAULT_STORE_ID, DEFAULT_GAME_ID));
        expect(Number(summary.gameId)).to.equal(DEFAULT_GAME_ID);
        expect(Number(summary.totalAchievements)).to.equal(500);
        expect(summary.name).to.equal('GameTest1234');
        expect(summary.image).to.equal('test://on_chain_uri');
        expect(summary.externalURI).to.equal('external_uri');
    });

    it('As an User I can get 1 GameSummary that the admin minted per game', async function () {
        const tx = await GameSummary.adminMintGameSummary(
            playerAccount.address,
            DEFAULT_GAME_ID,
            20,
            DEFAULT_STORE_ID,
            true
        );
        await tx.wait();
        const gameSummary = await GameSummary.connect(playerAccount).getGameSummary(
            hashIds(DEFAULT_STORE_ID, DEFAULT_GAME_ID)
        );
        expect(Number(gameSummary.gameId)).to.equal(DEFAULT_GAME_ID);
        expect(Number(gameSummary.totalAchievements)).to.equal(500);
        expect(gameSummary.name).to.equal('GameTest1234');
        expect(gameSummary.image).to.equal('test://on_chain_uri');
        expect(gameSummary.externalURI).to.equal('external_uri');
    });

    it('As an User I can get 1 GameSummary that the admin minted per game and check the PlayerData', async function () {
        const PLAYER_ACHIEVEMENTS_LENGTH = 20;
        const TOTAL_ACHIEVEMENTS_IN_GAME = 500;
        await (
            await GameSummary.createCommonGameSummary(
                DEFAULT_STORE_ID + 1,
                DEFAULT_GAME_ID,
                'GameTest1234',
                'test://on_chain_uri',
                'external_uri',
                TOTAL_ACHIEVEMENTS_IN_GAME
            )
        ).wait();
        const tx = await GameSummary.adminMintGameSummary(
            playerAccount.address,
            DEFAULT_GAME_ID,
            PLAYER_ACHIEVEMENTS_LENGTH,
            DEFAULT_STORE_ID + 1,
            true
        );
        await tx.wait();
        const gameSummary = await GameSummary.connect(playerAccount).getGameSummary(
            hashIds(DEFAULT_STORE_ID + 1, DEFAULT_GAME_ID)
        );
        expect(Number(gameSummary.gameId)).to.equal(DEFAULT_GAME_ID);
        expect(Number(gameSummary.totalAchievements)).to.equal(TOTAL_ACHIEVEMENTS_IN_GAME);
        const playerData = await GameSummary.connect(playerAccount).getPlayerGameData(
            playerAccount.address,
            hashIds(DEFAULT_STORE_ID + 1, DEFAULT_GAME_ID)
        );
        expect(Number(playerData.achievementsMinted)).to.equal(PLAYER_ACHIEVEMENTS_LENGTH);
        // missing achievements = total achievements - achievements minted
        expect(Number(gameSummary.totalAchievements) - Number(playerData.achievementsMinted)).to.equal(480);
    });

    it('If the admin update one GameSummary, everyone will have this update', async function () {
        const createCommonGameSummaryTrx = await GameSummary.createCommonGameSummary(
            DEFAULT_STORE_ID + 1,
            DEFAULT_GAME_ID,
            'GameTest1234',
            'test://on_chain_uri',
            'external_uri',
            500
        );
        await createCommonGameSummaryTrx.wait();
        const tx = await GameSummary.adminMintGameSummary(
            playerAccount.address,
            DEFAULT_GAME_ID,
            20,
            DEFAULT_STORE_ID + 1,
            true
        );
        await tx.wait();
        const gameSummary = await GameSummary.connect(playerAccount).getGameSummary(
            hashIds(DEFAULT_STORE_ID + 1, DEFAULT_GAME_ID)
        );
        expect(gameSummary.image).to.equal('test://on_chain_uri');
        await GameSummary.updateCommonGameSummary(
            hashIds(DEFAULT_STORE_ID + 1, DEFAULT_GAME_ID),
            'New_NAME',
            'test://on_chain_uri_2',
            'external_uri',
            577
        );
        const gameSummaryUpdated = await GameSummary.connect(playerAccount).getGameSummary(
            hashIds(DEFAULT_STORE_ID + 1, DEFAULT_GAME_ID)
        );
        expect(gameSummaryUpdated.image).to.equal('test://on_chain_uri_2');
        expect(gameSummaryUpdated.name).to.equal('New_NAME');
        expect(Number(gameSummaryUpdated.totalAchievements)).to.equal(500 + 77);
    });

    it('As an Admin the BaseURI functionality should works', async function () {
        const tx = await GameSummary.setBaseUri('ipfs://some1234hash/folder/');
        await tx.wait();
        const baseURI = await GameSummary.baseUri();
        expect(baseURI).to.equal('ipfs://some1234hash/folder/');

        const mintTx = await GameSummary.adminMintGameSummary(
            playerAccount.address,
            DEFAULT_GAME_ID,
            222,
            DEFAULT_STORE_ID,
            true
        );
        await mintTx.wait();
        const uri = await GameSummary.uri(hashIds(DEFAULT_STORE_ID, DEFAULT_GAME_ID));
        expect(uri).to.equal(`ipfs://some1234hash/folder/${hashIds(DEFAULT_STORE_ID, DEFAULT_GAME_ID)}.json`);
    });

    it('As user I cant transfer/sell any achievement if is a SBT', async function () {
        const tx = await GameSummary.adminMintGameSummary(
            playerAccount.address,
            DEFAULT_GAME_ID,
            20,
            DEFAULT_STORE_ID,
            true
        );
        await tx.wait();
        await expect(
            GameSummary.connect(playerAccount).safeTransferFrom(
                playerAccount.address,
                minterAccount.address,
                hashIds(DEFAULT_STORE_ID, DEFAULT_GAME_ID),
                1,
                ethers.toUtf8Bytes('')
            )
            // @ts-ignore-next-line
        ).to.be.revertedWith("You can't transfer this token");

        // simulating a listing on any marketplace
        await GameSummary.setApprovalForAll('0xa5409ec958c83c3f309868babaca7c86dcb077c1', true);
        await expect(
            GameSummary.connect(playerAccount).safeTransferFrom(
                playerAccount.address,
                '0xa5409ec958c83c3f309868babaca7c86dcb077c1',
                hashIds(DEFAULT_STORE_ID, DEFAULT_GAME_ID),
                1,
                ethers.toUtf8Bytes('')
            )
            // @ts-ignore-next-line
        ).to.be.revertedWith("You can't transfer this token");
    });

    it('As user I can transfer/sell any achievement if is not a SBT', async function () {
        const tx = await GameSummary.adminMintGameSummary(
            playerAccount.address,
            DEFAULT_GAME_ID,
            20,
            DEFAULT_STORE_ID,
            false
        );
        await tx.wait();
        const transferTx = await GameSummary.connect(playerAccount).safeTransferFrom(
            playerAccount.address,
            minterAccount.address,
            hashIds(DEFAULT_STORE_ID, DEFAULT_GAME_ID),
            1,
            ethers.toUtf8Bytes('')
        );
        await transferTx.wait();
        const balance = await GameSummary.balanceOf(minterAccount.address, hashIds(DEFAULT_STORE_ID, DEFAULT_GAME_ID));
        expect(Number(balance)).to.equal(1);
    });

    it('As user I cant transfer any SBT using the safeBatchTransferFrom', async function () {
        const GAME_IDS = [DEFAULT_GAME_ID, DEFAULT_GAME_ID + 1, DEFAULT_GAME_ID + 2, DEFAULT_GAME_ID + 3];
        for await (const gameID of GAME_IDS) {
            if (gameID != DEFAULT_GAME_ID) {
                await (
                    await GameSummary.createCommonGameSummary(
                        DEFAULT_STORE_ID,
                        gameID,
                        'GameTest1234',
                        'test://on_chain_uri',
                        'external_uri',
                        9999999999
                    )
                ).wait();
            }
        }
        const TOKEN_ID_1 = hashIds(DEFAULT_STORE_ID, GAME_IDS[0]);
        const TOKEN_ID_2 = hashIds(DEFAULT_STORE_ID, GAME_IDS[1]);
        const TOKEN_ID_3 = hashIds(DEFAULT_STORE_ID, GAME_IDS[2]);
        const TOKEN_ID_4 = hashIds(DEFAULT_STORE_ID, GAME_IDS[3]);
        const sbt1Trx = await GameSummary.adminMintGameSummary(
            playerAccount.address,
            GAME_IDS[0],
            1,
            DEFAULT_STORE_ID,
            false
        );
        const sbt2Trx = await GameSummary.adminMintGameSummary(
            playerAccount.address,
            GAME_IDS[1],
            1,
            DEFAULT_STORE_ID,
            true
        );
        const sbt3Trx = await GameSummary.adminMintGameSummary(
            playerAccount.address,
            GAME_IDS[2],
            1,
            DEFAULT_STORE_ID,
            false
        );
        const sbt4Trx = await GameSummary.adminMintGameSummary(
            playerAccount.address,
            GAME_IDS[3],
            1,
            DEFAULT_STORE_ID,
            false
        );
        await sbt1Trx.wait();
        await sbt2Trx.wait();
        await sbt3Trx.wait();
        await sbt4Trx.wait();

        // must revert because  at least 1 token is an SBT
        await expect(
            GameSummary.connect(playerAccount).safeBatchTransferFrom(
                playerAccount.address,
                minterAccount.address,
                [TOKEN_ID_1, TOKEN_ID_2, TOKEN_ID_3],
                [1, 1, 1],
                ethers.toUtf8Bytes('')
            )
            // @ts-ignore-next-line
        ).to.be.revertedWith("You can't transfer this token");

        const balance = await GameSummary.balanceOf(minterAccount.address, `${TOKEN_ID_1}`);
        const balance2 = await GameSummary.balanceOf(minterAccount.address, `${TOKEN_ID_2}`);
        expect(Number(balance)).to.equal(0);
        expect(Number(balance2)).to.equal(0);

        // But if the token is not an SBT, it should work
        const transferTx = await GameSummary.connect(playerAccount).safeBatchTransferFrom(
            playerAccount.address,
            minterAccount.address,
            [TOKEN_ID_3, TOKEN_ID_4],
            [1, 1],
            ethers.toUtf8Bytes('')
        );
        await transferTx.wait();
        const balance3 = await GameSummary.balanceOf(minterAccount.address, `${TOKEN_ID_3}`);
        const balance4 = await GameSummary.balanceOf(minterAccount.address, `${TOKEN_ID_4}`);
        expect(Number(balance3)).to.equal(1);
        expect(Number(balance4)).to.equal(1);
    });

    it('As a user I could burn any not SBT', async function () {
        const TOKEN_ID_1 = hashIds(DEFAULT_STORE_ID, DEFAULT_GAME_ID);
        const sbt1Trx = await GameSummary.adminMintGameSummary(
            playerAccount.address,
            DEFAULT_GAME_ID,
            1,
            DEFAULT_STORE_ID,
            false
        );
        await sbt1Trx.wait();

        const burnTx = await GameSummary.connect(playerAccount).burn(TOKEN_ID_1);
        await burnTx.wait();

        const balance = await GameSummary.balanceOf(playerAccount.address, TOKEN_ID_1);
        expect(Number(balance)).to.equal(0);
    });

    it('As a user I can burn any SBT but the info of the player will be cleared', async function () {
        const TOKEN_ID_1 = hashIds(DEFAULT_STORE_ID, DEFAULT_GAME_ID);
        const sbt1Trx = await GameSummary.adminMintGameSummary(
            playerAccount.address,
            DEFAULT_GAME_ID,
            1,
            DEFAULT_STORE_ID,
            true
        );
        await sbt1Trx.wait();
        await (await GameSummary.connect(playerAccount).burn(TOKEN_ID_1)).wait();

        const gameSummaryBurned = await GameSummary.connect(playerAccount).getPlayerGameData(
            playerAccount.address,
            TOKEN_ID_1
        );
        await expect(gameSummaryBurned.achievementsMinted).to.equal(0);
        await expect(gameSummaryBurned.tokenId).to.equal(0);
        await expect(gameSummaryBurned.soulbounded).to.be.false;
    });

    it('should revert if a non-admin tries to set a signer', async function () {
        await expect(GameSummary.connect(playerAccount).setSigner(minterAccount.address))
            // @ts-ignore-next-line
            .to.be.revertedWith(
                'AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x0000000000000000000000000000000000000000000000000000000000000000'
            );
    });

    it('should revert if a non-admin tries to remove a signer', async function () {
        await expect(GameSummary.connect(playerAccount).removeSigner(minterAccount.address))
            // @ts-ignore-next-line
            .to.be.revertedWith(
                'AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x0000000000000000000000000000000000000000000000000000000000000000'
            );
    });

    it('should return true for supported interfaces', async function () {
        expect(await GameSummary.supportsInterface('0x01ffc9a7')).to.be.true; // ERC165
        expect(await GameSummary.supportsInterface('0xd9b67a26')).to.be.true; // ERC1155
    });

    it('should return false for unsupported interfaces', async function () {
        expect(await GameSummary.supportsInterface('0xabcdef12')).to.be.false;
    });

    it('should return the correct uri for a given token ID', async function () {
        expect(await GameSummary.uri(123)).to.equal('https://summon.mypinata.cloud/ipfs/123.json');
    });

    it('should allow batch burning of tokens', async function () {
        const TOKEN_ID_1 = hashIds(DEFAULT_STORE_ID, DEFAULT_GAME_ID);
        const TOKEN_ID_2 = hashIds(DEFAULT_STORE_ID, DEFAULT_GAME_ID + 1);

        await await GameSummary.createCommonGameSummary(
            DEFAULT_STORE_ID,
            DEFAULT_GAME_ID + 1,
            'testGame',
            'ipfs://hash',
            'https://cdn.comg/jpg',
            200
        );
        await GameSummary.adminMintGameSummary(playerAccount.address, DEFAULT_GAME_ID, 1, DEFAULT_STORE_ID, false);
        await GameSummary.adminMintGameSummary(playerAccount.address, DEFAULT_GAME_ID + 1, 1, DEFAULT_STORE_ID, false);

        const burnTx = await GameSummary.connect(playerAccount).burnBatch([TOKEN_ID_1, TOKEN_ID_2]);
        await burnTx.wait();

        const balance1 = await GameSummary.balanceOf(playerAccount.address, TOKEN_ID_1);
        const balance2 = await GameSummary.balanceOf(playerAccount.address, TOKEN_ID_2);
        expect(Number(balance1)).to.equal(0);
        expect(Number(balance2)).to.equal(0);
    });

    it('should revert if the signature is not valid', async function () {
        await generateSignature({ walletAddress: playerAccount.address, signer: minterAccount });
        const whitelistTx = await GameSummary.setSigner(minterAccount.address);
        await whitelistTx.wait();

        // incorrect signer
        const { signature, nonce } = await generateSignature({
            walletAddress: minterAccount.address,
            signer: playerAccount,
        });

        await expect(
            GameSummary.connect(playerAccount).mintGameSummaryWithSignature(
                DEFAULT_GAME_ID,
                20,
                DEFAULT_STORE_ID,
                nonce,
                signature
            )
            // @ts-ignore-next-line
        ).to.be.revertedWith('Invalid signature');
    });

    it('as admin should update the qty of achievements for a player', async function () {
        const tx = await GameSummary.adminMintGameSummary(
            playerAccount.address,
            DEFAULT_GAME_ID,
            20,
            DEFAULT_STORE_ID,
            true
        );
        await tx.wait();

        const updateTx = await GameSummary.adminUpdatePlayerAchievements(
            playerAccount.address,
            hashIds(DEFAULT_STORE_ID, DEFAULT_GAME_ID),
            23
        );
        await updateTx.wait();

        const playerDataUpdated = await GameSummary.connect(playerAccount).getPlayerGameData(
            playerAccount.address,
            hashIds(DEFAULT_STORE_ID, DEFAULT_GAME_ID)
        );
        expect(Number(playerDataUpdated.achievementsMinted)).to.equal(43);
    });

    it('as admin should update the qty of achievements for a player using the batch', async function () {
        const GAME_IDS = [100, 234, 255];

        for await (const gameID of GAME_IDS) {
            await (
                await GameSummary.createCommonGameSummary(
                    DEFAULT_STORE_ID,
                    gameID,
                    'GameTest1234',
                    'test://on_chain_uri',
                    'external_uri',
                    9999999999
                )
            ).wait();
        }

        const TOKEN_IDS = GAME_IDS.map((gameId) => hashIds(DEFAULT_STORE_ID, gameId));

        const tx = await GameSummary.adminBatchMintGameSummary(
            [playerAccount.address, playerAccount.address, playerAccount.address],
            GAME_IDS,
            [20, 44, 55],
            [DEFAULT_STORE_ID, DEFAULT_STORE_ID, DEFAULT_STORE_ID],
            [true, true, true]
        );
        await tx.wait();

        const updateTx = await GameSummary.adminBatchPlayerUpdateAchievements(
            [playerAccount.address, playerAccount.address, playerAccount.address],
            TOKEN_IDS,
            [1, 2, 3]
        );
        await updateTx.wait();

        const playerDataUpdated = await GameSummary.connect(playerAccount).getPlayerGameData(
            playerAccount.address,
            TOKEN_IDS[0]
        );
        expect(Number(playerDataUpdated.achievementsMinted)).to.equal(21);

        const playerDataUpdated2 = await GameSummary.connect(playerAccount).getPlayerGameData(
            playerAccount.address,
            TOKEN_IDS[1]
        );
        expect(Number(playerDataUpdated2.achievementsMinted)).to.equal(46);

        const playerDataUpdated3 = await GameSummary.connect(playerAccount).getPlayerGameData(
            playerAccount.address,
            TOKEN_IDS[2]
        );
        expect(Number(playerDataUpdated3.achievementsMinted)).to.equal(58);
    });

    it('should update the qty of achievements for a player using the signature', async function () {
        const { signature, nonce } = await generateSignature({
            walletAddress: playerAccount.address,
            signer: minterAccount,
        });
        const whitelistTx = await GameSummary.setSigner(minterAccount.address);
        await whitelistTx.wait();

        const tx = await GameSummary.connect(playerAccount).mintGameSummaryWithSignature(
            DEFAULT_GAME_ID,
            20,
            DEFAULT_STORE_ID,
            nonce,
            signature
        );
        await tx.wait();

        const { signature: signature2, nonce: nonce2 } = await generateSignature({
            walletAddress: playerAccount.address,
            signer: minterAccount,
        });

        const updateTx = await GameSummary.connect(playerAccount).updatePlayerAchievementsWithSignature(
            hashIds(DEFAULT_STORE_ID, DEFAULT_GAME_ID),
            23,
            nonce2,
            signature2
        );
        await updateTx.wait();

        const playerDataUpdated = await GameSummary.connect(playerAccount).getPlayerGameData(
            playerAccount.address,
            hashIds(DEFAULT_STORE_ID, DEFAULT_GAME_ID)
        );
        expect(Number(playerDataUpdated.achievementsMinted)).to.equal(43);
    });

    it('the batchUpdate using the signature should works as expected', async function () {
        const GAME_IDS = [100, 234, 255];

        for await (const gameID of GAME_IDS) {
            await (
                await GameSummary.createCommonGameSummary(
                    DEFAULT_STORE_ID,
                    gameID,
                    'GameTest1234',
                    'test://on_chain_uri',
                    'external_uri',
                    9999999999
                )
            ).wait();
        }

        const TOKEN_IDS = GAME_IDS.map((gameId) => hashIds(DEFAULT_STORE_ID, gameId));

        const { signature, nonce } = await generateSignature({
            walletAddress: playerAccount.address,
            signer: minterAccount,
        });
        const whitelistTx = await GameSummary.setSigner(minterAccount.address);
        await whitelistTx.wait();

        const tx = await GameSummary.connect(playerAccount).batchMintGameSummaryWithSignature(
            GAME_IDS,
            [20, 44, 55],
            [DEFAULT_STORE_ID, DEFAULT_STORE_ID, DEFAULT_STORE_ID],
            nonce,
            signature
        );
        await tx.wait();

        const gameData = await GameSummary.connect(playerAccount).getPlayerGamesData(playerAccount.address, TOKEN_IDS);
        expect(gameData.length).to.equal(3);

        const { signature: signature2, nonce: nonce2 } = await generateSignature({
            walletAddress: playerAccount.address,
            signer: minterAccount,
        });

        const updateTx = await GameSummary.connect(playerAccount).batchPlayerUpdateAchievementsWithSignature(
            TOKEN_IDS,
            [2, 90, 20],
            nonce2,
            signature2
        );
        await updateTx.wait();

        const playerDataUpdated = await GameSummary.connect(playerAccount).getPlayerGameData(
            playerAccount.address,
            TOKEN_IDS[0]
        );
        expect(Number(playerDataUpdated.achievementsMinted)).to.equal(22);

        const playerDataUpdated2 = await GameSummary.connect(playerAccount).getPlayerGameData(
            playerAccount.address,
            TOKEN_IDS[1]
        );
        expect(Number(playerDataUpdated2.achievementsMinted)).to.equal(134);

        const playerDataUpdated3 = await GameSummary.connect(playerAccount).getPlayerGameData(
            playerAccount.address,
            TOKEN_IDS[2]
        );
        expect(Number(playerDataUpdated3.achievementsMinted)).to.equal(75);
    });

    it("As admin or user minting shouldn't have collisions between ids", async function () {
        const GAME_ID = 110011;
        const STORE_ID = 10101010;
        await (
            await await GameSummary.createCommonGameSummary(
                STORE_ID,
                GAME_ID,
                'GameTest1234',
                'test://on_chain_uri',
                'external_uri',
                500
            )
        ).wait();
        const tokenID = hashIds(STORE_ID, GAME_ID);
        const tx = await GameSummary.adminMintGameSummary(playerAccount.address, GAME_ID, 20, STORE_ID, true);
        await tx.wait();
        const balanceBN = await GameSummary.connect(playerAccount).balanceOf(playerAccount.address, tokenID);
        expect(Number(balanceBN)).to.equal(1);
    });
});