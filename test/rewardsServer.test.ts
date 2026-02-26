import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

/**
 * RewardsServer tests (server treasury, rewards, signatures, and access control).
 */
describe('RewardsServer', function () {
    const SERVER_ID = 1;

    async function deployRewardsManagerFixture() {
        const [devWallet, managerWallet, user1, user2] = await ethers.getSigners();

        const RewardsServerImpl = await ethers.getContractFactory('RewardsServer');
        const rewardsServerImpl = await RewardsServerImpl.deploy();
        await rewardsServerImpl.waitForDeployment();

        const RewardsRouter = await ethers.getContractFactory('RewardsRouter');
        const manager = await upgrades.deployProxy(
            RewardsRouter,
            [devWallet.address, await rewardsServerImpl.getAddress()],
            { kind: 'uups', initializer: 'initialize' }
        );
        await manager.waitForDeployment();

        const MANAGER_ROLE = await manager.MANAGER_ROLE();
        await manager.connect(devWallet).grantRole(MANAGER_ROLE, managerWallet.address);

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
        await mockERC20.connect(base.managerWallet).transfer(serverAddr, ethers.parseEther('1000'));

        return { ...base, server, mockERC20 };
    }

    /** Build claim data and signature for RewardsServer.claim(). Targets the given server; signer must be a server signer. */
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

        it('reverts with AddressIsZero when setting zero address as signer', async function () {
            const { manager, devWallet, managerWallet } = await loadFixture(deployRewardsManagerFixture);
            await manager.connect(managerWallet).deployServer(SERVER_ID, devWallet.address);
            const serverAddr = await manager.getServer(SERVER_ID);
            const server = await ethers.getContractAt('RewardsServer', serverAddr);
            await expect(server.connect(devWallet).setSigner(ethers.ZeroAddress, true))
                .to.be.revertedWithCustomError(server, 'AddressIsZero');
        });

        it('reverts with SignerAlreadySet when setting same active state', async function () {
            const { manager, devWallet, managerWallet, user1 } = await loadFixture(deployRewardsManagerFixture);
            await manager.connect(managerWallet).deployServer(SERVER_ID, devWallet.address);
            const serverAddr = await manager.getServer(SERVER_ID);
            const server = await ethers.getContractAt('RewardsServer', serverAddr);
            const SERVER_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes('SERVER_ADMIN_ROLE'));
            await server.connect(devWallet).grantRole(SERVER_ADMIN_ROLE, user1.address);
            await server.connect(user1).setSigner(user1.address, true);
            await expect(server.connect(user1).setSigner(user1.address, true))
                .to.be.revertedWithCustomError(server, 'SignerAlreadySet');
        });
    });

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
            await manager.connect(user1).claim(data, signature);
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
                const tx = await manager.connect(user1).claim(data, signature);
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
                await manager.connect(user1).claim(data, signature);
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
            await manager.connect(user1).claim(data1, sig1);
            await manager.connect(user1).claim(data2, sig2);

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
            await manager.connect(user2).claim(data, signature);
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
                await manager.connect(user1).claim(data0, sig0);
                expect(await mockERC721.ownerOf(0)).to.equal(user1.address);
                const { data: data1, signature: sig1 } = await buildClaimDataAndSignature(
                    serverAddr,
                    SERVER_ID,
                    managerWallet,
                    user1.address,
                    [tokenId],
                    1
                );
                await manager.connect(user1).claim(data1, sig1);
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
                await manager.connect(user1).claim(data, signature);
                expect(await mockERC1155.balanceOf(user1.address, erc1155TokenId)).to.equal(10);
            });
        });
    });

    describe('security assumptions', function () {
        it('only SERVER_ADMIN can withdraw from treasury', async function () {
            const { manager, server, managerWallet, user1, user2, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
            const extra = ethers.parseEther('100');
            await mockERC20.mint(user2.address, extra);
            await mockERC20.connect(user2).transfer(await server.getAddress(), extra);
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

        it('reverts with AddressIsZero when whitelisting zero address', async function () {
            const { manager, managerWallet } = await loadFixture(deployRewardsManagerFixture);
            await manager.connect(managerWallet).deployServer(SERVER_ID, managerWallet.address);
            const serverAddr = await manager.getServer(SERVER_ID);
            const server = await ethers.getContractAt('RewardsServer', serverAddr);
            await expect(server.connect(managerWallet).whitelistToken(ethers.ZeroAddress, 1))
                .to.be.revertedWithCustomError(server, 'AddressIsZero');
        });

        it('reverts with TokenAlreadyWhitelisted when whitelisting same token again', async function () {
            const { server, managerWallet, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
            await expect(server.connect(managerWallet).whitelistToken(await mockERC20.getAddress(), 1))
                .to.be.revertedWithCustomError(server, 'TokenAlreadyWhitelisted');
        });
    });

    describe('removeTokenFromWhitelist and withdraw paths', function () {
        it('SERVER_ADMIN can remove token from whitelist when no reserves', async function () {
            const { manager, managerWallet } = await loadFixture(deployRewardsManagerFixture);
            await manager.connect(managerWallet).deployServer(SERVER_ID, managerWallet.address);
            const serverAddr = await manager.getServer(SERVER_ID);
            const serverContract = await ethers.getContractAt('RewardsServer', serverAddr);
            const MockERC20 = await ethers.getContractFactory('MockERC20');
            const mockERC20 = await MockERC20.deploy('Extra', 'E');
            await mockERC20.waitForDeployment();
            await mockERC20.mint(managerWallet.address, ethers.parseEther('100'));
            await serverContract.connect(managerWallet).whitelistToken(await mockERC20.getAddress(), 1);
            expect(await manager.isServerWhitelistedToken(SERVER_ID, await mockERC20.getAddress())).to.be.true;
            await serverContract.connect(managerWallet).removeTokenFromWhitelist(await mockERC20.getAddress());
            expect(await manager.isServerWhitelistedToken(SERVER_ID, await mockERC20.getAddress())).to.be.false;
        });

        it('withdrawAssets ERC20: withdraws unreserved ERC20 to recipient', async function () {
            const { server, managerWallet, mockERC20, user1 } = await loadFixture(deployWithServerAndTokenFixture);
            await mockERC20.connect(managerWallet).transfer(await server.getAddress(), ethers.parseEther('200'));
            const before = await mockERC20.balanceOf(user1.address);
            await server.connect(managerWallet).withdrawAssets(1, user1.address, await mockERC20.getAddress(), [], []);
            const after_ = await mockERC20.balanceOf(user1.address);
            expect(after_ - before).to.equal(ethers.parseEther('1200'));
        });

        it('withdrawAssets reverts InvalidLength for ERC1155 when tokenIds and amounts length mismatch', async function () {
            const { server, managerWallet, user1 } = await loadFixture(deployWithServerAndTokenFixture);
            const MockERC1155 = await ethers.getContractFactory('MockERC1155');
            const m = await MockERC1155.deploy();
            await m.waitForDeployment();
            await server.connect(managerWallet).whitelistToken(await m.getAddress(), 3);
            await expect(
                server.connect(managerWallet).withdrawAssets(3, user1.address, await m.getAddress(), [1], [10, 20])
            ).to.be.revertedWithCustomError(server, 'InvalidLength');
        });

        it('withdrawUnreservedTreasury reverts TokenNotWhitelisted for non-whitelisted token', async function () {
            const { manager, managerWallet } = await loadFixture(deployRewardsManagerFixture);
            await manager.connect(managerWallet).deployServer(SERVER_ID, managerWallet.address);
            const serverAddr = await manager.getServer(SERVER_ID);
            const server = await ethers.getContractAt('RewardsServer', serverAddr);
            const MockERC20 = await ethers.getContractFactory('MockERC20');
            const mockERC20 = await MockERC20.deploy('X', 'X');
            await mockERC20.waitForDeployment();
            await expect(
                server.connect(managerWallet).withdrawUnreservedTreasury(await mockERC20.getAddress(), managerWallet.address)
            ).to.be.revertedWithCustomError(server, 'TokenNotWhitelisted');
        });

        it('withdrawAssets reverts AddressIsZero when to is zero', async function () {
            const { server, managerWallet } = await loadFixture(deployWithServerAndTokenFixture);
            await expect(
                server.connect(managerWallet).withdrawAssets(0, ethers.ZeroAddress, ethers.ZeroAddress, [], [ethers.parseEther('1')])
            ).to.be.revertedWithCustomError(server, 'AddressIsZero');
        });

        it('withdrawAssets ETHER reverts InvalidInput when amounts is empty', async function () {
            const { server, managerWallet, user1 } = await loadFixture(deployWithServerAndTokenFixture);
            await expect(
                server.connect(managerWallet).withdrawAssets(0, user1.address, ethers.ZeroAddress, [], [])
            ).to.be.revertedWithCustomError(server, 'InvalidInput');
        });

        it('withdrawUnreservedTreasury reverts AddressIsZero when _to is zero', async function () {
            const { server, managerWallet, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
            await expect(
                server.connect(managerWallet).withdrawUnreservedTreasury(await mockERC20.getAddress(), ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(server, 'AddressIsZero');
        });

        it('withdrawUnreservedTreasury reverts InsufficientBalance when balance <= reserved', async function () {
            const { server, managerWallet, mockERC20, user1 } = await loadFixture(deployWithServerAndTokenFixture);
            await server.connect(managerWallet).createTokenAndReserveRewards(
                { tokenId: 1, tokenUri: 'u', maxSupply: 1, rewards: [{ rewardType: 1, rewardAmount: ethers.parseEther('1000'), rewardTokenAddress: await mockERC20.getAddress(), rewardTokenIds: [], rewardTokenId: 0 }] },
                { value: 0 }
            );
            await expect(
                server.connect(managerWallet).withdrawUnreservedTreasury(await mockERC20.getAddress(), user1.address)
            ).to.be.revertedWithCustomError(server, 'InsufficientBalance');
        });

        it('withdrawERC721UnreservedTreasury reverts AddressIsZero when _to is zero', async function () {
            const { server, managerWallet } = await loadFixture(deployWithServerAndTokenFixture);
            const MockERC721 = await ethers.getContractFactory('MockERC721');
            const m = await MockERC721.deploy();
            await m.waitForDeployment();
            await server.connect(managerWallet).whitelistToken(await m.getAddress(), 2);
            await expect(
                server.connect(managerWallet).withdrawERC721UnreservedTreasury(await m.getAddress(), ethers.ZeroAddress, 0)
            ).to.be.revertedWithCustomError(server, 'AddressIsZero');
        });

        it('withdrawERC721UnreservedTreasury reverts TokenNotWhitelisted', async function () {
            const { server, managerWallet, user1 } = await loadFixture(deployWithServerAndTokenFixture);
            const MockERC721 = await ethers.getContractFactory('MockERC721');
            const m = await MockERC721.deploy();
            await m.waitForDeployment();
            await expect(
                server.connect(managerWallet).withdrawERC721UnreservedTreasury(await m.getAddress(), user1.address, 0)
            ).to.be.revertedWithCustomError(server, 'TokenNotWhitelisted');
        });

        it('withdrawERC721UnreservedTreasury reverts InsufficientTreasuryBalance when tokenId is reserved', async function () {
            const { manager, server, managerWallet, user1 } = await loadFixture(deployWithServerAndTokenFixture);
            const MockERC721 = await ethers.getContractFactory('MockERC721');
            const m = await MockERC721.deploy();
            await m.waitForDeployment();
            const serverAddr = await server.getAddress();
            await server.connect(managerWallet).whitelistToken(await m.getAddress(), 2);
            await m.mint(managerWallet.address);
            await m.connect(managerWallet).transferFrom(managerWallet.address, serverAddr, 0);
            await server.connect(managerWallet).createTokenAndReserveRewards(
                { tokenId: 30, tokenUri: 'nft', maxSupply: 1, rewards: [{ rewardType: 2, rewardAmount: 1, rewardTokenAddress: await m.getAddress(), rewardTokenIds: [0], rewardTokenId: 0 }] },
                { value: 0 }
            );
            await expect(
                server.connect(managerWallet).withdrawERC721UnreservedTreasury(await m.getAddress(), user1.address, 0)
            ).to.be.revertedWithCustomError(server, 'InsufficientTreasuryBalance');
        });

        it('withdrawERC721UnreservedTreasury success after claim frees NFT', async function () {
            const { manager, server, managerWallet, user1 } = await loadFixture(deployWithServerAndTokenFixture);
            const MockERC721 = await ethers.getContractFactory('MockERC721');
            const m = await MockERC721.deploy();
            await m.waitForDeployment();
            const serverAddr = await server.getAddress();
            await server.connect(managerWallet).whitelistToken(await m.getAddress(), 2);
            await m.mint(managerWallet.address);
            await m.mint(managerWallet.address);
            await m.connect(managerWallet).setApprovalForAll(serverAddr, true);
            await m.connect(managerWallet).transferFrom(managerWallet.address, serverAddr, 0);
            await m.connect(managerWallet).transferFrom(managerWallet.address, serverAddr, 1);
            await server.connect(managerWallet).createTokenAndReserveRewards(
                { tokenId: 30, tokenUri: 'nft', maxSupply: 1, rewards: [{ rewardType: 2, rewardAmount: 1, rewardTokenAddress: await m.getAddress(), rewardTokenIds: [0], rewardTokenId: 0 }] },
                { value: 0 }
            );
            const { data, signature } = await buildClaimDataAndSignature(serverAddr, SERVER_ID, managerWallet, user1.address, [30], 0);
            await manager.connect(user1).claim(data, signature);
            expect(await m.ownerOf(0)).to.equal(user1.address);
            await server.connect(managerWallet).withdrawERC721UnreservedTreasury(await m.getAddress(), user1.address, 1);
            expect(await m.ownerOf(1)).to.equal(user1.address);
        });

        it('withdrawAssets ERC721 withdraws unreserved NFT via withdrawAssets', async function () {
            const { manager, server, managerWallet, user1 } = await loadFixture(deployWithServerAndTokenFixture);
            const MockERC721 = await ethers.getContractFactory('MockERC721');
            const m = await MockERC721.deploy();
            await m.waitForDeployment();
            const serverAddr = await server.getAddress();
            await server.connect(managerWallet).whitelistToken(await m.getAddress(), 2);
            for (let i = 0; i < 3; i++) await m.mint(managerWallet.address);
            await m.connect(managerWallet).setApprovalForAll(serverAddr, true);
            for (let i = 0; i < 3; i++) await m.connect(managerWallet).transferFrom(managerWallet.address, serverAddr, i);
            await server.connect(managerWallet).createTokenAndReserveRewards(
                { tokenId: 40, tokenUri: 'nft', maxSupply: 1, rewards: [{ rewardType: 2, rewardAmount: 1, rewardTokenAddress: await m.getAddress(), rewardTokenIds: [0], rewardTokenId: 0 }] },
                { value: 0 }
            );
            const { data, signature } = await buildClaimDataAndSignature(serverAddr, SERVER_ID, managerWallet, user1.address, [40], 0);
            await manager.connect(user1).claim(data, signature);
            await server.connect(managerWallet).withdrawAssets(2, user1.address, await m.getAddress(), [1, 2], []);
            expect(await m.ownerOf(1)).to.equal(user1.address);
            expect(await m.ownerOf(2)).to.equal(user1.address);
        });

        it('withdrawERC1155UnreservedTreasury reverts AddressIsZero when _to is zero', async function () {
            const { server, managerWallet } = await loadFixture(deployWithServerAndTokenFixture);
            const MockERC1155 = await ethers.getContractFactory('MockERC1155');
            const m = await MockERC1155.deploy();
            await m.waitForDeployment();
            await expect(
                server.connect(managerWallet).withdrawERC1155UnreservedTreasury(await m.getAddress(), ethers.ZeroAddress, 0, 1)
            ).to.be.revertedWithCustomError(server, 'AddressIsZero');
        });

        it('withdrawERC1155UnreservedTreasury reverts TokenNotWhitelisted', async function () {
            const { server, managerWallet, user1 } = await loadFixture(deployWithServerAndTokenFixture);
            const MockERC1155 = await ethers.getContractFactory('MockERC1155');
            const m = await MockERC1155.deploy();
            await m.waitForDeployment();
            await expect(
                server.connect(managerWallet).withdrawERC1155UnreservedTreasury(await m.getAddress(), user1.address, 1, 1)
            ).to.be.revertedWithCustomError(server, 'TokenNotWhitelisted');
        });

        it('withdrawERC1155UnreservedTreasury reverts InsufficientBalance when balance <= reserved or amount > available', async function () {
            const { server, managerWallet, user1 } = await loadFixture(deployWithServerAndTokenFixture);
            const MockERC1155 = await ethers.getContractFactory('MockERC1155');
            const m = await MockERC1155.deploy();
            await m.waitForDeployment();
            await server.connect(managerWallet).whitelistToken(await m.getAddress(), 3);
            await m.mint(managerWallet.address, 1, 50, '0x');
            await m.connect(managerWallet).setApprovalForAll(await server.getAddress(), true);
            await m.connect(managerWallet).safeTransferFrom(managerWallet.address, await server.getAddress(), 1, 50, '0x');
            await server.connect(managerWallet).createTokenAndReserveRewards(
                { tokenId: 60, tokenUri: '1155', maxSupply: 2, rewards: [{ rewardType: 3, rewardAmount: 20, rewardTokenAddress: await m.getAddress(), rewardTokenIds: [], rewardTokenId: 1 }] },
                { value: 0 }
            );
            await expect(
                server.connect(managerWallet).withdrawERC1155UnreservedTreasury(await m.getAddress(), user1.address, 1, 20)
            ).to.be.revertedWithCustomError(server, 'InsufficientBalance');
            await expect(
                server.connect(managerWallet).withdrawERC1155UnreservedTreasury(await m.getAddress(), user1.address, 1, 11)
            ).to.be.revertedWithCustomError(server, 'InsufficientBalance');
        });

        it('withdrawERC1155UnreservedTreasury success withdraws unreserved amount', async function () {
            const { server, managerWallet, user1 } = await loadFixture(deployWithServerAndTokenFixture);
            const MockERC1155 = await ethers.getContractFactory('MockERC1155');
            const m = await MockERC1155.deploy();
            await m.waitForDeployment();
            await server.connect(managerWallet).whitelistToken(await m.getAddress(), 3);
            await m.mint(managerWallet.address, 1, 100, '0x');
            await m.connect(managerWallet).setApprovalForAll(await server.getAddress(), true);
            await m.connect(managerWallet).safeTransferFrom(managerWallet.address, await server.getAddress(), 1, 100, '0x');
            await server.connect(managerWallet).createTokenAndReserveRewards(
                { tokenId: 61, tokenUri: '1155', maxSupply: 2, rewards: [{ rewardType: 3, rewardAmount: 20, rewardTokenAddress: await m.getAddress(), rewardTokenIds: [], rewardTokenId: 1 }] },
                { value: 0 }
            );
            const before = await m.balanceOf(user1.address, 1);
            await server.connect(managerWallet).withdrawERC1155UnreservedTreasury(await m.getAddress(), user1.address, 1, 60);
            expect(await m.balanceOf(user1.address, 1) - before).to.equal(60);
        });

        it('withdrawAssets ERC1155 success', async function () {
            const { server, managerWallet, user1 } = await loadFixture(deployWithServerAndTokenFixture);
            const MockERC1155 = await ethers.getContractFactory('MockERC1155');
            const m = await MockERC1155.deploy();
            await m.waitForDeployment();
            await server.connect(managerWallet).whitelistToken(await m.getAddress(), 3);
            await m.mint(managerWallet.address, 1, 100, '0x');
            await m.connect(managerWallet).setApprovalForAll(await server.getAddress(), true);
            await m.connect(managerWallet).safeTransferFrom(managerWallet.address, await server.getAddress(), 1, 100, '0x');
            await server.connect(managerWallet).createTokenAndReserveRewards(
                { tokenId: 62, tokenUri: '1155', maxSupply: 1, rewards: [{ rewardType: 3, rewardAmount: 10, rewardTokenAddress: await m.getAddress(), rewardTokenIds: [], rewardTokenId: 1 }] },
                { value: 0 }
            );
            await server.connect(managerWallet).withdrawAssets(3, user1.address, await m.getAddress(), [1], [90]);
            expect(await m.balanceOf(user1.address, 1)).to.equal(90);
        });

        it('withdrawEtherUnreservedTreasury reverts AddressIsZero', async function () {
            const { server, managerWallet } = await loadFixture(deployWithServerAndTokenFixture);
            await expect(
                server.connect(managerWallet).withdrawEtherUnreservedTreasury(ethers.ZeroAddress, ethers.parseEther('1'))
            ).to.be.revertedWithCustomError(server, 'AddressIsZero');
        });

        it('withdrawEtherUnreservedTreasury reverts InsufficientBalance when amount > available', async function () {
            const { server, managerWallet, user1 } = await loadFixture(deployWithServerAndTokenFixture);
            await server.connect(managerWallet).createTokenAndReserveRewards(
                { tokenId: 1, tokenUri: 'eth', maxSupply: 1, rewards: [{ rewardType: 0, rewardAmount: ethers.parseEther('1'), rewardTokenAddress: ethers.ZeroAddress, rewardTokenIds: [], rewardTokenId: 0 }] },
                { value: ethers.parseEther('1') }
            );
            await expect(
                server.connect(managerWallet).withdrawEtherUnreservedTreasury(user1.address, ethers.parseEther('0.5'))
            ).to.be.revertedWithCustomError(server, 'InsufficientBalance');
        });
    });

    describe('createTokenAndReserveRewards validation', function () {
        it('reverts with InvalidAmount when maxSupply is zero', async function () {
            const { server, managerWallet, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
            const token = {
                tokenId: 1,
                tokenUri: 'u',
                maxSupply: 0,
                rewards: [{ rewardType: 1, rewardAmount: 1n, rewardTokenAddress: await mockERC20.getAddress(), rewardTokenIds: [], rewardTokenId: 0 }],
            };
            await expect(server.connect(managerWallet).createTokenAndReserveRewards(token, { value: 0 }))
                .to.be.revertedWithCustomError(server, 'InvalidAmount');
        });

        it('reverts with InvalidInput when tokenUri empty', async function () {
            const { server, managerWallet, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
            const token = {
                tokenId: 1,
                tokenUri: '',
                maxSupply: 1,
                rewards: [{ rewardType: 1, rewardAmount: 1n, rewardTokenAddress: await mockERC20.getAddress(), rewardTokenIds: [], rewardTokenId: 0 }],
            };
            await expect(server.connect(managerWallet).createTokenAndReserveRewards(token, { value: 0 }))
                .to.be.revertedWithCustomError(server, 'InvalidInput');
        });

        it('reverts with DupTokenId when tokenId already exists', async function () {
            const { server, managerWallet, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
            const token = {
                tokenId: 1,
                tokenUri: 'u',
                maxSupply: 1,
                rewards: [{ rewardType: 1, rewardAmount: ethers.parseEther('1'), rewardTokenAddress: await mockERC20.getAddress(), rewardTokenIds: [], rewardTokenId: 0 }],
            };
            await server.connect(managerWallet).createTokenAndReserveRewards(token, { value: 0 });
            await expect(server.connect(managerWallet).createTokenAndReserveRewards(token, { value: 0 }))
                .to.be.revertedWithCustomError(server, 'DupTokenId');
        });

        it('reverts with TokenNotWhitelisted when reward token not whitelisted', async function () {
            const base = await loadFixture(deployRewardsManagerFixture);
            await base.manager.connect(base.managerWallet).deployServer(SERVER_ID, base.managerWallet.address);
            const serverAddr = await base.manager.getServer(SERVER_ID);
            const server = await ethers.getContractAt('RewardsServer', serverAddr);
            const MockERC20 = await ethers.getContractFactory('MockERC20');
            const mockERC20 = await MockERC20.deploy('M', 'M');
            await mockERC20.waitForDeployment();
            const token = {
                tokenId: 1,
                tokenUri: 'u',
                maxSupply: 1,
                rewards: [{ rewardType: 1, rewardAmount: 1n, rewardTokenAddress: await mockERC20.getAddress(), rewardTokenIds: [], rewardTokenId: 0 }],
            };
            await expect(server.connect(base.managerWallet).createTokenAndReserveRewards(token, { value: 0 }))
                .to.be.revertedWithCustomError(server, 'TokenNotWhitelisted');
        });

        it('reverts with InvalidInput when tokenId is zero', async function () {
            const { server, managerWallet, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
            const token = {
                tokenId: 0,
                tokenUri: 'u',
                maxSupply: 1,
                rewards: [{ rewardType: 1, rewardAmount: 1n, rewardTokenAddress: await mockERC20.getAddress(), rewardTokenIds: [], rewardTokenId: 0 }],
            };
            await expect(server.connect(managerWallet).createTokenAndReserveRewards(token, { value: 0 }))
                .to.be.revertedWithCustomError(server, 'InvalidInput');
        });

        it('reverts with InvalidInput when rewards array is empty', async function () {
            const { server, managerWallet } = await loadFixture(deployWithServerAndTokenFixture);
            const token = {
                tokenId: 1,
                tokenUri: 'u',
                maxSupply: 1,
                rewards: [],
            };
            await expect(server.connect(managerWallet).createTokenAndReserveRewards(token, { value: 0 }))
                .to.be.revertedWithCustomError(server, 'InvalidInput');
        });

        it('reverts with AddressIsZero when non-ETHER reward has zero token address', async function () {
            const { server, managerWallet } = await loadFixture(deployWithServerAndTokenFixture);
            const token = {
                tokenId: 1,
                tokenUri: 'u',
                maxSupply: 1,
                rewards: [{ rewardType: 1, rewardAmount: 1n, rewardTokenAddress: ethers.ZeroAddress, rewardTokenIds: [], rewardTokenId: 0 }],
            };
            await expect(server.connect(managerWallet).createTokenAndReserveRewards(token, { value: 0 }))
                .to.be.revertedWithCustomError(server, 'AddressIsZero');
        });

        it('reverts with InvalidInput when ERC721 rewardTokenIds length mismatch', async function () {
            const { server, managerWallet } = await loadFixture(deployWithServerAndTokenFixture);
            const MockERC721 = await ethers.getContractFactory('MockERC721');
            const m = await MockERC721.deploy();
            await m.waitForDeployment();
            await server.connect(managerWallet).whitelistToken(await m.getAddress(), 2);
            const token = {
                tokenId: 1,
                tokenUri: 'u',
                maxSupply: 2,
                rewards: [{ rewardType: 2, rewardAmount: 1, rewardTokenAddress: await m.getAddress(), rewardTokenIds: [0], rewardTokenId: 0 }],
            };
            await expect(server.connect(managerWallet).createTokenAndReserveRewards(token, { value: 0 }))
                .to.be.revertedWithCustomError(server, 'InvalidInput');
        });

        it('reverts with InvalidAmount when ERC20 rewardAmount is zero', async function () {
            const { server, managerWallet, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
            const token = {
                tokenId: 1,
                tokenUri: 'u',
                maxSupply: 1,
                rewards: [{ rewardType: 1, rewardAmount: 0n, rewardTokenAddress: await mockERC20.getAddress(), rewardTokenIds: [], rewardTokenId: 0 }],
            };
            await expect(server.connect(managerWallet).createTokenAndReserveRewards(token, { value: 0 }))
                .to.be.revertedWithCustomError(server, 'InvalidAmount');
        });

        it('reverts with InsufficientBalance when msg.value less than ETH required', async function () {
            const { server, managerWallet } = await loadFixture(deployWithServerAndTokenFixture);
            const token = {
                tokenId: 1,
                tokenUri: 'eth',
                maxSupply: 2,
                rewards: [{ rewardType: 0, rewardAmount: ethers.parseEther('1'), rewardTokenAddress: ethers.ZeroAddress, rewardTokenIds: [], rewardTokenId: 0 }],
            };
            await expect(server.connect(managerWallet).createTokenAndReserveRewards(token, { value: ethers.parseEther('0.5') }))
                .to.be.revertedWithCustomError(server, 'InsufficientBalance');
        });

        it('reverts with InsufficientTreasuryBalance when ERC20 balance too low', async function () {
            const { server, managerWallet, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
            const token = {
                tokenId: 1,
                tokenUri: 'u',
                maxSupply: 10,
                rewards: [{ rewardType: 1, rewardAmount: ethers.parseEther('101'), rewardTokenAddress: await mockERC20.getAddress(), rewardTokenIds: [], rewardTokenId: 0 }],
            };
            await expect(server.connect(managerWallet).createTokenAndReserveRewards(token, { value: 0 }))
                .to.be.revertedWithCustomError(server, 'InsufficientTreasuryBalance');
        });

        it('reverts with InsufficientTreasuryBalance when ERC721 NFT not owned by server', async function () {
            const { server, managerWallet, user1 } = await loadFixture(deployWithServerAndTokenFixture);
            const MockERC721 = await ethers.getContractFactory('MockERC721');
            const m = await MockERC721.deploy();
            await m.waitForDeployment();
            await server.connect(managerWallet).whitelistToken(await m.getAddress(), 2);
            await m.mint(user1.address);
            const token = {
                tokenId: 1,
                tokenUri: 'u',
                maxSupply: 1,
                rewards: [{ rewardType: 2, rewardAmount: 1, rewardTokenAddress: await m.getAddress(), rewardTokenIds: [0], rewardTokenId: 0 }],
            };
            await expect(server.connect(managerWallet).createTokenAndReserveRewards(token, { value: 0 }))
                .to.be.revertedWithCustomError(server, 'InsufficientTreasuryBalance');
        });

        it('reverts with InsufficientTreasuryBalance when ERC721 tokenId already reserved', async function () {
            const { server, managerWallet } = await loadFixture(deployWithServerAndTokenFixture);
            const MockERC721 = await ethers.getContractFactory('MockERC721');
            const m = await MockERC721.deploy();
            await m.waitForDeployment();
            const serverAddr = await server.getAddress();
            await server.connect(managerWallet).whitelistToken(await m.getAddress(), 2);
            await m.mint(managerWallet.address);
            await m.mint(managerWallet.address);
            await m.connect(managerWallet).setApprovalForAll(serverAddr, true);
            await m.connect(managerWallet).transferFrom(managerWallet.address, serverAddr, 0);
            await m.connect(managerWallet).transferFrom(managerWallet.address, serverAddr, 1);
            await server.connect(managerWallet).createTokenAndReserveRewards(
                { tokenId: 10, tokenUri: 'nft', maxSupply: 1, rewards: [{ rewardType: 2, rewardAmount: 1, rewardTokenAddress: await m.getAddress(), rewardTokenIds: [0], rewardTokenId: 0 }] },
                { value: 0 }
            );
            const token = {
                tokenId: 11,
                tokenUri: 'u2',
                maxSupply: 1,
                rewards: [{ rewardType: 2, rewardAmount: 1, rewardTokenAddress: await m.getAddress(), rewardTokenIds: [0], rewardTokenId: 0 }],
            };
            await expect(server.connect(managerWallet).createTokenAndReserveRewards(token, { value: 0 }))
                .to.be.revertedWithCustomError(server, 'InsufficientTreasuryBalance');
        });
    });

    describe('signers and supply helpers', function () {
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
                await mockERC20.connect(managerWallet).transfer(await server.getAddress(), ethers.parseEther('50'));
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

            it('removeTokenFromWhitelist reverts TokenNotWhitelisted when token not in whitelist', async function () {
                const { server, managerWallet } = await loadFixture(deployWithServerAndTokenFixture);
                const MockERC20 = await ethers.getContractFactory('MockERC20');
                const other = await MockERC20.deploy('O', 'O');
                await other.waitForDeployment();
                await expect(server.connect(managerWallet).removeTokenFromWhitelist(await other.getAddress()))
                    .to.be.revertedWithCustomError(server, 'TokenNotWhitelisted');
            });
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
            await manager.connect(user1).claim(data, signature);
            await expect(manager.connect(user1).claim(data, signature)).to.be.revertedWithCustomError(
                server,
                'NonceAlreadyUsed'
            );
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
            await expect(manager.connect(user1).claim(data, signature)).to.be.revertedWithCustomError(
                server,
                'InvalidSignature'
            );
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
            const { signature } = await buildClaimDataAndSignature(await server.getAddress(), SERVER_ID, managerWallet, user1.address, [tokenId], 0);
            await manager.connect(managerWallet).deployServer(2, managerWallet.address);
            const server2Addr = await manager.getServer(2);
            const server2 = await ethers.getContractAt('RewardsServer', server2Addr);
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const dataForServer2 = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'address', 'uint256', 'uint8', 'uint256[]'],
                [server2Addr, chainId, user1.address, 0n, 2, [tokenId]]
            );
            await expect(manager.connect(user1).claim(dataForServer2, signature)).to.be.revertedWithCustomError(
                server2,
                'InvalidSignature'
            );
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
            await expect(manager.connect(user1).claim(data, signature)).to.be.revertedWithCustomError(
                server,
                'InvalidInput'
            );
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
                .withArgs(tokenId, 10, 7); // oldMaxSupply 10, newSupply 7
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

        it('reverts with TokenNotExist when reducing non-existent token', async function () {
            const { server, managerWallet } = await loadFixture(deployWithServerAndTokenFixture);
            await expect(server.connect(managerWallet).reduceRewardSupply(999, 1))
                .to.be.revertedWithCustomError(server, 'TokenNotExist');
        });

        it('reverts with InvalidAmount when _reduceBy is zero', async function () {
            const { server, managerWallet, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
            await server.connect(managerWallet).createTokenAndReserveRewards(
                { tokenId: 1, tokenUri: 'u', maxSupply: 5, rewards: [{ rewardType: 1, rewardAmount: 1n, rewardTokenAddress: await mockERC20.getAddress(), rewardTokenIds: [], rewardTokenId: 0 }] },
                { value: 0 }
            );
            await expect(server.connect(managerWallet).reduceRewardSupply(1, 0))
                .to.be.revertedWithCustomError(server, 'InvalidAmount');
        });

        it('reverts with InsufficientBalance when new supply would be below current claims', async function () {
            const { manager, server, managerWallet, user1, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
            const tokenId = 1;
            await server.connect(managerWallet).createTokenAndReserveRewards(
                { tokenId, tokenUri: 'u', maxSupply: 5, rewards: [{ rewardType: 1, rewardAmount: ethers.parseEther('1'), rewardTokenAddress: await mockERC20.getAddress(), rewardTokenIds: [], rewardTokenId: 0 }] },
                { value: 0 }
            );
            const { data, signature } = await buildClaimDataAndSignature(await server.getAddress(), SERVER_ID, managerWallet, user1.address, [tokenId], 0);
            await manager.connect(user1).claim(data, signature);
            await manager.connect(user1).claim(
                (await buildClaimDataAndSignature(await server.getAddress(), SERVER_ID, managerWallet, user1.address, [tokenId], 1)).data,
                (await buildClaimDataAndSignature(await server.getAddress(), SERVER_ID, managerWallet, user1.address, [tokenId], 1)).signature
            );
            await expect(server.connect(managerWallet).reduceRewardSupply(tokenId, 4))
                .to.be.revertedWithCustomError(server, 'InsufficientBalance');
        });

        it('reduceRewardSupply ERC721 un-reserves tail NFTs', async function () {
            const { manager, server, managerWallet, user1 } = await loadFixture(deployWithServerAndTokenFixture);
            const MockERC721 = await ethers.getContractFactory('MockERC721');
            const m = await MockERC721.deploy();
            await m.waitForDeployment();
            const serverAddr = await server.getAddress();
            await server.connect(managerWallet).whitelistToken(await m.getAddress(), 2);
            for (let i = 0; i < 5; i++) await m.mint(managerWallet.address);
            await m.connect(managerWallet).setApprovalForAll(serverAddr, true);
            for (let i = 0; i < 5; i++) await m.connect(managerWallet).transferFrom(managerWallet.address, serverAddr, i);
            const tokenId = 70;
            await server.connect(managerWallet).createTokenAndReserveRewards(
                { tokenId, tokenUri: 'nft', maxSupply: 5, rewards: [{ rewardType: 2, rewardAmount: 1, rewardTokenAddress: await m.getAddress(), rewardTokenIds: [0, 1, 2, 3, 4], rewardTokenId: 0 }] },
                { value: 0 }
            );
            expect(await manager.getRemainingSupply(SERVER_ID, tokenId)).to.equal(5);
            await server.connect(managerWallet).reduceRewardSupply(tokenId, 2);
            expect(await manager.getRemainingSupply(SERVER_ID, tokenId)).to.equal(3);
            await expect(server.connect(managerWallet).withdrawERC721UnreservedTreasury(await m.getAddress(), user1.address, 3)).to.not.be.reverted;
            await expect(server.connect(managerWallet).withdrawERC721UnreservedTreasury(await m.getAddress(), user1.address, 4)).to.not.be.reverted;
            expect(await m.ownerOf(3)).to.equal(user1.address);
            expect(await m.ownerOf(4)).to.equal(user1.address);
        });
    });

    describe('increaseRewardSupply errors', function () {
        it('reverts with TokenNotExist', async function () {
            const { server, managerWallet } = await loadFixture(deployWithServerAndTokenFixture);
            await expect(server.connect(managerWallet).increaseRewardSupply(999, 1, { value: 0 }))
                .to.be.revertedWithCustomError(server, 'TokenNotExist');
        });

        it('reverts with InvalidAmount when _additionalSupply is zero', async function () {
            const { server, managerWallet, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
            await server.connect(managerWallet).createTokenAndReserveRewards(
                { tokenId: 1, tokenUri: 'u', maxSupply: 2, rewards: [{ rewardType: 1, rewardAmount: 1n, rewardTokenAddress: await mockERC20.getAddress(), rewardTokenIds: [], rewardTokenId: 0 }] },
                { value: 0 }
            );
            await expect(server.connect(managerWallet).increaseRewardSupply(1, 0, { value: 0 }))
                .to.be.revertedWithCustomError(server, 'InvalidAmount');
        });

        it('reverts with InsufficientERC721Ids when increasing supply for ERC721 reward token', async function () {
            const { server, managerWallet } = await loadFixture(deployWithServerAndTokenFixture);
            const MockERC721 = await ethers.getContractFactory('MockERC721');
            const mockERC721 = await MockERC721.deploy();
            await mockERC721.waitForDeployment();
            const serverAddr = await server.getAddress();
            await server.connect(managerWallet).whitelistToken(await mockERC721.getAddress(), 2);
            for (let i = 0; i < 2; i++) await mockERC721.mint(managerWallet.address);
            await mockERC721.connect(managerWallet).setApprovalForAll(serverAddr, true);
            await mockERC721.connect(managerWallet).transferFrom(managerWallet.address, serverAddr, 0);
            await mockERC721.connect(managerWallet).transferFrom(managerWallet.address, serverAddr, 1);
            await server.connect(managerWallet).createTokenAndReserveRewards(
                { tokenId: 50, tokenUri: 'nft', maxSupply: 2, rewards: [{ rewardType: 2, rewardAmount: 1, rewardTokenAddress: await mockERC721.getAddress(), rewardTokenIds: [0, 1], rewardTokenId: 0 }] },
                { value: 0 }
            );
            await expect(server.connect(managerWallet).increaseRewardSupply(50, 1, { value: 0 }))
                .to.be.revertedWithCustomError(server, 'InsufficientERC721Ids');
        });

        it('reverts with InsufficientBalance when increasing ETH reward supply without enough msg.value', async function () {
            const { server, managerWallet } = await loadFixture(deployWithServerAndTokenFixture);
            await server.connect(managerWallet).createTokenAndReserveRewards(
                { tokenId: 80, tokenUri: 'eth', maxSupply: 1, rewards: [{ rewardType: 0, rewardAmount: ethers.parseEther('0.5'), rewardTokenAddress: ethers.ZeroAddress, rewardTokenIds: [], rewardTokenId: 0 }] },
                { value: ethers.parseEther('0.5') }
            );
            await expect(server.connect(managerWallet).increaseRewardSupply(80, 1, { value: 0 }))
                .to.be.revertedWithCustomError(server, 'InsufficientBalance');
        });

        it('reverts with InsufficientTreasuryBalance when increasing ERC20 supply without enough balance', async function () {
            const { server, managerWallet } = await loadFixture(deployWithServerAndTokenFixture);
            const MockERC20B = await ethers.getContractFactory('MockERC20');
            const mockB = await MockERC20B.deploy('B', 'B');
            await mockB.waitForDeployment();
            await mockB.mint(managerWallet.address, ethers.parseEther('100'));
            await server.connect(managerWallet).whitelistToken(await mockB.getAddress(), 1);
            await mockB.connect(managerWallet).transfer(await server.getAddress(), ethers.parseEther('20'));
            await server.connect(managerWallet).createTokenAndReserveRewards(
                { tokenId: 81, tokenUri: 'u', maxSupply: 2, rewards: [{ rewardType: 1, rewardAmount: ethers.parseEther('10'), rewardTokenAddress: await mockB.getAddress(), rewardTokenIds: [], rewardTokenId: 0 }] },
                { value: 0 }
            );
            await expect(server.connect(managerWallet).increaseRewardSupply(81, 5, { value: 0 }))
                .to.be.revertedWithCustomError(server, 'InsufficientTreasuryBalance');
        });
    });

    describe('server pause', function () {
        it('server pause blocks claim via router even with valid signature', async function () {
            const { manager, server, managerWallet, user1, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
            const tokenId = 1;
            await server.connect(managerWallet).createTokenAndReserveRewards(
                { tokenId, tokenUri: 'u', maxSupply: 1, rewards: [{ rewardType: 1, rewardAmount: ethers.parseEther('1'), rewardTokenAddress: await mockERC20.getAddress(), rewardTokenIds: [], rewardTokenId: 0 }] },
                { value: 0 }
            );
            const { data, signature } = await buildClaimDataAndSignature(await server.getAddress(), SERVER_ID, managerWallet, user1.address, [tokenId], 0);
            await server.connect(managerWallet).pause();
            await expect(manager.connect(user1).claim(data, signature))
                .to.be.revertedWithCustomError(server, 'EnforcedPause');
            await server.connect(managerWallet).unpause();
            await manager.connect(user1).claim(data, signature);
            expect(await mockERC20.balanceOf(user1.address)).to.equal(ethers.parseEther('1'));
        });
    });

    describe('server view helpers', function () {
        it('getRemainingRewardSupply returns 0 for non-existent token', async function () {
            const { server } = await loadFixture(deployWithServerAndTokenFixture);
            expect(await server.getRemainingRewardSupply(999)).to.equal(0);
        });

        it('getRemainingRewardSupply returns 0 when supply exhausted', async function () {
            const { manager, server, managerWallet, user1, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
            const tokenId = 1;
            await server.connect(managerWallet).createTokenAndReserveRewards(
                { tokenId, tokenUri: 'u', maxSupply: 1, rewards: [{ rewardType: 1, rewardAmount: ethers.parseEther('1'), rewardTokenAddress: await mockERC20.getAddress(), rewardTokenIds: [], rewardTokenId: 0 }] },
                { value: 0 }
            );
            const { data, signature } = await buildClaimDataAndSignature(await server.getAddress(), SERVER_ID, managerWallet, user1.address, [tokenId], 0);
            await manager.connect(user1).claim(data, signature);
            expect(await server.getRemainingRewardSupply(tokenId)).to.equal(0);
        });

        it('getEthRequiredForIncreaseSupply returns required ETH for ETHER reward token', async function () {
            const { server, managerWallet } = await loadFixture(deployWithServerAndTokenFixture);
            const tokenId = 1;
            await server.connect(managerWallet).createTokenAndReserveRewards(
                { tokenId, tokenUri: 'eth', maxSupply: 2, rewards: [{ rewardType: 0, rewardAmount: ethers.parseEther('0.5'), rewardTokenAddress: ethers.ZeroAddress, rewardTokenIds: [], rewardTokenId: 0 }] },
                { value: ethers.parseEther('1') }
            );
            expect(await server.getEthRequiredForIncreaseSupply(tokenId, 2)).to.equal(ethers.parseEther('1'));
            expect(await server.getEthRequiredForIncreaseSupply(tokenId, 0)).to.equal(0);
        });

        it('getERC721RewardCurrentIndex returns index after claims', async function () {
            const { manager, server, managerWallet, user1 } = await loadFixture(deployWithServerAndTokenFixture);
            const MockERC721 = await ethers.getContractFactory('MockERC721');
            const mockERC721 = await MockERC721.deploy();
            await mockERC721.waitForDeployment();
            const serverAddr = await server.getAddress();
            await server.connect(managerWallet).whitelistToken(await mockERC721.getAddress(), 2);
            for (let i = 0; i < 3; i++) await mockERC721.mint(managerWallet.address);
            await mockERC721.connect(managerWallet).setApprovalForAll(serverAddr, true);
            for (let i = 0; i < 3; i++) await mockERC721.connect(managerWallet).transferFrom(managerWallet.address, serverAddr, i);
            const tokenId = 10;
            await server.connect(managerWallet).createTokenAndReserveRewards(
                { tokenId, tokenUri: 'nft', maxSupply: 3, rewards: [{ rewardType: 2, rewardAmount: 1, rewardTokenAddress: await mockERC721.getAddress(), rewardTokenIds: [0, 1, 2], rewardTokenId: 0 }] },
                { value: 0 }
            );
            expect(await server.getERC721RewardCurrentIndex(tokenId, 0)).to.equal(0);
            await manager.connect(user1).claim((await buildClaimDataAndSignature(serverAddr, SERVER_ID, managerWallet, user1.address, [tokenId], 0)).data, (await buildClaimDataAndSignature(serverAddr, SERVER_ID, managerWallet, user1.address, [tokenId], 0)).signature);
            expect(await server.getERC721RewardCurrentIndex(tokenId, 0)).to.equal(1);
        });

        it('getRewardToken returns full reward token struct', async function () {
            const { server, managerWallet, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
            const tokenId = 1;
            await server.connect(managerWallet).createTokenAndReserveRewards(
                { tokenId, tokenUri: 'https://meta/1', maxSupply: 5, rewards: [{ rewardType: 1, rewardAmount: ethers.parseEther('2'), rewardTokenAddress: await mockERC20.getAddress(), rewardTokenIds: [], rewardTokenId: 0 }] },
                { value: 0 }
            );
            const rt = await server.getRewardToken(tokenId);
            expect(rt.tokenUri).to.equal('https://meta/1');
            expect(rt.maxSupply).to.equal(5);
            expect(rt.rewards.length).to.equal(1);
            expect(rt.rewards[0].rewardAmount).to.equal(ethers.parseEther('2'));
        });

        it('decodeClaimData decodes correctly', async function () {
            const { server } = await loadFixture(deployWithServerAndTokenFixture);
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'address', 'uint256', 'uint8', 'uint256[]'],
                [await server.getAddress(), chainId, '0x0000000000000000000000000000000000000002', 3n, 1, [5, 6]]
            );
            const d = await server.decodeClaimData(data);
            expect(d.contractAddress).to.equal(await server.getAddress());
            expect(d.beneficiary).to.equal('0x0000000000000000000000000000000000000002');
            expect(d.userNonce).to.equal(3n);
            expect(d.serverId).to.equal(1);
            expect(d.tokenIds).to.deep.equal([5n, 6n]);
        });

        it('getAvailableTreasuryBalance returns 0 when balance <= reserved', async function () {
            const { server, managerWallet, mockERC20 } = await loadFixture(deployWithServerAndTokenFixture);
            await server.connect(managerWallet).createTokenAndReserveRewards(
                { tokenId: 1, tokenUri: 'u', maxSupply: 1, rewards: [{ rewardType: 1, rewardAmount: ethers.parseEther('1000'), rewardTokenAddress: await mockERC20.getAddress(), rewardTokenIds: [], rewardTokenId: 0 }] },
                { value: 0 }
            );
            expect(await server.getAvailableTreasuryBalance(await mockERC20.getAddress())).to.equal(0);
        });

        it('supportsInterface returns true for supported interfaces', async function () {
            const { server } = await loadFixture(deployWithServerAndTokenFixture);
            const IERC165 = '0x01ffc9a7';
            expect(await server.supportsInterface(IERC165)).to.equal(true);
            const bogus = '0xdeadbeef';
            expect(await server.supportsInterface(bogus)).to.equal(false);
        });

        it('getAllTreasuryBalances includes multiple distinct ERC1155 reward tokens', async function () {
            const { manager, server, managerWallet } = await loadFixture(deployWithServerAndTokenFixture);
            const MockERC1155 = await ethers.getContractFactory('MockERC1155');
            const m = await MockERC1155.deploy();
            await m.waitForDeployment();
            await server.connect(managerWallet).whitelistToken(await m.getAddress(), 3);
            await m.mint(managerWallet.address, 1, 100, '0x');
            await m.mint(managerWallet.address, 2, 50, '0x');
            await m.connect(managerWallet).setApprovalForAll(await server.getAddress(), true);
            await m.connect(managerWallet).safeTransferFrom(managerWallet.address, await server.getAddress(), 1, 100, '0x');
            await m.connect(managerWallet).safeTransferFrom(managerWallet.address, await server.getAddress(), 2, 50, '0x');
            await server.connect(managerWallet).createTokenAndReserveRewards(
                { tokenId: 90, tokenUri: '1155a', maxSupply: 2, rewards: [{ rewardType: 3, rewardAmount: 10, rewardTokenAddress: await m.getAddress(), rewardTokenIds: [], rewardTokenId: 1 }] },
                { value: 0 }
            );
            await server.connect(managerWallet).createTokenAndReserveRewards(
                { tokenId: 91, tokenUri: '1155b', maxSupply: 1, rewards: [{ rewardType: 3, rewardAmount: 5, rewardTokenAddress: await m.getAddress(), rewardTokenIds: [], rewardTokenId: 2 }] },
                { value: 0 }
            );
            const [addresses, totalBalances, reservedBalances, availableBalances, symbols, names, types, tokenIds] = await manager.getServerTreasuryBalances(SERVER_ID);
            expect(addresses.length).to.be.gte(3);
            const erc1155Count = tokenIds.filter((id: bigint) => id > 0n).length;
            expect(erc1155Count).to.equal(2);
        });
    });
});

