import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers, upgrades } from 'hardhat';
import { MockERC20 } from 'typechain-types';
import { GUnits } from 'typechain-types';

describe.skip('GUnits Gas Profiling', function () {
    this.timeout(0);

    const ROUNDS_SIZE = 100_000;
    const BATCH_SIZE = 10_000;
    const BET_AMOUNT = ethers.parseEther('10');

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

    it(`Profiles gas for ${ROUNDS_SIZE} payouts`, async function () {
        const { chips, mockToken, devWallet, gameServer, user1, user2 } = await loadFixture(deployFixtures);
        const rakePercentage = 10n;
        const totalRoundsAmount = BET_AMOUNT * BigInt(ROUNDS_SIZE);

        // Mint to gameServer for payouts
        await mockToken.connect(devWallet).mint(user1.address, totalRoundsAmount * 2n);
        await mockToken.connect(devWallet).mint(user2.address, totalRoundsAmount * 2n);
        await depositGUnits(chips, mockToken, devWallet, user1, totalRoundsAmount);
        await depositGUnits(chips, mockToken, devWallet, user2, totalRoundsAmount);

        console.log('Paying out...');
        for (let i = 0; i < ROUNDS_SIZE; i += BATCH_SIZE) {
            console.log(`loading batch ${i / BATCH_SIZE + 1} of ${Math.ceil(ROUNDS_SIZE / BATCH_SIZE)}`);
            const promisesBatch = [];
            for (let j = 0; j < BATCH_SIZE; j++) {
                const promise = chips
                    .connect(gameServer)
                    .adminPayout(BET_AMOUNT, rakePercentage, [user1.address, user2.address], [user1.address]);
                promisesBatch.push(promise);
            }
            console.log(`processing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(ROUNDS_SIZE / BATCH_SIZE)}`);
            await Promise.all(promisesBatch);
            console.log(`batch ${i / BATCH_SIZE + 1} of ${Math.ceil(ROUNDS_SIZE / BATCH_SIZE)} processed \n`);
        }
        console.log('Payout complete');
    });

    it(`Profiles gas for ${ROUNDS_SIZE} deposits`, async function () {
        const { chips, mockToken, devWallet, gameServer, user1, user2 } = await loadFixture(deployFixtures);
        const totalDepositsAmount = BET_AMOUNT * BigInt(ROUNDS_SIZE);

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
                    .adminDeposit([user1.address, user2.address], [BET_AMOUNT, BET_AMOUNT]);
                promisesBatch.push(promise);
            }
            console.log(`processing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(ROUNDS_SIZE / BATCH_SIZE)}`);
            await Promise.all(promisesBatch);
            console.log(`batch ${i / BATCH_SIZE + 1} of ${Math.ceil(ROUNDS_SIZE / BATCH_SIZE)} processed \n`);
        }
        console.log('Deposit complete');
    });
});
