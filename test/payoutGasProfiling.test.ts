import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers, upgrades } from 'hardhat';
import { MockERC20 } from 'typechain-types';
import { GUnits } from 'typechain-types';

describe.skip('GUnits Gas Profiling', function () {
    this.timeout(0);

    const ROUNDS_SIZE = 10_000;
    const BATCH_SIZE = 10_000;

    async function deployFixtures() {
        const [devWallet, gameServer, user1, user2] = await ethers.getSigners();

        // Deploy mock token
        const MockToken = await ethers.getContractFactory('MockERC20');
        const mockToken = await MockToken.deploy('Mock Token', 'MTK');
        await mockToken.waitForDeployment();

        // Deploy GUnits as UUPS proxy
        const GUnitsFactory = await ethers.getContractFactory('GUnits');
        const chipsContract = await upgrades.deployProxy(
            GUnitsFactory,
            [await mockToken.getAddress(), false, devWallet.address],
            { initializer: 'initialize' }
        );
        await chipsContract.waitForDeployment();
        const chips = await ethers.getContractAt('GUnits', await chipsContract.getAddress());

        // Grant GAME_SERVER_ROLE to gameServer
        await chips.connect(devWallet).grantRole(await chips.GAME_SERVER_ROLE(), gameServer.address);

        return { chips, mockToken, devWallet, gameServer, user1, user2 };
    }

    async function depositGUnits(
        chips: GUnits,
        token: MockERC20,
        deployer: SignerWithAddress,
        wallet: SignerWithAddress,
        amount: bigint
    ) {
        const chainId = (await ethers.provider.getNetwork()).chainId;
        const contractAddress = await chips.getAddress();

        const data = ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'uint256', 'uint256', 'uint256', 'bool'],
            [contractAddress, chainId, amount, Math.floor(Date.now() / 1000) + 3600, false]
        );
        const nonce = 1;
        const message = ethers.solidityPacked(['address', 'bytes', 'uint256'], [wallet.address, data, nonce]);
        const messageHash = ethers.keccak256(message);
        const signature = await deployer.signMessage(ethers.getBytes(messageHash));

        await token.connect(wallet).approve(await chips.getAddress(), amount);
        await chips.connect(wallet).deposit(data, nonce, signature);
    }

    function generateGameSessionId(gameId: string, sessionId: string, roomId: string, userId: string): bigint {
        const abiCoder = new ethers.AbiCoder();
        const hash = ethers.keccak256(
            abiCoder.encode(
                ['string', 'string', 'string', 'string', 'uint256'],
                [gameId, sessionId, roomId, userId, Date.now()]
            )
        );
        // Convert hash to uint128 by taking the first 16 bytes
        return BigInt(hash.slice(0, 34)); // '0x' + 32 hex chars = 16 bytes = 128 bits
    }

    it(`Profiles gas for 1000 payouts`, async function () {
        const { chips, mockToken, devWallet, gameServer, user1, user2 } = await loadFixture(deployFixtures);
        const rakeFeeAmount = 0n;
        const winAmount = ethers.parseEther('45');
        const lockAmount = ethers.parseEther('50');
        const totalRoundsAmount = lockAmount * BigInt(ROUNDS_SIZE);
        const gameSessions = [];
        const payouts = [];
        const PAYOUT_ROUNDS = 10_000;
        for (let i = 0; i < PAYOUT_ROUNDS; i++) {
            const gameSessionId = generateGameSessionId(`game${i}`, `session${i}`, `room${i}`, `user${i}`);
            gameSessions.push(gameSessionId);
            const payout = [
                {
                    player: user1.address,
                    isWinner: false,
                    amount: winAmount,
                    gameSessionId: gameSessionId,
                },
                {
                    player: user2.address,
                    isWinner: true,
                    amount: winAmount,
                    gameSessionId: gameSessionId,
                },
            ];

            payouts.push(payout);
        }

        // Mint to gameServer for payouts
        await mockToken.connect(devWallet).mint(user1.address, totalRoundsAmount);
        await mockToken.connect(devWallet).mint(user2.address, totalRoundsAmount);
        await depositGUnits(chips, mockToken, devWallet, user1, totalRoundsAmount);
        await depositGUnits(chips, mockToken, devWallet, user2, totalRoundsAmount);

        console.log('Locking funds...');
        const lockPromises = []
        for (let i = 0; i < PAYOUT_ROUNDS; i++) {
            const lock1 = chips.connect(gameServer).lockFunds(user1.address, gameSessions[i], lockAmount);
            const lock2 = chips.connect(gameServer).lockFunds(user2.address, gameSessions[i], lockAmount);
            lockPromises.push(lock1, lock2);
        }
        await Promise.all(lockPromises);
        console.log('Funds locked');

        console.log('Paying out...');
        const payoutPromises = []
        for (let i = 0; i < PAYOUT_ROUNDS; i++) {
            const payout = chips.connect(gameServer).adminPayout(payouts[i], rakeFeeAmount);
            payoutPromises.push(payout);
        }
        await Promise.all(payoutPromises);
        console.log('Payout complete');
    });

    it(`Profiles gas for ${ROUNDS_SIZE} lock funds`, async function () {
        const { chips, mockToken, devWallet, gameServer, user1, user2 } = await loadFixture(deployFixtures);
        const lockAmount = ethers.parseEther('50');
        const totalRoundsAmount = lockAmount * BigInt(ROUNDS_SIZE);

        // Mint to gameServer for deposits
        await mockToken.connect(devWallet).mint(user1.address, totalRoundsAmount);
        await mockToken.connect(user1).approve(await chips.getAddress(), totalRoundsAmount);
        await depositGUnits(chips, mockToken, devWallet, user1, totalRoundsAmount);

        // Generate a game session ID
        const gameSessionId = generateGameSessionId('game1', 'session1', 'room1', user1.address);
        const promisesBatch = [];
        for (let i = 0; i < ROUNDS_SIZE; i += BATCH_SIZE) {
            console.log(`loading batch ${i / BATCH_SIZE + 1} of ${Math.ceil(ROUNDS_SIZE / BATCH_SIZE)}`);

            for (let j = 0; j < BATCH_SIZE; j++) {
                // Lock funds
                const promise = chips.connect(gameServer).lockFunds(user1.address, gameSessionId, lockAmount);
                promisesBatch.push(promise);
            }
            console.log(`processing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(ROUNDS_SIZE / BATCH_SIZE)}`);
            await Promise.all(promisesBatch);
            console.log(`batch ${i / BATCH_SIZE + 1} of ${Math.ceil(ROUNDS_SIZE / BATCH_SIZE)} processed \n`);
        }
        console.log('Locking funds complete');
    });

    it(`Profiles gas for ${ROUNDS_SIZE} deposits`, async function () {
        const { chips, mockToken, devWallet, gameServer, user1, user2 } = await loadFixture(deployFixtures);
        const depositAmount = ethers.parseEther('10');
        const totalDepositsAmount = depositAmount * BigInt(ROUNDS_SIZE);

        // Mint to gameServer for deposits
        await mockToken.connect(devWallet).mint(gameServer.address, totalDepositsAmount * 2n);
        await mockToken.connect(gameServer).approve(await chips.getAddress(), totalDepositsAmount * 2n);

        console.log('Depositing...');
        for (let i = 0; i < ROUNDS_SIZE; i += BATCH_SIZE) {
            console.log(`loading batch ${i / BATCH_SIZE + 1} of ${Math.ceil(ROUNDS_SIZE / BATCH_SIZE)}`);
            const promisesBatch = [];
            for (let j = 0; j < BATCH_SIZE; j++) {
                const promise = chips
                    .connect(gameServer)
                    .adminDeposit([user1.address, user2.address], [depositAmount, depositAmount]);
                promisesBatch.push(promise);
            }
            console.log(`processing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(ROUNDS_SIZE / BATCH_SIZE)}`);
            await Promise.all(promisesBatch);
            console.log(`batch ${i / BATCH_SIZE + 1} of ${Math.ceil(ROUNDS_SIZE / BATCH_SIZE)} processed \n`);
        }
        console.log('Deposit complete');
    });
});
