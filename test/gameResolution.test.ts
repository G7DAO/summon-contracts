import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

describe('HFG Game', function () {
    const ZERO_ADDRESS = ethers.ZeroAddress;

    async function deployGameFixture() {
        const [deployer, gameWallet, player1, player2, player3, treasury] =
            await ethers.getSigners();

        // Mock or actual token address
        const Token = await ethers.getContractFactory("MockERC20");
        const token = await Token.deploy("TestToken", "TT");
        await token.waitForDeployment();

        await token.mint(player1.address, 100000n);
        await token.mint(player2.address, 100000n);
        await token.mint(player3.address, 100000n);

        // Deploy Chips
        const Chips = await ethers.getContractFactory("Chips");
        const chips = await upgrades.deployProxy(
            Chips,
            [await token.getAddress(), false, deployer.address],
            { initializer: "initialize", kind: "uups" }
        );
        await chips.waitForDeployment();

        const playCost = 1000n;

        // Deploy Game
        const Game = await ethers.getContractFactory("Game");
        const game = await upgrades.deployProxy(
            Game,
            [
            await chips.getAddress(),
            treasury.address, // treasury
            playCost,
            false, // isPaused
            ],
            { initializer: "initialize", kind: "uups" }
        );
        await game.waitForDeployment();

        await chips.connect(deployer).grantRole(
            ethers.keccak256(ethers.toUtf8Bytes("GAME_ROLE")),
            await game.getAddress()
        );

        await game.connect(deployer).grantRole(
            ethers.keccak256(ethers.toUtf8Bytes("GAME_SERVER_ROLE")),
            gameWallet
        );

        console.log("Token deployed to:", await token.getAddress());
        console.log("Chips deployed to:", await chips.getAddress());
        console.log("Game deployed to:", await game.getAddress());

        return { game: game, chips: chips, token: token, deployer: deployer, players: [player1, player2, player3], treasury: treasury, gameWallet: gameWallet, playCost: playCost };
    }

    async function depositChips(chips, token, deployer, wallet, amount) {
        const chainId = (await ethers.provider.getNetwork()).chainId;
        const contractAddress = await chips.getAddress();

        const data = ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'uint256', 'uint256'],
            [contractAddress, chainId, amount]
        );
        const nonce = 1;
        const message = ethers.solidityPacked(
            ['address', 'bytes', 'uint256'],
            [wallet.address, data, nonce]
        );
        const messageHash = ethers.keccak256(message);
        const signature = await deployer.signMessage(ethers.getBytes(messageHash));

        await token.connect(wallet).approve(await chips.getAddress(), amount);
        await chips.connect(wallet).deposit(data, nonce, signature);
    }

    describe('Deployment', function () {
        it('Should deploy successfully', async function () {
            const { game, chips, token, deployer, players, treasury, gameWallet, playCost } = await loadFixture(deployGameFixture);
            expect(await game.getAddress()).to.be.properAddress;
        });

        it('Should set the correct roles', async function () {
            const { game, chips, token, deployer, players, treasury, gameWallet, playCost } = await loadFixture(deployGameFixture);

            const MANAGER_ROLE = await chips.MANAGER_ROLE();
            const GAME_ROLE = await chips.GAME_ROLE();
            const GAME_SERVER_ROLE = await game.GAME_SERVER_ROLE();

            expect(await chips.hasRole(MANAGER_ROLE, deployer.address)).to.be.true;
            expect(await chips.hasRole(GAME_ROLE, await game.getAddress())).to.be.true;
            expect(await game.hasRole(GAME_SERVER_ROLE, gameWallet)).to.be.true;
        });
    });

    describe('Buy Plays', function () {
        let game;
        let chips;
        let token;
        let deployer;
        let players;
        let treasury;
        let gameWallet;
        let playCost;

        beforeEach(async function () {
            ({ game, chips, token, deployer, players, treasury, gameWallet, playCost } = await loadFixture(deployGameFixture));
        });

        it('Should store play balance and game values and emit an event', async function () {
            const user1 = players[0];
            
            const gameNumber = 1n;
            let numPlays = 5n;
            const totalCost = numPlays * playCost;

            await token.connect(user1).approve(await chips.getAddress(), totalCost);
            await depositChips(chips, token, deployer, user1, totalCost);

            expect(await chips.connect(deployer).balanceOf(user1.address)).to.equal(totalCost);
            expect(await game.playBalance(gameNumber, user1)).to.equal(0n);
            expect(await game.totalGameValue(gameNumber)).to.equal(0n);
            expect(await game.currentGameValue(gameNumber)).to.equal(0n);

            // Try to buy more plays than user can afford
            numPlays += 1n;
            await expect(
                game.connect(gameWallet).buyPlays(user1.address, gameNumber, numPlays)
            ).to.be.revertedWithCustomError(game, "InsufficientChipBalance")
            .withArgs(user1.address, numPlays * playCost);
        });

        it('Should revert if player does not have sufficient balance', async function () {
            const user1 = players[0];
            
            const gameNumber = 1n;
            const numPlays = 5n;
            const totalCost = numPlays * playCost;

            await token.connect(user1).approve(await chips.getAddress(), totalCost);
            await depositChips(chips, token, deployer, user1, totalCost);

            expect(await chips.balanceOf(user1)).to.equal(totalCost);
            expect(await game.playBalance(gameNumber, user1)).to.equal(0n);
            expect(await game.totalGameValue(gameNumber)).to.equal(0n);
            expect(await game.currentGameValue(gameNumber)).to.equal(0n);

            await expect(
                game.connect(gameWallet).buyPlays(user1, gameNumber, numPlays)
            ).to.emit(game, "PlaysBought")
            .withArgs(user1.address, gameNumber, numPlays);

            expect(await chips.balanceOf(user1)).to.equal(0);
            expect(await game.playBalance(gameNumber, user1)).to.equal(numPlays);
            expect(await game.totalGameValue(gameNumber)).to.equal(totalCost);
            expect(await game.currentGameValue(gameNumber)).to.equal(totalCost);
        });
    });

    describe('Payout', function () {
        let game;
        let chips;
        let token;
        let deployer;
        let players;
        let treasury;
        let gameWallet;
        let playCost;

        beforeEach(async function () {
            ({ game, chips, token, deployer, players, treasury, gameWallet, playCost } = await loadFixture(deployGameFixture));
        });

        it('Should payout to users and emit an event', async function () {
            const user1 = players[0];
            
            const gameNumber = 1n;
            const numPlays = 5n;
            const totalCost = numPlays * playCost;
            const rake = (totalCost * 10n)/100n;

            await token.connect(user1).approve(await chips.getAddress(), totalCost);
            await depositChips(chips, token, deployer, user1, totalCost);

            expect(await chips.balanceOf(user1)).to.equal(totalCost);
            expect(await game.playBalance(gameNumber, user1)).to.equal(0n);
            expect(await game.totalGameValue(gameNumber)).to.equal(0n);
            expect(await game.currentGameValue(gameNumber)).to.equal(0n);

            await expect(
                game.connect(gameWallet).buyPlays(user1, gameNumber, numPlays)
            ).to.emit(game, "PlaysBought")
            .withArgs(user1.address, gameNumber, numPlays);

            expect(await chips.balanceOf(user1)).to.equal(0);
            expect(await game.playBalance(gameNumber, user1)).to.equal(numPlays);
            expect(await game.totalGameValue(gameNumber)).to.equal(totalCost);
            expect(await game.currentGameValue(gameNumber)).to.equal(totalCost);

            await expect(
                game.connect(gameWallet).payout(gameNumber, [user1], [totalCost - rake], rake)
            ).to.emit(game, "RakeCollected")
            .withArgs(gameNumber, rake)
            .and.to.emit(game, "ValueDistributed")
            .withArgs(gameNumber, (totalCost - rake));


            expect(await chips.balanceOf(user1.address)).to.equal(totalCost - rake);
            expect(await chips.balanceOf(treasury.address)).to.equal(rake);
        });

        it('Should payout to multiple users', async function () {
            const gameNumber = 1n;
            const numPlays = 5n;
            const totalCost = numPlays * playCost;
            const rake = (totalCost * 3n * 10n)/100n;

            for (let i = 0; i < players.length; i++) {
                await token.connect(players[i]).approve(await chips.getAddress(), totalCost);
                //await chips.connect(players[i]).deposit(totalCost);
                await depositChips(chips, token, deployer, players[i], totalCost);

                expect(await chips.balanceOf(players[i])).to.equal(totalCost);
                expect(await game.playBalance(gameNumber, players[i])).to.equal(0n);
            }

            expect(await game.totalGameValue(gameNumber)).to.equal(0n);
            expect(await game.currentGameValue(gameNumber)).to.equal(0n);

            for (let i = 0; i < players.length; i++) {
                await expect(
                    game.connect(gameWallet).buyPlays(players[i], gameNumber, numPlays)
                ).to.emit(game, "PlaysBought")
                .withArgs(players[i].address, gameNumber, numPlays);

                expect(await chips.balanceOf(players[i])).to.equal(0);
                expect(await game.playBalance(gameNumber, players[i])).to.equal(numPlays);
            }

            expect(await game.totalGameValue(gameNumber)).to.equal(totalCost * 3n);
            expect(await game.currentGameValue(gameNumber)).to.equal(totalCost * 3n);

            const prizeValue = totalCost * 3n - rake;
            const payouts = [prizeValue / 27n, prizeValue * 6n / 27n, prizeValue * 20n / 27n]; // Values spefic to prize pool because of integer division

            await expect(
                game.connect(gameWallet).payout(gameNumber, players, payouts, rake)
            ).to.emit(game, "RakeCollected")
            .withArgs(gameNumber, rake)
            .and.to.emit(game, "ValueDistributed")
            .withArgs(gameNumber, (totalCost * 3n - rake));


            for (let i = 0; i < players.length; i++) {
                expect(await chips.balanceOf(players[i].address)).to.equal(payouts[i]);
                expect(await chips.balanceOf(treasury.address)).to.equal(rake);
            }

        });
    });

    describe('Play cost', function () {
        let game;
        let chips;
        let token;
        let deployer;
        let players;
        let treasury;
        let gameWallet;
        let playCost;

        beforeEach(async function () {
            ({ game, chips, token, deployer, players, treasury, gameWallet, playCost } = await loadFixture(deployGameFixture));
        });

        it('Should use default and allow admin to change', async function () {
            const gameNumber = 3n;
            expect(await game.getPlayCost(gameNumber)).to.equal(playCost);

            const newPlayCost = 5000n;
            await game.connect(deployer).setPlayCost(gameNumber, newPlayCost);

            expect(await game.getPlayCost(gameNumber)).to.equal(newPlayCost);
        });

        it('Should not allow nonAdmin to change', async function () {
            const gameNumber = 3n;
            expect(await game.getPlayCost(gameNumber)).to.equal(playCost);

            const newPlayCost = 5000n;
            await expect(
                game.connect(players[0]).setPlayCost(gameNumber, newPlayCost)
            ).to.be.reverted;

            expect(await game.getPlayCost(gameNumber)).to.equal(playCost);
        });
    });

    describe('Upgrade', function () {
        let game;
        let chips;
        let token;
        let deployer;
        let players;
        let treasury;
        let gameWallet;
        let playCost;

        beforeEach(async function () {
            ({ game, chips, token, deployer, players, treasury, gameWallet, playCost } = await loadFixture(deployGameFixture));
        });

        it("Should upgrade Game to MockGameV2", async function () {
            const gameNumber = 5n;
            expect(await game.getPlayCost(gameNumber)).to.equal(playCost);

            const MockGameV2 = await ethers.getContractFactory("MockGameV2");

            const upgraded = await upgrades.upgradeProxy(await game.getAddress(), MockGameV2);

            // Verify existing state is intact (optional)
            expect(await upgraded.getPlayCost(gameNumber)).to.equal(playCost);

            // Call new function
            expect(await upgraded.upgradeTestFunction()).to.equal("Successful test!");
        });

        it("Should revert upgrade attempt from non-admin", async function () {
            const { game, players } = await loadFixture(deployGameFixture);

            const MockGameV2 = await ethers.getContractFactory("MockGameV2", players[0]);

            await expect(
                upgrades.upgradeProxy(await game.getAddress(), MockGameV2)
            ).to.be.revertedWithCustomError(game, "AccessControlUnauthorizedAccount")
            .withArgs(players[0].address, ethers.ZeroHash); // 0x00... is DEFAULT_ADMIN_ROLE
        });

    });


});
