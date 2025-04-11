import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

describe('HFG Game', function () {
    const ZERO_ADDRESS = ethers.ZeroAddress;

    async function deployGameFixture() {
        const [deployer, devWallet, adminWallet, managerWallet, multiSigWallet, user1, user2, recipient1] =
            await ethers.getSigners();

        // Mock or actual token address
        const Token = await ethers.getContractFactory("MockERC20");
        const token = await Token.deploy("TestToken", "TT");
        await token.waitForDeployment();

        // Deploy Chips
        const Chips = await ethers.getContractFactory("Chips");
        const chips = await upgrades.deployProxy(
            Chips,
            [await token.getAddress(), false],
            { initializer: "initialize", kind: "uups" }
        );
        await chips.waitForDeployment();

        // Deploy Game
        const Game = await ethers.getContractFactory("Game");
        const game = await upgrades.deployProxy(
            Game,
            [
            await token.getAddress(),
            await chips.getAddress(),
            deployer.address, // treasury
            ethers.parseUnits("1", 18), // play cost
            false, // isPaused
            ],
            { initializer: "initialize", kind: "uups" }
        );
        await game.waitForDeployment();

        await chips.connect(deployer).grantRole(
            ethers.keccak256(ethers.toUtf8Bytes("GAME_ROLE")),
            await game.getAddress()
        );

        console.log("Token deployed to:", await token.getAddress());
        console.log("Chips deployed to:", await chips.getAddress());
        console.log("Game deployed to:", await game.getAddress());

        return { game: game, chips: chips, deployer: deployer };
    }

    describe('Deployment', function () {
        it('Should deploy successfully', async function () {
            const { game, chips, deployer } = await loadFixture(deployGameFixture);
            expect(await game.getAddress()).to.be.properAddress;
        });

        it('Should set the correct roles', async function () {
            const { game, chips, deployer } = await loadFixture(deployGameFixture);

            const ADMIN_ROLE = await chips.DEFAULT_ADMIN_ROLE(); // or chips.ADMIN_ROLE() if that’s different
            const GAME_ROLE = await chips.GAME_ROLE();

            expect(await chips.hasRole(ADMIN_ROLE, deployer.address)).to.be.true;
            expect(await chips.hasRole(GAME_ROLE, await game.getAddress())).to.be.true;
        });
    });

});
