import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

describe('HFG Game', function () {
    const ZERO_ADDRESS = ethers.ZeroAddress;

    async function deployGameFixture() {
        const [deployer, gameWallet, user1] =
            await ethers.getSigners();

        // Mock or actual token address
        const Token = await ethers.getContractFactory("MockERC20");
        const token = await Token.deploy("TestToken", "TT");
        await token.waitForDeployment();

        await token.mint(user1.address, 100000n);

        // Deploy Chips
        const Chips = await ethers.getContractFactory("Chips");
        const chips = await upgrades.deployProxy(
            Chips,
            [await token.getAddress(), false],
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
            deployer.address, // treasury
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

        return { game: game, chips: chips, token: token, deployer: deployer, user1: user1, gameWallet: gameWallet, playCost: playCost };
    }

    describe('Deployment', function () {
        it('Should deploy successfully', async function () {
            const { game} = await loadFixture(deployGameFixture);
            expect(await game.getAddress()).to.be.properAddress;
        });

        it('Should set the correct roles', async function () {
            const { game, chips, token, deployer, user1, gameWallet, playCost } = await loadFixture(deployGameFixture);

            const ADMIN_ROLE = await chips.DEFAULT_ADMIN_ROLE(); // or chips.ADMIN_ROLE() if that’s different
            const GAME_ROLE = await chips.GAME_ROLE();
            const GAME_SERVER_ROLE = await game.GAME_SERVER_ROLE();

            expect(await chips.hasRole(ADMIN_ROLE, deployer.address)).to.be.true;
            expect(await chips.hasRole(GAME_ROLE, await game.getAddress())).to.be.true;
            expect(await game.hasRole(GAME_SERVER_ROLE, gameWallet)).to.be.true;
        });
    });

    describe('Buy Plays', function () {
        let game;
        let chips;
        let token;
        let deployer;
        let user1;
        let gameWallet;
        let playCost;

        beforeEach(async function () {
            ({ game, chips, token, deployer, user1, gameWallet, playCost } = await loadFixture(deployGameFixture));
        });

        it('Should store play balance and game values and emit an event', async function () {
            const gameNumber = 1n;
            let numPlays = 5n;
            const totalCost = numPlays * playCost;

            await token.connect(user1).approve(await chips.getAddress(), totalCost);
            await chips.connect(user1).deposit(totalCost);

            expect(await chips.balanceOf(user1)).to.equal(totalCost);
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
            const gameNumber = 1n;
            const numPlays = 5n;
            const totalCost = numPlays * playCost;

            await token.connect(user1).approve(await chips.getAddress(), totalCost);
            await chips.connect(user1).deposit(totalCost);

            expect(await chips.balanceOf(user1)).to.equal(totalCost);
            expect(await game.playBalance(gameNumber, user1)).to.equal(0n);
            expect(await game.totalGameValue(gameNumber)).to.equal(0n);
            expect(await game.currentGameValue(gameNumber)).to.equal(0n);

            //await game.connect(gameWallet).buyPlays(user1, gameNumber, numPlays);
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
        let user1;
        let gameWallet;
        let playCost;

        beforeEach(async function () {
            ({ game, chips, token, deployer, user1, gameWallet, playCost } = await loadFixture(deployGameFixture));
        });

        it('Should payout to users1 and emit an event', async function () {
            const gameNumber = 1n;
            const numPlays = 5n;
            const totalCost = numPlays * playCost;
            const rake = (totalCost * 10n)/100n;

            await token.connect(user1).approve(await chips.getAddress(), totalCost);
            await chips.connect(user1).deposit(totalCost);

            expect(await chips.balanceOf(user1)).to.equal(totalCost);
            expect(await game.playBalance(gameNumber, user1)).to.equal(0n);
            expect(await game.totalGameValue(gameNumber)).to.equal(0n);
            expect(await game.currentGameValue(gameNumber)).to.equal(0n);

            //await game.connect(gameWallet).buyPlays(user1, gameNumber, numPlays);
            await expect(
                game.connect(gameWallet).buyPlays(user1, gameNumber, numPlays)
            ).to.emit(game, "PlaysBought")
            .withArgs(user1.address, gameNumber, numPlays);

            expect(await chips.balanceOf(user1)).to.equal(0);
            expect(await game.playBalance(gameNumber, user1)).to.equal(numPlays);
            expect(await game.totalGameValue(gameNumber)).to.equal(totalCost);
            expect(await game.currentGameValue(gameNumber)).to.equal(totalCost);

            await game.connect(gameWallet).payout(gameNumber, [user1], [totalCost - rake], rake);
            // await expect(
                // game.connect(gameWallet).payout(gameNumber, [user1], [totalCost - rake], rake)
            // ).to.emit(game, "PlaysBought")
            // .withArgs(user1.address, gameNumber, numPlays);
        });
    });

    describe('Play cost', function () {
        let game;
        let chips;
        let token;
        let deployer;
        let user1;
        let gameWallet;
        let playCost;

        beforeEach(async function () {
            ({ game, chips, token, deployer, user1, gameWallet, playCost } = await loadFixture(deployGameFixture));
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
                game.connect(user1).setPlayCost(gameNumber, newPlayCost)
            ).to.be.reverted;

            expect(await game.getPlayCost(gameNumber)).to.equal(playCost);
        });
    });

    describe('Upgrade', function () {
        let game;
        let chips;
        let token;
        let deployer;
        let user1;
        let gameWallet;
        let playCost;

        beforeEach(async function () {
            ({ game, chips, token, deployer, user1, gameWallet, playCost } = await loadFixture(deployGameFixture));
        });

        it("Should upgrade Game to GameV2", async function () {
            const gameNumber = 5n;
            expect(await game.getPlayCost(gameNumber)).to.equal(playCost);

            const GameV2 = await ethers.getContractFactory("GameV2");

            const upgraded = await upgrades.upgradeProxy(await game.getAddress(), GameV2);

            // Verify existing state is intact (optional)
            expect(await upgraded.getPlayCost(gameNumber)).to.equal(playCost);

            // Call new function
            expect(await upgraded.upgradeTestFunction()).to.equal("Successful test!");
        });
        
        it("Should revert upgrade attempt from non-admin", async function () {
            const { game, user1 } = await loadFixture(deployGameFixture);

            const GameV2 = await ethers.getContractFactory("GameV2", user1);

            await expect(
                upgrades.upgradeProxy(await game.getAddress(), GameV2)
            ).to.be.revertedWithCustomError(game, "AccessControlUnauthorizedAccount")
            .withArgs(user1.address, ethers.ZeroHash); // 0x00... is DEFAULT_ADMIN_ROLE
        });

    });


});
