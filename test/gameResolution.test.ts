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
            ethers.keccak256(ethers.toUtf8Bytes("GAME_ROLE")),
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

            expect(await chips.hasRole(ADMIN_ROLE, deployer.address)).to.be.true;
            expect(await chips.hasRole(GAME_ROLE, await game.getAddress())).to.be.true;
            expect(await game.hasRole(GAME_ROLE, gameWallet)).to.be.true;
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

        it('Should store play balnce and emit an event', async function () {
            const gameNumber = 1n;
            const numPlays = 5n;
            const totalCost = numPlays * playCost;

            await token.connect(user1).approve(await chips.getAddress(), totalCost);
            await chips.connect(user1).deposit(totalCost);

            expect(await chips.balanceOf(user1)).to.equal(totalCost);

            //await game.connect(gameWallet).buyPlays(user1, gameNumber, numPlays);
            await expect(
                game.connect(gameWallet).buyPlays(user1, gameNumber, numPlays)
            ).to.emit(game, "PlaysBought")
            .withArgs(user1.address, gameNumber, numPlays);

            expect(await game.playBalance(gameNumber, user1)).to.equal(numPlays);
            expect(await chips.balanceOf(user1)).to.equal(0);
        });
    });

});
