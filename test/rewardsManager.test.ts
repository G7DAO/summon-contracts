import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

/**
 * RewardsRouter + RewardsServer tests.
 * Security assumptions covered: (1) Claim signatures use per-user nonce for replay protection; no on-chain expiry.
 * (2) Claim data encodes contractAddress and chainId so claims are bound to the correct server and chain.
 * (3) depositToTreasury is permissionless; only SERVER_ADMIN can withdraw. (4) Signature for one server cannot
 * be replayed on another (contractAddress check in server.claim).
 */
describe('RewardsRouter', function () {
    const SERVER_ID = 1;

    async function deployRewardsManagerFixture() {
        const [devWallet, managerWallet, user1, user2] = await ethers.getSigners();

        const RewardsRouter = await ethers.getContractFactory('RewardsRouter');
        const manager = await upgrades.deployProxy(
            RewardsRouter,
            [devWallet.address, managerWallet.address],
            { kind: 'uups', initializer: 'initialize' }
        );
        await manager.waitForDeployment();

        const RewardsServerImpl = await ethers.getContractFactory('RewardsServer');
        const rewardsServerImpl = await RewardsServerImpl.deploy();
        await rewardsServerImpl.waitForDeployment();

        await manager.connect(devWallet).initializeBeacons(await rewardsServerImpl.getAddress());

        return {
            manager,
            devWallet,
            managerWallet,
            user1,
            user2,
        };
    }

    async function deployWithServerAndTokenFixture() {
        const base = await loadFixture(deployRewardsManagerFixture);
        await base.manager.connect(base.managerWallet).deployServer(SERVER_ID, base.devWallet.address);
        const serverAddr = await base.manager.getServer(SERVER_ID);
        const server = await ethers.getContractAt('RewardsServer', serverAddr);
        const SERVER_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes('SERVER_ADMIN_ROLE'));
        await server.connect(base.devWallet).grantRole(SERVER_ADMIN_ROLE, base.managerWallet.address);
        await server.connect(base.managerWallet).setSigner(base.managerWallet.address, true);

        const MockERC20 = await ethers.getContractFactory('MockERC20');
        const mockERC20 = await MockERC20.deploy('Mock', 'M');
        await mockERC20.waitForDeployment();
        await mockERC20.mint(base.managerWallet.address, ethers.parseEther('10000'));

        await server.connect(base.managerWallet).whitelistToken(await mockERC20.getAddress(), 1); // ERC20
        await mockERC20.connect(base.managerWallet).approve(serverAddr, ethers.parseEther('1000'));
        await server.connect(base.managerWallet).depositToTreasury(await mockERC20.getAddress(), ethers.parseEther('1000'), base.managerWallet.address);

        return { ...base, server, mockERC20 };
    }

    describe('initializeBeacons', function () {
        it('DEV_CONFIG_ROLE can call initializeBeacons with non-zero implementation', async function () {
            const [devWallet, managerWallet] = await ethers.getSigners();
            const RewardsRouter = await ethers.getContractFactory('RewardsRouter');
            const router = await upgrades.deployProxy(
                RewardsRouter,
                [devWallet.address, managerWallet.address],
                { kind: 'uups', initializer: 'initialize' }
            );
            await router.waitForDeployment();
            const RewardsServerImpl = await ethers.getContractFactory('RewardsServer');
            const impl = await RewardsServerImpl.deploy();
            await impl.waitForDeployment();
            const implAddress = await impl.getAddress();
            expect(await router.serverBeacon()).to.equal(ethers.ZeroAddress);
            await router.connect(devWallet).initializeBeacons(implAddress);
            expect(await router.serverBeacon()).to.not.equal(ethers.ZeroAddress);
        });

        it('reverts with AddressIsZero when implementation is zero', async function () {
            const [devWallet, managerWallet] = await ethers.getSigners();
            const RewardsRouter = await ethers.getContractFactory('RewardsRouter');
            const router = await upgrades.deployProxy(
                RewardsRouter,
                [devWallet.address, managerWallet.address],
                { kind: 'uups', initializer: 'initialize' }
            );
            await router.waitForDeployment();
            await expect(router.connect(devWallet).initializeBeacons(ethers.ZeroAddress))
                .to.be.revertedWithCustomError(router, 'AddressIsZero');
        });

        it('reverts with BeaconsAlreadyInitialized when called twice', async function () {
            const { manager, devWallet, managerWallet } = await loadFixture(deployRewardsManagerFixture);
            const RewardsServerImpl = await ethers.getContractFactory('RewardsServer');
            const impl2 = await RewardsServerImpl.deploy();
            await impl2.waitForDeployment();
            await expect(manager.connect(devWallet).initializeBeacons(await impl2.getAddress()))
                .to.be.revertedWithCustomError(manager, 'BeaconsAlreadyInitialized');
        });
    });

    describe('deployServer', function () {
        it('should deploy a server with RewardsServer', async function () {
            const { manager, devWallet, managerWallet } = await loadFixture(deployRewardsManagerFixture);
            await manager.connect(managerWallet).deployServer(SERVER_ID, devWallet.address);

            const serverAddr = await manager.getServer(SERVER_ID);
            expect(serverAddr).to.properAddress;
        });

        it('should revert when serverId already exists', async function () {
            const { manager, devWallet, managerWallet } = await loadFixture(deployRewardsManagerFixture);
            await manager.connect(managerWallet).deployServer(SERVER_ID, devWallet.address);
            await expect(manager.connect(managerWallet).deployServer(SERVER_ID, devWallet.address))
                .to.be.revertedWithCustomError(manager, 'ServerAlreadyExists');
        });

        it('should revert when serverId is zero', async function () {
            const { manager, devWallet, managerWallet } = await loadFixture(deployRewardsManagerFixture);
            await expect(manager.connect(managerWallet).deployServer(0, devWallet.address))
                .to.be.revertedWithCustomError(manager, 'InvalidServerId');
        });

        it('reverts with BeaconNotInitialized when beacons not set', async function () {
            const [devWallet, managerWallet] = await ethers.getSigners();
            const RewardsRouter = await ethers.getContractFactory('RewardsRouter');
            const router = await upgrades.deployProxy(
                RewardsRouter,
                [devWallet.address, managerWallet.address],
                { kind: 'uups', initializer: 'initialize' }
            );
            await router.waitForDeployment();
            await expect(router.connect(managerWallet).deployServer(SERVER_ID, devWallet.address))
                .to.be.revertedWithCustomError(router, 'BeaconNotInitialized');
        });
    });

    // RewardsFactory ownership tests removed: deployment is now handled directly by RewardsManager.deployServer.

    describe('server admin and signers', function () {
        it('server admin can set signer', async function () {
            const { manager, devWallet, managerWallet, user1, user2 } = await loadFixture(deployRewardsManagerFixture);
            await manager.connect(managerWallet).deployServer(SERVER_ID, devWallet.address);
            const serverAddr = await manager.getServer(SERVER_ID);
            const server = await ethers.getContractAt('RewardsServer', serverAddr);
            const SERVER_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes('SERVER_ADMIN_ROLE'));
            await server.connect(devWallet).grantRole(SERVER_ADMIN_ROLE, user1.address);

            await server.connect(user1).setSigner(user2.address, true);
            expect(await manager.getServerSigners(SERVER_ID)).to.include(user2.address);
        });

        it('non-admin cannot set signer', async function () {
            const { manager, devWallet, managerWallet, user1, user2 } = await loadFixture(deployRewardsManagerFixture);
            await manager.connect(managerWallet).deployServer(SERVER_ID, devWallet.address);
            const serverAddr = await manager.getServer(SERVER_ID);
            const server = await ethers.getContractAt('RewardsServer', serverAddr);
            const SERVER_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes('SERVER_ADMIN_ROLE'));
            await server.connect(devWallet).grantRole(SERVER_ADMIN_ROLE, user1.address);
            await expect(server.connect(user2).setSigner(user2.address, true))
                .to.be.revertedWithCustomError(server, 'AccessControlUnauthorizedAccount');
        });
    });

    /** Build claim data and signature for claim(). Targets the given server; signer must be a server signer. */
    async function buildClaimDataAndSignature(
        serverAddress: string,
        serverId: number,
        signer: Awaited<ReturnType<typeof ethers.getSigners>>[0],
        beneficiary: string,
        tokenIds: number[],
        userNonce: number
    ) {
        const chainId = (await ethers.provider.getNetwork()).chainId;
        const data = ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'uint256', 'address', 'uint256', 'uint8', 'uint256[]'],
            [serverAddress, chainId, beneficiary, BigInt(userNonce), serverId, tokenIds]
        );
        const messageHash = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'uint8', 'address', 'uint256', 'uint256[]'],
                [serverAddress, chainId, serverId, beneficiary, BigInt(userNonce), tokenIds]
            )
        );
        const signature = await signer.signMessage(ethers.getBytes(messageHash));
        return { data, signature };
    }

    describe('treasury and reward flow', function () {
        it('should whitelist token and deposit to server treasury', async function () {
            const { manager, managerWallet, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
            const balance = await manager.getServerTreasuryBalance(
                SERVER_ID,
                await mockERC20.getAddress()
            );
            expect(balance).to.equal(ethers.parseEther('1000'));
        });

        it('should create reward token and claim with signature', async function () {
            const { manager, server, managerWallet, user1, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
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

            await server.connect(managerWallet).createTokenAndReserveRewards(rewardToken, { value: 0 });

            expect(await manager.isTokenExist(SERVER_ID, tokenId)).to.be.true;

            const { data, signature } = await buildClaimDataAndSignature(
                await server.getAddress(),
                SERVER_ID,
                managerWallet,
                user1.address,
                [tokenId],
                0
            );
            const before = await mockERC20.balanceOf(user1.address);
            await manager.connect(user1).claim(SERVER_ID, data, signature);
            const after_ = await mockERC20.balanceOf(user1.address);
            expect(after_ - before).to.equal(ethers.parseEther('10'));
        });

        describe('ETHER reward flow', function () {
            it('creates ETHER reward token, claim sends ETH to beneficiary', async function () {
                const { manager, server, managerWallet, user1 } = await loadFixture(deployWithServerAndTokenFixture);
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
                await server.connect(managerWallet).createTokenAndReserveRewards(rewardToken, { value: ethRequired });
                const { data, signature } = await buildClaimDataAndSignature(
                    await server.getAddress(),
                    SERVER_ID,
                    managerWallet,
                    user1.address,
                    [tokenId],
                    0
                );
                const before = await ethers.provider.getBalance(user1.address);
                const tx = await manager.connect(user1).claim(SERVER_ID, data, signature);
                const receipt = await tx.wait();
                const gasCost = receipt!.gasUsed * receipt!.gasPrice;
                const after_ = await ethers.provider.getBalance(user1.address);
                expect(after_ - (before - gasCost)).to.equal(rewardAmount);
            });

            it('SERVER_ADMIN can withdraw unreserved ETHER from server treasury', async function () {
                const { manager, server, managerWallet, user1 } = await loadFixture(deployWithServerAndTokenFixture);
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
                await server.connect(managerWallet).createTokenAndReserveRewards(rewardToken, { value: ethers.parseEther('1') });
                const { data, signature } = await buildClaimDataAndSignature(
                    await server.getAddress(),
                    SERVER_ID,
                    managerWallet,
                    user1.address,
                    [tokenId],
                    0
                );
                await manager.connect(user1).claim(SERVER_ID, data, signature);
                const extraEth = ethers.parseEther('0.3');
                const serverAddr = await manager.getServer(SERVER_ID);
                await managerWallet.sendTransaction({
                    to: serverAddr,
                    value: extraEth,
                });
                const before = await ethers.provider.getBalance(user1.address);
                await server.connect(managerWallet).withdrawAssets(
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
            const { manager, server, managerWallet, user1, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
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
            await server.connect(managerWallet).createTokenAndReserveRewards(rewardToken, { value: 0 });
            const { data: data1, signature: sig1 } = await buildClaimDataAndSignature(
                await server.getAddress(),
                SERVER_ID,
                managerWallet,
                user1.address,
                [tokenId],
                0
            );
            const { data: data2, signature: sig2 } = await buildClaimDataAndSignature(
                await server.getAddress(),
                SERVER_ID,
                managerWallet,
                user1.address,
                [tokenId],
                1
            );
            await manager.connect(user1).claim(SERVER_ID, data1, sig1);
            await manager.connect(user1).claim(SERVER_ID, data2, sig2);

            expect(await mockERC20.balanceOf(user1.address)).to.equal(ethers.parseEther('20'));
        });

        it('allows relayer to submit claim: rewards go to beneficiary in data', async function () {
            const { manager, server, managerWallet, user1, user2, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
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
            await server.connect(managerWallet).createTokenAndReserveRewards(rewardToken, { value: 0 });
            const { data, signature } = await buildClaimDataAndSignature(
                await server.getAddress(),
                SERVER_ID,
                managerWallet,
                user1.address,
                [tokenId],
                0
            );
            const before = await mockERC20.balanceOf(user1.address);
            await manager.connect(user2).claim(SERVER_ID, data, signature);
            const after_ = await mockERC20.balanceOf(user1.address);
            expect(after_ - before).to.equal(ethers.parseEther('10'));
        });

        describe('ERC721 reward flow', function () {
            it('creates ERC721 reward token, claim sends NFT to beneficiary and advances index', async function () {
                const { manager, server, managerWallet, user1 } = await loadFixture(deployWithServerAndTokenFixture);
                const MockERC721 = await ethers.getContractFactory('MockERC721');
                const mockERC721 = await MockERC721.deploy();
                await mockERC721.waitForDeployment();
                const serverAddr = await server.getAddress();
                await server.connect(managerWallet).whitelistToken(await mockERC721.getAddress(), 2); // ERC721
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
                await server.connect(managerWallet).createTokenAndReserveRewards(rewardToken, { value: 0 });
                const { data: data0, signature: sig0 } = await buildClaimDataAndSignature(
                    serverAddr,
                    SERVER_ID,
                    managerWallet,
                    user1.address,
                    [tokenId],
                    0
                );
                await manager.connect(user1).claim(SERVER_ID, data0, sig0);
                expect(await mockERC721.ownerOf(0)).to.equal(user1.address);
                const { data: data1, signature: sig1 } = await buildClaimDataAndSignature(
                    serverAddr,
                    SERVER_ID,
                    managerWallet,
                    user1.address,
                    [tokenId],
                    1
                );
                await manager.connect(user1).claim(SERVER_ID, data1, sig1);
                expect(await mockERC721.ownerOf(1)).to.equal(user1.address);
            });
        });

        describe('ERC1155 reward flow', function () {
            it('creates ERC1155 reward token, claim sends tokens to beneficiary', async function () {
                const { manager, server, managerWallet, user1 } = await loadFixture(deployWithServerAndTokenFixture);
                const MockERC1155 = await ethers.getContractFactory('MockERC1155');
                const mockERC1155 = await MockERC1155.deploy();
                await mockERC1155.waitForDeployment();
                const serverAddr = await server.getAddress();
                await server.connect(managerWallet).whitelistToken(await mockERC1155.getAddress(), 3); // ERC1155
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
                await server.connect(managerWallet).createTokenAndReserveRewards(rewardToken, { value: 0 });
                const { data, signature } = await buildClaimDataAndSignature(
                    serverAddr,
                    SERVER_ID,
                    managerWallet,
                    user1.address,
                    [rewardTokenId],
                    0
                );
                await manager.connect(user1).claim(SERVER_ID, data, signature);
                expect(await mockERC1155.balanceOf(user1.address, erc1155TokenId)).to.equal(10);
            });
        });
    });

    describe('security assumptions', function () {
        it('depositToTreasury is permissionless; only SERVER_ADMIN can withdraw', async function () {
            const { manager, server, managerWallet, user1, user2, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
            const extra = ethers.parseEther('100');
            await mockERC20.mint(user2.address, extra);
            await mockERC20.connect(user2).approve(await server.getAddress(), extra);
            await server.connect(user2).depositToTreasury(await mockERC20.getAddress(), extra, user2.address);
            expect(await manager.getServerTreasuryBalance(SERVER_ID, await mockERC20.getAddress())).to.be.gte(ethers.parseEther('1100'));
            await expect(
                server.connect(user2).withdrawAssets(1, user2.address, await mockERC20.getAddress(), [], [])
            ).to.be.revertedWithCustomError(server, 'AccessControlUnauthorizedAccount');
        });
    });

    describe('access control', function () {
        it('non-server-admin cannot call whitelistToken', async function () {
            const { manager, devWallet, managerWallet, user1, user2 } = await loadFixture(deployRewardsManagerFixture);
            await manager.connect(managerWallet).deployServer(SERVER_ID, devWallet.address);
            const serverAddr = await manager.getServer(SERVER_ID);
            const server = await ethers.getContractAt('RewardsServer', serverAddr);
            const SERVER_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes('SERVER_ADMIN_ROLE'));
            await server.connect(devWallet).grantRole(SERVER_ADMIN_ROLE, user1.address);
            const MockERC20 = await ethers.getContractFactory('MockERC20');
            const mockERC20 = await MockERC20.deploy('M', 'M');
            await mockERC20.waitForDeployment();
            await expect(
                server.connect(user2).whitelistToken(await mockERC20.getAddress(), 1)
            ).to.be.revertedWithCustomError(server, 'AccessControlUnauthorizedAccount');
        });

        it('non-server-admin cannot call createTokenAndReserveRewards', async function () {
            const base = await loadFixture(deployRewardsManagerFixture);
            await base.manager.connect(base.managerWallet).deployServer(SERVER_ID, base.devWallet.address);
            const serverAddr = await base.manager.getServer(SERVER_ID);
            const server = await ethers.getContractAt('RewardsServer', serverAddr);
            const SERVER_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes('SERVER_ADMIN_ROLE'));
            await server.connect(base.devWallet).grantRole(SERVER_ADMIN_ROLE, base.user1.address);
            const MockERC20 = await ethers.getContractFactory('MockERC20');
            const mockERC20 = await MockERC20.deploy('M', 'M');
            await mockERC20.waitForDeployment();
            await server.connect(base.user1).whitelistToken(await mockERC20.getAddress(), 1);
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
                server.connect(base.user2).createTokenAndReserveRewards(rewardToken, { value: 0 })
            ).to.be.revertedWithCustomError(server, 'AccessControlUnauthorizedAccount');
        });

        it('non-server-admin cannot call withdrawAssets', async function () {
            const base = await loadFixture(deployRewardsManagerFixture);
            await base.manager.connect(base.managerWallet).deployServer(SERVER_ID, base.devWallet.address);
            const serverAddr = await base.manager.getServer(SERVER_ID);
            const server = await ethers.getContractAt('RewardsServer', serverAddr);
            const SERVER_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes('SERVER_ADMIN_ROLE'));
            await server.connect(base.devWallet).grantRole(SERVER_ADMIN_ROLE, base.user1.address);
            await expect(
                server.connect(base.user2).withdrawAssets(1, base.user2.address, ethers.ZeroAddress, [], [])
            ).to.be.revertedWithCustomError(server, 'AccessControlUnauthorizedAccount');
        });

        it('non-MANAGER cannot call router pause', async function () {
            const { manager, user1 } = await loadFixture(deployRewardsManagerFixture);
            await expect(manager.connect(user1).pause()).to.be.revertedWithCustomError(manager, 'AccessControlUnauthorizedAccount');
        });

        it('only MANAGER_ROLE can call deployServer', async function () {
            const { manager, user1 } = await loadFixture(deployRewardsManagerFixture);
            await expect(manager.connect(user1).deployServer(2, user1.address))
                .to.be.revertedWithCustomError(manager, 'AccessControlUnauthorizedAccount');
        });
    });

    describe('router view proxies and claim', function () {
        it('router getServerTreasuryBalances and getTokenDetails mirror server state', async function () {
            const { manager, server, managerWallet, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
            const tokenId = 1;
            const rewardToken = {
                tokenId,
                tokenUri: 'https://example.com/1',
                maxSupply: 10,
                rewards: [
                    { rewardType: 1, rewardAmount: ethers.parseEther('10'), rewardTokenAddress: await mockERC20.getAddress(), rewardTokenIds: [], rewardTokenId: 0 },
                ],
            };
            await server.connect(managerWallet).createTokenAndReserveRewards(rewardToken, { value: 0 });
            const details = await manager.getTokenDetails(SERVER_ID, tokenId);
            expect(details.maxSupply).to.equal(10);
            expect(await manager.getRemainingSupply(SERVER_ID, tokenId)).to.equal(10);
            const [addresses, totalBalances] = await manager.getServerTreasuryBalances(SERVER_ID);
            expect(addresses).to.include(await mockERC20.getAddress());
            expect(await manager.isTokenExist(SERVER_ID, tokenId)).to.be.true;
        });

        it('router pause blocks claim even when server is unpaused', async function () {
            const { manager, server, managerWallet, user1, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
            const tokenId = 1;
            const rewardToken = {
                tokenId,
                tokenUri: 'https://example.com/1',
                maxSupply: 10,
                rewards: [
                    { rewardType: 1, rewardAmount: ethers.parseEther('10'), rewardTokenAddress: await mockERC20.getAddress(), rewardTokenIds: [], rewardTokenId: 0 },
                ],
            };
            await server.connect(managerWallet).createTokenAndReserveRewards(rewardToken, { value: 0 });
            const { data, signature } = await buildClaimDataAndSignature(await server.getAddress(), SERVER_ID, managerWallet, user1.address, [tokenId], 0);
            await manager.connect(managerWallet).pause();
            await expect(manager.connect(user1).claim(SERVER_ID, data, signature))
                .to.be.revertedWithCustomError(manager, 'EnforcedPause');
            await manager.connect(managerWallet).unpause();
            await manager.connect(user1).claim(SERVER_ID, data, signature);
            expect(await mockERC20.balanceOf(user1.address)).to.equal(ethers.parseEther('10'));
        });
    });

    describe('admin proxy and wrapper functions', function () {
        describe('getServerSigners', function () {
            it('returns empty when no signers added', async function () {
                const { manager, devWallet, managerWallet } = await loadFixture(deployRewardsManagerFixture);
                await manager.connect(managerWallet).deployServer(SERVER_ID, devWallet.address);
                const list = await manager.getServerSigners(SERVER_ID);
                expect(list.length).to.equal(0);
            });

            it('returns signers after setSigner', async function () {
                const { manager, devWallet, managerWallet, user1, user2 } = await loadFixture(deployRewardsManagerFixture);
                await manager.connect(managerWallet).deployServer(SERVER_ID, devWallet.address);
                const serverAddr = await manager.getServer(SERVER_ID);
                const server = await ethers.getContractAt('RewardsServer', serverAddr);
                const SERVER_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes('SERVER_ADMIN_ROLE'));
                await server.connect(devWallet).grantRole(SERVER_ADMIN_ROLE, user1.address);
                let list = await manager.getServerSigners(SERVER_ID);
                expect(list.length).to.equal(0);
                await server.connect(user1).setSigner(user2.address, true);
                list = await manager.getServerSigners(SERVER_ID);
                expect(list.length).to.equal(1);
                expect(list[0]).to.equal(user2.address);
                await server.connect(user1).setSigner(user1.address, true);
                list = await manager.getServerSigners(SERVER_ID);
                expect(list.length).to.equal(2);
                expect(list).to.include(user2.address);
                expect(list).to.include(user1.address);
                await server.connect(user1).setSigner(user2.address, false);
                list = await manager.getServerSigners(SERVER_ID);
                expect(list.length).to.equal(1);
                expect(list[0]).to.equal(user1.address);
            });
        });

        describe('claim ETH rewards', function () {
            it('sends ETH to beneficiary for ETHER rewards on claim', async function () {
                const { manager, devWallet, managerWallet, user1 } = await loadFixture(deployRewardsManagerFixture);
                await manager.connect(managerWallet).deployServer(SERVER_ID, devWallet.address);
                const serverAddr = await manager.getServer(SERVER_ID);
                const serverContract = await ethers.getContractAt('RewardsServer', serverAddr);
                const SERVER_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes('SERVER_ADMIN_ROLE'));
                await serverContract.connect(devWallet).grantRole(SERVER_ADMIN_ROLE, managerWallet.address);
                await serverContract.connect(managerWallet).setSigner(managerWallet.address, true);
                const tokenId = 1;
                const rewardToken = {
                    tokenId,
                    tokenUri: 'https://example.com/eth',
                    maxSupply: 2,
                    rewards: [{ rewardType: 0, rewardAmount: ethers.parseEther('1'), rewardTokenAddress: ethers.ZeroAddress, rewardTokenIds: [], rewardTokenId: 0 }],
                };
                await serverContract.connect(managerWallet).createTokenAndReserveRewards(rewardToken, { value: ethers.parseEther('2') });
                const { data, signature } = await buildClaimDataAndSignature(serverAddr, SERVER_ID, managerWallet, user1.address, [tokenId], 0);
                const beforeBalance = await ethers.provider.getBalance(user1.address);
                const tx = await manager.connect(user1).claim(SERVER_ID, data, signature);
                const receipt = await tx.wait();
                const gasCost = receipt!.gasUsed * receipt!.gasPrice;
                const afterBalance = await ethers.provider.getBalance(user1.address);
                expect(afterBalance - (beforeBalance - gasCost)).to.equal(ethers.parseEther('1'));
            });
        });

        describe('setSigner', function () {
            it('setSigner(true) enables signer, setSigner(false) disables', async function () {
                const { manager, devWallet, managerWallet, user1, user2 } = await loadFixture(deployRewardsManagerFixture);
                await manager.connect(managerWallet).deployServer(SERVER_ID, devWallet.address);
                const serverAddr = await manager.getServer(SERVER_ID);
                const server = await ethers.getContractAt('RewardsServer', serverAddr);
                const SERVER_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes('SERVER_ADMIN_ROLE'));
                await server.connect(devWallet).grantRole(SERVER_ADMIN_ROLE, user1.address);
                const listBefore = await manager.getServerSigners(SERVER_ID);
                expect(listBefore).to.not.include(user2.address);
                await server.connect(user1).setSigner(user2.address, true);
                expect((await manager.getServerSigners(SERVER_ID))).to.include(user2.address);
                await server.connect(user1).setSigner(user2.address, false);
                expect((await manager.getServerSigners(SERVER_ID))).to.not.include(user2.address);
            });
        });

        describe('increaseRewardSupply and removeTokenFromWhitelist', function () {
            it('SERVER_ADMIN can increase reward supply and reserves additional tokens', async function () {
                const { manager, server, managerWallet, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
                const tokenId = 1;
                const rewardToken = {
                    tokenId,
                    tokenUri: 'https://example.com/1',
                    maxSupply: 5,
                    rewards: [
                        { rewardType: 1, rewardAmount: ethers.parseEther('10'), rewardTokenAddress: await mockERC20.getAddress(), rewardTokenIds: [], rewardTokenId: 0 },
                    ],
                };
                await server.connect(managerWallet).createTokenAndReserveRewards(rewardToken, { value: 0 });
                expect(await manager.getRemainingSupply(SERVER_ID, tokenId)).to.equal(5);
                await mockERC20.connect(managerWallet).approve(await server.getAddress(), ethers.parseEther('100'));
                await server.connect(managerWallet).depositToTreasury(await mockERC20.getAddress(), ethers.parseEther('50'), managerWallet.address);
                await server.connect(managerWallet).increaseRewardSupply(tokenId, 5, { value: 0 });
                expect(await manager.getRemainingSupply(SERVER_ID, tokenId)).to.equal(10);
                const details = await manager.getTokenDetails(SERVER_ID, tokenId);
                expect(details.maxSupply).to.equal(10);
            });

            it('removeTokenFromWhitelist reverts when token has reserves', async function () {
                const { server, managerWallet, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
                const rewardToken = {
                    tokenId: 99,
                    tokenUri: 'https://example.com/r',
                    maxSupply: 2,
                    rewards: [
                        { rewardType: 1, rewardAmount: ethers.parseEther('1'), rewardTokenAddress: await mockERC20.getAddress(), rewardTokenIds: [], rewardTokenId: 0 },
                    ],
                };
                await server.connect(managerWallet).createTokenAndReserveRewards(rewardToken, { value: 0 });
                await expect(server.connect(managerWallet).removeTokenFromWhitelist(await mockERC20.getAddress()))
                    .to.be.revertedWithCustomError(server, 'TokenHasReserves');
            });
        });

        describe('claim replay and signature validation', function () {
            it('reverts with NonceAlreadyUsed when same beneficiary and nonce used twice', async function () {
                const { manager, server, managerWallet, user1, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
                const tokenId = 1;
                const rewardToken = {
                    tokenId,
                    tokenUri: 'https://example.com/1',
                    maxSupply: 10,
                    rewards: [
                        { rewardType: 1, rewardAmount: ethers.parseEther('10'), rewardTokenAddress: await mockERC20.getAddress(), rewardTokenIds: [], rewardTokenId: 0 },
                    ],
                };
                await server.connect(managerWallet).createTokenAndReserveRewards(rewardToken, { value: 0 });
                const { data, signature } = await buildClaimDataAndSignature(await server.getAddress(), SERVER_ID, managerWallet, user1.address, [tokenId], 0);
                await manager.connect(user1).claim(SERVER_ID, data, signature);
                await expect(manager.connect(user1).claim(SERVER_ID, data, signature))
                    .to.be.revertedWithCustomError(server, 'NonceAlreadyUsed');
            });

            it('reverts with InvalidSignature when signer not whitelisted', async function () {
                const { manager, server, managerWallet, user1, user2, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
                const tokenId = 1;
                const rewardToken = {
                    tokenId,
                    tokenUri: 'https://example.com/1',
                    maxSupply: 10,
                    rewards: [
                        { rewardType: 1, rewardAmount: ethers.parseEther('10'), rewardTokenAddress: await mockERC20.getAddress(), rewardTokenIds: [], rewardTokenId: 0 },
                    ],
                };
                await server.connect(managerWallet).createTokenAndReserveRewards(rewardToken, { value: 0 });
                const { data, signature } = await buildClaimDataAndSignature(await server.getAddress(), SERVER_ID, user2, user1.address, [tokenId], 0);
                await expect(manager.connect(user1).claim(SERVER_ID, data, signature))
                    .to.be.revertedWithCustomError(server, 'InvalidSignature');
            });

            it('signature for one server cannot be replayed on another server', async function () {
                const { manager, server, managerWallet, user1, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
                const tokenId = 1;
                const rewardToken = {
                    tokenId,
                    tokenUri: 'https://example.com/1',
                    maxSupply: 10,
                    rewards: [
                        { rewardType: 1, rewardAmount: ethers.parseEther('10'), rewardTokenAddress: await mockERC20.getAddress(), rewardTokenIds: [], rewardTokenId: 0 },
                    ],
                };
                await server.connect(managerWallet).createTokenAndReserveRewards(rewardToken, { value: 0 });
                const { data, signature } = await buildClaimDataAndSignature(await server.getAddress(), SERVER_ID, managerWallet, user1.address, [tokenId], 0);
                await manager.connect(managerWallet).deployServer(2, managerWallet.address);
                const server2Addr = await manager.getServer(2);
                const server2 = await ethers.getContractAt('RewardsServer', server2Addr);
                await expect(manager.connect(user1).claim(2, data, signature))
                    .to.be.revertedWithCustomError(server2, 'InvalidInput');
            });

            it('reverts with InvalidInput when claim data has wrong contract address', async function () {
                const { manager, server, managerWallet, user1, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
                const tokenId = 1;
                const rewardToken = {
                    tokenId,
                    tokenUri: 'https://example.com/1',
                    maxSupply: 10,
                    rewards: [
                        { rewardType: 1, rewardAmount: ethers.parseEther('10'), rewardTokenAddress: await mockERC20.getAddress(), rewardTokenIds: [], rewardTokenId: 0 },
                    ],
                };
                await server.connect(managerWallet).createTokenAndReserveRewards(rewardToken, { value: 0 });
                const chainId = (await ethers.provider.getNetwork()).chainId;
                const wrongAddress = managerWallet.address;
                const data = ethers.AbiCoder.defaultAbiCoder().encode(
                    ['address', 'uint256', 'address', 'uint256', 'uint8', 'uint256[]'],
                    [wrongAddress, chainId, user1.address, 0n, SERVER_ID, [tokenId]]
                );
                const messageHash = ethers.keccak256(
                    ethers.AbiCoder.defaultAbiCoder().encode(
                        ['address', 'uint256', 'uint8', 'address', 'uint256', 'uint256[]'],
                        [await server.getAddress(), chainId, SERVER_ID, user1.address, 0n, [tokenId]]
                    )
                );
                const signature = await managerWallet.signMessage(ethers.getBytes(messageHash));
                await expect(manager.connect(user1).claim(SERVER_ID, data, signature))
                    .to.be.revertedWithCustomError(server, 'InvalidInput');
            });
        });

        describe('reduceRewardSupply', function () {
            it('SERVER_ADMIN can reduce reward supply and event is emitted', async function () {
                const { manager, server, managerWallet, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
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
                await server.connect(managerWallet).createTokenAndReserveRewards(rewardToken, { value: 0 });
                let details = await manager.getTokenDetails(SERVER_ID, tokenId);
                expect(details.maxSupply).to.equal(10);
                await expect(server.connect(managerWallet).reduceRewardSupply(tokenId, 3))
                    .to.emit(server, 'RewardSupplyChanged')
                    .withArgs(tokenId, 0, 7); // currentSupply was 0, newSupply 7
                details = await manager.getTokenDetails(SERVER_ID, tokenId);
                expect(details.maxSupply).to.equal(7);
                expect(await manager.getRemainingSupply(SERVER_ID, tokenId)).to.equal(7);
            });

            it('non-server-admin cannot call reduceRewardSupply', async function () {
                const { manager, server, managerWallet, user1, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
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
                await server.connect(managerWallet).createTokenAndReserveRewards(rewardToken, { value: 0 });
                await expect(
                    server.connect(user1).reduceRewardSupply(tokenId, 2)
                ).to.be.revertedWithCustomError(server, 'AccessControlUnauthorizedAccount');
            });
        });
    });
});
