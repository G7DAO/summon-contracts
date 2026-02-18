import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

describe('RewardsManager', function () {
    const SERVER_ID = ethers.keccak256(ethers.toUtf8Bytes('server-1'));

    async function deployRewardsManagerFixture() {
        const [devWallet, managerWallet, user1, user2] = await ethers.getSigners();

        const RewardsManager = await ethers.getContractFactory('RewardsManager');
        const manager = await upgrades.deployProxy(
            RewardsManager,
            [devWallet.address, managerWallet.address],
            { kind: 'uups', initializer: 'initialize' }
        );
        await manager.waitForDeployment();

        const RewardsServerImpl = await ethers.getContractFactory('RewardsServer');
        const rewardsServerImpl = await RewardsServerImpl.deploy();
        await rewardsServerImpl.waitForDeployment();

        await manager.connect(devWallet).initializeBeacons(await rewardsServerImpl.getAddress());

        const RewardsFactory = await ethers.getContractFactory('RewardsFactory');
        const factory = await RewardsFactory.deploy(await manager.getAddress());
        await factory.waitForDeployment();
        await factory.setBeacons(await manager.treasuryBeacon());
        await manager.connect(devWallet).grantRole(await manager.FACTORY_ROLE(), await factory.getAddress());

        return {
            manager,
            factory,
            devWallet,
            managerWallet,
            user1,
            user2,
        };
    }

    describe('deployServer', function () {
        it('should deploy a server with RewardsServer', async function () {
            const { manager, factory, user1 } = await loadFixture(deployRewardsManagerFixture);
            await factory.connect(user1).deployServer(SERVER_ID);

            const serverAddr = await manager.getServer(SERVER_ID);
            expect(serverAddr).to.properAddress;
        });

        it('should revert when serverId already exists', async function () {
            const { manager, factory, user1 } = await loadFixture(deployRewardsManagerFixture);
            await factory.connect(user1).deployServer(SERVER_ID);
            await expect(factory.connect(user1).deployServer(SERVER_ID))
                .to.be.revertedWithCustomError(manager, 'ServerAlreadyExists');
        });

        it('should revert when serverId is zero', async function () {
            const { manager, factory, user1 } = await loadFixture(deployRewardsManagerFixture);
            await expect(factory.connect(user1).deployServer(ethers.ZeroHash))
                .to.be.revertedWithCustomError(manager, 'InvalidServerId');
        });
    });

    describe('server admin and signers', function () {
        it('server admin can set signer and withdrawer', async function () {
            const { manager, factory, user1, user2 } = await loadFixture(deployRewardsManagerFixture);
            await factory.connect(user1).deployServer(SERVER_ID);

            await manager.connect(user1).setServerSigner(SERVER_ID, user2.address, true);
            expect(await manager.isServerSigner(SERVER_ID, user2.address)).to.be.true;

            await manager.connect(user1).setServerWithdrawer(SERVER_ID, user2.address, true);
            expect(await manager.isServerWithdrawer(SERVER_ID, user2.address)).to.be.true;
        });

        it('non-admin cannot set signer', async function () {
            const { manager, factory, user1, user2 } = await loadFixture(deployRewardsManagerFixture);
            await factory.connect(user1).deployServer(SERVER_ID);
            const serverAddr = await manager.getServer(SERVER_ID);
            const server = await ethers.getContractAt('RewardsServer', serverAddr);
            await expect(
                manager.connect(user2).setServerSigner(SERVER_ID, user2.address, true)
            ).to.be.revertedWithCustomError(server, 'UnauthorizedServerAdmin');
        });
    });

    /** Build claim data and signature for claim(). Signer must be set as server signer. */
    async function buildClaimDataAndSignature(
        manager: Awaited<ReturnType<typeof ethers.getContractAt>>,
        serverId: string,
        signer: Awaited<ReturnType<typeof ethers.getSigners>>[0],
        beneficiary: string,
        tokenIds: number[],
        expiration: number,
        nonce: number
    ) {
        const chainId = (await ethers.provider.getNetwork()).chainId;
        const managerAddress = await manager.getAddress();
        const data = ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'uint256', 'address', 'uint256', 'uint256[]'],
            [managerAddress, chainId, beneficiary, expiration, tokenIds]
        );
        const messageHash = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'bytes32', 'address', 'uint256', 'uint256[]', 'uint256'],
                [managerAddress, chainId, serverId, beneficiary, expiration, tokenIds, nonce]
            )
        );
        const signature = await signer.signMessage(ethers.getBytes(messageHash));
        return { data, signature };
    }

    describe('treasury and reward flow', function () {
        async function deployWithServerAndTokenFixture() {
            const base = await loadFixture(deployRewardsManagerFixture);
            await base.factory.connect(base.user1).deployServer(SERVER_ID);
            await base.manager.connect(base.user1).setServerSigner(SERVER_ID, base.managerWallet.address, true);

            const MockERC20 = await ethers.getContractFactory('MockERC20');
            const mockERC20 = await MockERC20.deploy('Mock', 'M');
            await mockERC20.waitForDeployment();
            await mockERC20.mint(base.managerWallet.address, ethers.parseEther('10000'));

            await base.manager
                .connect(base.managerWallet)
                .whitelistToken(SERVER_ID, await mockERC20.getAddress(), 1); // ERC20
            await mockERC20
                .connect(base.managerWallet)
                .approve(await base.manager.getServer(SERVER_ID), ethers.parseEther('1000'));
            await base.manager
                .connect(base.managerWallet)
                .depositToTreasury(SERVER_ID, await mockERC20.getAddress(), ethers.parseEther('1000'));

            return { ...base, mockERC20 };
        }

        it('should whitelist token and deposit to server treasury', async function () {
            const { manager, managerWallet, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
            const balance = await manager.getServerTreasuryBalance(
                SERVER_ID,
                await mockERC20.getAddress()
            );
            expect(balance).to.equal(ethers.parseEther('1000'));
        });

        it('should create reward token and claim with signature', async function () {
            const { manager, managerWallet, user1, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
            const tokenId = 1;
            const rewardToken = {
                tokenId,
                tokenUri: 'https://example.com/1',
                maxSupply: 10,
                rewards: [
                    {
                        rewardType: 1, // ERC20
                        rewardAmount: ethers.parseEther('10'),
                        rewardTokenAddress: await mockERC20.getAddress(),
                        rewardTokenIds: [],
                        rewardTokenId: 0,
                    },
                ],
            };

            await manager
                .connect(managerWallet)
                .createTokenAndDepositRewards(SERVER_ID, rewardToken, { value: 0 });

            expect(await manager.isTokenExist(SERVER_ID, tokenId)).to.be.true;

            const expiration = Math.floor(Date.now() / 1000) + 3600;
            const { data, signature } = await buildClaimDataAndSignature(
                manager,
                SERVER_ID,
                managerWallet,
                user1.address,
                [tokenId],
                expiration,
                0
            );
            const before = await mockERC20.balanceOf(user1.address);
            await manager.connect(user1).claim(SERVER_ID, data, 0, signature);
            const after_ = await mockERC20.balanceOf(user1.address);
            expect(after_ - before).to.equal(ethers.parseEther('10'));
        });

        it('should allow multiple claims with different nonces', async function () {
            const { manager, managerWallet, user1, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
            const tokenId = 1;
            const rewardToken = {
                tokenId,
                tokenUri: 'https://example.com/1',
                maxSupply: 10,
                rewards: [
                    {
                        rewardType: 1,
                        rewardAmount: ethers.parseEther('10'),
                        rewardTokenAddress: await mockERC20.getAddress(),
                        rewardTokenIds: [],
                        rewardTokenId: 0,
                    },
                ],
            };
            await manager.connect(managerWallet).createTokenAndDepositRewards(SERVER_ID, rewardToken, { value: 0 });
            const expiration = Math.floor(Date.now() / 1000) + 3600;

            const { data: data1, signature: sig1 } = await buildClaimDataAndSignature(
                manager,
                SERVER_ID,
                managerWallet,
                user1.address,
                [tokenId],
                expiration,
                0
            );
            const { data: data2, signature: sig2 } = await buildClaimDataAndSignature(
                manager,
                SERVER_ID,
                managerWallet,
                user1.address,
                [tokenId],
                expiration,
                1
            );
            await manager.connect(user1).claim(SERVER_ID, data1, 0, sig1);
            await manager.connect(user1).claim(SERVER_ID, data2, 1, sig2);

            expect(await mockERC20.balanceOf(user1.address)).to.equal(ethers.parseEther('20'));
        });
    });
});
