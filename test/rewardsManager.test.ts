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

    describe('RewardsFactory ownership', function () {
        it('owner can call transferOwnership and pendingOwner is set', async function () {
            const { factory, devWallet, managerWallet } = await loadFixture(deployRewardsManagerFixture);
            expect(await factory.owner()).to.equal(devWallet.address);
            await factory.connect(devWallet).transferOwnership(managerWallet.address);
            expect(await factory.pendingOwner()).to.equal(managerWallet.address);
            expect(await factory.owner()).to.equal(devWallet.address);
        });

        it('non-owner cannot call transferOwnership or setBeacons', async function () {
            const { manager, factory, user1 } = await loadFixture(deployRewardsManagerFixture);
            await expect(
                factory.connect(user1).transferOwnership(user1.address)
            ).to.be.revertedWithCustomError(factory, 'Unauthorized');
            const RewardsFactory = await ethers.getContractFactory('RewardsFactory');
            const newFactory = await RewardsFactory.deploy(await manager.getAddress());
            await newFactory.waitForDeployment();
            await expect(
                newFactory.connect(user1).setBeacons(await factory.treasuryBeacon())
            ).to.be.revertedWithCustomError(newFactory, 'Unauthorized');
        });

        it('only pendingOwner can call acceptOwnership; owner and pendingOwner updated', async function () {
            const { factory, devWallet, managerWallet, user1 } = await loadFixture(deployRewardsManagerFixture);
            await factory.connect(devWallet).transferOwnership(managerWallet.address);
            await expect(factory.connect(user1).acceptOwnership()).to.be.revertedWithCustomError(factory, 'Unauthorized');
            await factory.connect(managerWallet).acceptOwnership();
            expect(await factory.owner()).to.equal(managerWallet.address);
            expect(await factory.pendingOwner()).to.equal(ethers.ZeroAddress);
        });

        it('after transfer old owner cannot call setBeacons', async function () {
            const { manager, factory, devWallet, managerWallet } = await loadFixture(deployRewardsManagerFixture);
            const beaconAddr = await factory.treasuryBeacon();
            const RewardsFactory = await ethers.getContractFactory('RewardsFactory');
            const factory2 = await RewardsFactory.deploy(await manager.getAddress());
            await factory2.waitForDeployment();
            expect(await factory2.owner()).to.equal(devWallet.address);
            await factory2.connect(devWallet).transferOwnership(managerWallet.address);
            await factory2.connect(managerWallet).acceptOwnership();
            expect(await factory2.owner()).to.equal(managerWallet.address);
            await expect(factory2.connect(devWallet).setBeacons(beaconAddr)).to.be.revertedWithCustomError(
                factory2,
                'Unauthorized'
            );
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

        describe('ETHER reward flow', function () {
            it('creates ETHER reward token, claim sends ETH to beneficiary', async function () {
                const { manager, managerWallet, user1 } = await loadFixture(deployWithServerAndTokenFixture);
                const tokenId = 2;
                const rewardAmount = ethers.parseEther('0.5');
                const rewardToken = {
                    tokenId,
                    tokenUri: 'https://example.com/eth',
                    maxSupply: 2,
                    rewards: [
                        {
                            rewardType: 0, // ETHER
                            rewardAmount,
                            rewardTokenAddress: ethers.ZeroAddress,
                            rewardTokenIds: [],
                            rewardTokenId: 0,
                        },
                    ],
                };
                const ethRequired = rewardAmount * 2n; // maxSupply 2
                await manager
                    .connect(managerWallet)
                    .createTokenAndDepositRewards(SERVER_ID, rewardToken, { value: ethRequired });
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
                const before = await ethers.provider.getBalance(user1.address);
                const tx = await manager.connect(user1).claim(SERVER_ID, data, 0, signature);
                const receipt = await tx.wait();
                const gasCost = receipt!.gasUsed * receipt!.gasPrice;
                const after_ = await ethers.provider.getBalance(user1.address);
                expect(after_ - (before - gasCost)).to.equal(rewardAmount);
            });

            it('MANAGER_ROLE can withdraw unreserved ETHER from manager', async function () {
                const { manager, managerWallet, user1 } = await loadFixture(deployWithServerAndTokenFixture);
                const tokenId = 3;
                const rewardToken = {
                    tokenId,
                    tokenUri: 'https://example.com/eth2',
                    maxSupply: 1,
                    rewards: [
                        {
                            rewardType: 0,
                            rewardAmount: ethers.parseEther('1'),
                            rewardTokenAddress: ethers.ZeroAddress,
                            rewardTokenIds: [],
                            rewardTokenId: 0,
                        },
                    ],
                };
                await manager
                    .connect(managerWallet)
                    .createTokenAndDepositRewards(SERVER_ID, rewardToken, { value: ethers.parseEther('1') });
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
                await manager.connect(user1).claim(SERVER_ID, data, 0, signature);
                const extraEth = ethers.parseEther('0.3');
                await managerWallet.sendTransaction({
                    to: await manager.getAddress(),
                    value: extraEth,
                });
                const before = await ethers.provider.getBalance(user1.address);
                await manager
                    .connect(managerWallet)
                    .withdrawAssets(
                        SERVER_ID,
                        0, // ETHER
                        user1.address,
                        ethers.ZeroAddress,
                        [],
                        [extraEth]
                    );
                const after_ = await ethers.provider.getBalance(user1.address);
                expect(after_ - before).to.equal(extraEth);
            });
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

        it('allows relayer to submit claim: rewards go to beneficiary in data', async function () {
            const { manager, managerWallet, user1, user2, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
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
            await manager.connect(user2).claim(SERVER_ID, data, 0, signature);
            const after_ = await mockERC20.balanceOf(user1.address);
            expect(after_ - before).to.equal(ethers.parseEther('10'));
        });

        describe('ERC721 reward flow', function () {
            it('creates ERC721 reward token, claim sends NFT to beneficiary and advances index', async function () {
                const { manager, managerWallet, user1 } = await loadFixture(deployWithServerAndTokenFixture);
                const MockERC721 = await ethers.getContractFactory('MockERC721');
                const mockERC721 = await MockERC721.deploy();
                await mockERC721.waitForDeployment();
                const serverAddr = await manager.getServer(SERVER_ID);
                await manager.connect(managerWallet).whitelistToken(SERVER_ID, await mockERC721.getAddress(), 2); // ERC721
                for (let i = 0; i < 3; i++) {
                    await mockERC721.mint(managerWallet.address);
                }
                await mockERC721.connect(managerWallet).setApprovalForAll(serverAddr, true);
                await mockERC721.connect(managerWallet).transferFrom(managerWallet.address, serverAddr, 0);
                await mockERC721.connect(managerWallet).transferFrom(managerWallet.address, serverAddr, 1);
                await mockERC721.connect(managerWallet).transferFrom(managerWallet.address, serverAddr, 2);
                const tokenId = 10;
                const rewardToken = {
                    tokenId,
                    tokenUri: 'https://example.com/nft',
                    maxSupply: 3,
                    rewards: [
                        {
                            rewardType: 2, // ERC721
                            rewardAmount: 1,
                            rewardTokenAddress: await mockERC721.getAddress(),
                            rewardTokenIds: [0, 1, 2],
                            rewardTokenId: 0,
                        },
                    ],
                };
                await manager.connect(managerWallet).createTokenAndDepositRewards(SERVER_ID, rewardToken, { value: 0 });
                const expiration = Math.floor(Date.now() / 1000) + 3600;
                const { data: data0, signature: sig0 } = await buildClaimDataAndSignature(
                    manager,
                    SERVER_ID,
                    managerWallet,
                    user1.address,
                    [tokenId],
                    expiration,
                    0
                );
                await manager.connect(user1).claim(SERVER_ID, data0, 0, sig0);
                expect(await mockERC721.ownerOf(0)).to.equal(user1.address);
                const { data: data1, signature: sig1 } = await buildClaimDataAndSignature(
                    manager,
                    SERVER_ID,
                    managerWallet,
                    user1.address,
                    [tokenId],
                    expiration,
                    1
                );
                await manager.connect(user1).claim(SERVER_ID, data1, 1, sig1);
                expect(await mockERC721.ownerOf(1)).to.equal(user1.address);
            });
        });

        describe('ERC1155 reward flow', function () {
            it('creates ERC1155 reward token, claim sends tokens to beneficiary', async function () {
                const { manager, managerWallet, user1 } = await loadFixture(deployWithServerAndTokenFixture);
                const MockERC1155 = await ethers.getContractFactory('MockERC1155');
                const mockERC1155 = await MockERC1155.deploy();
                await mockERC1155.waitForDeployment();
                const serverAddr = await manager.getServer(SERVER_ID);
                await manager.connect(managerWallet).whitelistToken(SERVER_ID, await mockERC1155.getAddress(), 3); // ERC1155
                const erc1155TokenId = 42;
                const amount = 100n;
                await mockERC1155.mint(managerWallet.address, erc1155TokenId, amount, '0x');
                await mockERC1155.connect(managerWallet).setApprovalForAll(serverAddr, true);
                await mockERC1155
                    .connect(managerWallet)
                    .safeTransferFrom(managerWallet.address, serverAddr, erc1155TokenId, amount, '0x');
                const rewardTokenId = 20;
                const rewardToken = {
                    tokenId: rewardTokenId,
                    tokenUri: 'https://example.com/1155',
                    maxSupply: 5,
                    rewards: [
                        {
                            rewardType: 3, // ERC1155
                            rewardAmount: 10,
                            rewardTokenAddress: await mockERC1155.getAddress(),
                            rewardTokenIds: [],
                            rewardTokenId: erc1155TokenId,
                        },
                    ],
                };
                await manager.connect(managerWallet).createTokenAndDepositRewards(SERVER_ID, rewardToken, { value: 0 });
                const expiration = Math.floor(Date.now() / 1000) + 3600;
                const { data, signature } = await buildClaimDataAndSignature(
                    manager,
                    SERVER_ID,
                    managerWallet,
                    user1.address,
                    [rewardTokenId],
                    expiration,
                    0
                );
                await manager.connect(user1).claim(SERVER_ID, data, 0, signature);
                expect(await mockERC1155.balanceOf(user1.address, erc1155TokenId)).to.equal(10);
            });
        });
    });

    describe('access control', function () {
        it('non-MANAGER cannot call whitelistToken', async function () {
            const { manager, factory, user1, user2 } = await loadFixture(deployRewardsManagerFixture);
            await factory.connect(user1).deployServer(SERVER_ID);
            const MockERC20 = await ethers.getContractFactory('MockERC20');
            const mockERC20 = await MockERC20.deploy('M', 'M');
            await mockERC20.waitForDeployment();
            await expect(
                manager.connect(user2).whitelistToken(SERVER_ID, await mockERC20.getAddress(), 1)
            ).to.be.revertedWithCustomError(manager, 'AccessControlUnauthorizedAccount');
        });

        it('non-MANAGER cannot call createTokenAndDepositRewards', async function () {
            const base = await loadFixture(deployRewardsManagerFixture);
            await base.factory.connect(base.user1).deployServer(SERVER_ID);
            const MockERC20 = await ethers.getContractFactory('MockERC20');
            const mockERC20 = await MockERC20.deploy('M', 'M');
            await mockERC20.waitForDeployment();
            await base.manager.connect(base.managerWallet).whitelistToken(SERVER_ID, await mockERC20.getAddress(), 1);
            const rewardToken = {
                tokenId: 1,
                tokenUri: 'u',
                maxSupply: 1,
                rewards: [
                    {
                        rewardType: 1,
                        rewardAmount: 1,
                        rewardTokenAddress: await mockERC20.getAddress(),
                        rewardTokenIds: [],
                        rewardTokenId: 0,
                    },
                ],
            };
            await expect(
                base.manager.connect(base.user1).createTokenAndDepositRewards(SERVER_ID, rewardToken, { value: 0 })
            ).to.be.revertedWithCustomError(base.manager, 'AccessControlUnauthorizedAccount');
        });

        it('non-MANAGER cannot call withdrawAssets', async function () {
            const base = await loadFixture(deployRewardsManagerFixture);
            await base.factory.connect(base.user1).deployServer(SERVER_ID);
            await expect(
                base.manager
                    .connect(base.user1)
                    .withdrawAssets(SERVER_ID, 1, base.user2.address, ethers.ZeroAddress, [], [])
            ).to.be.revertedWithCustomError(base.manager, 'AccessControlUnauthorizedAccount');
        });

        it('non-MANAGER cannot call pause', async function () {
            const { manager, user1 } = await loadFixture(deployRewardsManagerFixture);
            await expect(manager.connect(user1).pause()).to.be.revertedWithCustomError(
                manager,
                'AccessControlUnauthorizedAccount'
            );
        });

        it('only FACTORY_ROLE can call registerServer', async function () {
            const { manager, user1 } = await loadFixture(deployRewardsManagerFixture);
            const RewardsServerImpl = await ethers.getContractFactory('RewardsServer');
            const impl = await RewardsServerImpl.deploy();
            await impl.waitForDeployment();
            const serverId2 = ethers.keccak256(ethers.toUtf8Bytes('server-2'));
            await expect(
                manager.connect(user1).registerServer(serverId2, await impl.getAddress())
            ).to.be.revertedWithCustomError(manager, 'AccessControlUnauthorizedAccount');
        });
    });
});
