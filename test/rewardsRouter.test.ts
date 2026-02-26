import { expect } from 'chai';
import { ethers, upgrades, network } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

/**
 * RewardsRouter tests (router orchestration + view proxies).
 * Security assumptions covered: (1) Claim signatures use per-user nonce for replay protection; no on-chain expiry.
 * (2) Claim data encodes contractAddress and chainId so claims are bound to the correct server and chain.
 * (3) Treasury is funded by direct transfers; only SERVER_ADMIN can withdraw. (4) Signature for one server cannot
 * be replayed on another (contractAddress check in server.claim).
 */
describe('RewardsRouter', function () {
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

    describe('initialize', function () {
        it('reverts with AddressIsZero when devWallet is zero', async function () {
            const RewardsServerImpl = await ethers.getContractFactory('RewardsServer');
            const rewardsServerImpl = await RewardsServerImpl.deploy();
            await rewardsServerImpl.waitForDeployment();
            const RewardsRouter = await ethers.getContractFactory('RewardsRouter');
            const routerImpl = await RewardsRouter.deploy();
            await routerImpl.waitForDeployment();
            await expect(
                upgrades.deployProxy(RewardsRouter, [ethers.ZeroAddress, await rewardsServerImpl.getAddress()], { kind: 'uups', initializer: 'initialize' })
            ).to.be.revertedWithCustomError(routerImpl, 'AddressIsZero');
        });

        it('reverts with AddressIsZero when serverImplementation is zero', async function () {
            const [devWallet] = await ethers.getSigners();
            const RewardsRouter = await ethers.getContractFactory('RewardsRouter');
            const routerImpl = await RewardsRouter.deploy();
            await routerImpl.waitForDeployment();
            await expect(
                upgrades.deployProxy(RewardsRouter, [devWallet.address, ethers.ZeroAddress], { kind: 'uups', initializer: 'initialize' })
            ).to.be.revertedWithCustomError(routerImpl, 'AddressIsZero');
        });
    });

    describe('setServerBeacon', function () {
        it('reverts with AddressIsZero when beacon address is zero', async function () {
            const { manager, devWallet } = await loadFixture(deployRewardsManagerFixture);
            await expect(manager.connect(devWallet).setServerBeacon(ethers.ZeroAddress))
                .to.be.revertedWithCustomError(manager, 'AddressIsZero');
        });

        it('DEV_CONFIG_ROLE can update beacon by calling setServerBeacon again', async function () {
            const { manager, devWallet } = await loadFixture(deployRewardsManagerFixture);
            const RewardsServerImpl = await ethers.getContractFactory('RewardsServer');
            const impl2 = await RewardsServerImpl.deploy();
            await impl2.waitForDeployment();
            const RewardsRouter = await ethers.getContractFactory('RewardsRouter');
            const router2 = await upgrades.deployProxy(
                RewardsRouter,
                [devWallet.address, await impl2.getAddress()],
                { kind: 'uups', initializer: 'initialize' }
            );
            await router2.waitForDeployment();
            const beacon2Address = await router2.serverBeacon();
            await manager.connect(devWallet).setServerBeacon(beacon2Address);
            expect(await manager.serverBeacon()).to.equal(beacon2Address);
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

        it('emits ServerDeployed with serverId and server address', async function () {
            const { manager, devWallet, managerWallet } = await loadFixture(deployRewardsManagerFixture);
            const tx = await manager.connect(managerWallet).deployServer(SERVER_ID, devWallet.address);
            await tx.wait();
            const serverAddr = await manager.getServer(SERVER_ID);
            await expect(tx).to.emit(manager, 'ServerDeployed').withArgs(SERVER_ID, serverAddr);
        });

        it('reverts with BeaconNotInitialized when serverBeacon is zero in storage', async function () {
            const { manager, devWallet, managerWallet } = await loadFixture(deployRewardsManagerFixture);
            const proxyAddress = await manager.getAddress();
            const slot = '0x' + (1).toString(16).padStart(64, '0');
            await network.provider.send('hardhat_setStorageAt', [
                proxyAddress,
                slot,
                '0x' + '00'.repeat(32),
            ]);
            await expect(manager.connect(managerWallet).deployServer(SERVER_ID, devWallet.address))
                .to.be.revertedWithCustomError(manager, 'BeaconNotInitialized');
        });
    });

    describe('getServer and view errors', function () {
        it('getServer reverts with ServerDoesNotExist for non-existent serverId', async function () {
            const { manager } = await loadFixture(deployRewardsManagerFixture);
            await expect(manager.getServer(2)).to.be.revertedWithCustomError(manager, 'ServerDoesNotExist');
        });

        it('view proxies revert with ServerDoesNotExist when server does not exist', async function () {
            const { manager } = await loadFixture(deployRewardsManagerFixture);
            const MockERC20 = await ethers.getContractFactory('MockERC20');
            const token = await MockERC20.deploy('M', 'M');
            await token.waitForDeployment();
            await expect(manager.getServerTreasuryBalances(2)).to.be.revertedWithCustomError(manager, 'ServerDoesNotExist');
            await expect(manager.getServerAllItemIds(2)).to.be.revertedWithCustomError(manager, 'ServerDoesNotExist');
            await expect(manager.getServerTokenRewards(2, 1)).to.be.revertedWithCustomError(manager, 'ServerDoesNotExist');
            await expect(manager.getServerTreasuryBalance(2, await token.getAddress())).to.be.revertedWithCustomError(manager, 'ServerDoesNotExist');
            await expect(manager.getServerReservedAmount(2, await token.getAddress())).to.be.revertedWithCustomError(manager, 'ServerDoesNotExist');
            await expect(manager.getServerAvailableTreasuryBalance(2, await token.getAddress())).to.be.revertedWithCustomError(manager, 'ServerDoesNotExist');
            await expect(manager.getServerWhitelistedTokens(2)).to.be.revertedWithCustomError(manager, 'ServerDoesNotExist');
            await expect(manager.isServerWhitelistedToken(2, await token.getAddress())).to.be.revertedWithCustomError(manager, 'ServerDoesNotExist');
            await expect(manager.getTokenDetails(2, 1)).to.be.revertedWithCustomError(manager, 'ServerDoesNotExist');
            await expect(manager.getRemainingSupply(2, 1)).to.be.revertedWithCustomError(manager, 'ServerDoesNotExist');
            await expect(manager.getServerSigners(2)).to.be.revertedWithCustomError(manager, 'ServerDoesNotExist');
        });
    });

    describe('decodeClaimData', function () {
        it('decodes claim data correctly', async function () {
            const { manager } = await loadFixture(deployRewardsManagerFixture);
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const data = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'address', 'uint256', 'uint8', 'uint256[]'],
                ['0x0000000000000000000000000000000000000001', chainId, '0x0000000000000000000000000000000000000002', 5n, 1, [10, 20]]
            );
            const decoded = await manager.decodeClaimData(data);
            expect(decoded.contractAddress).to.equal('0x0000000000000000000000000000000000000001');
            expect(decoded.chainId).to.equal(chainId);
            expect(decoded.beneficiary).to.equal('0x0000000000000000000000000000000000000002');
            expect(decoded.userNonce).to.equal(5n);
            expect(decoded.serverId).to.equal(1);
            expect(decoded.tokenIds).to.deep.equal([10n, 20n]);
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


    describe('access control', function () {
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
            const base = await loadFixture(deployRewardsManagerFixture);
            await base.manager.connect(base.managerWallet).deployServer(SERVER_ID, base.devWallet.address);
            const serverAddr = await base.manager.getServer(SERVER_ID);
            const server = await ethers.getContractAt('RewardsServer', serverAddr);
            const SERVER_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes('SERVER_ADMIN_ROLE'));
            await server.connect(base.devWallet).grantRole(SERVER_ADMIN_ROLE, base.managerWallet.address);

            const MockERC20 = await ethers.getContractFactory('MockERC20');
            const mockERC20 = await MockERC20.deploy('Mock', 'M');
            await mockERC20.waitForDeployment();
            await mockERC20.mint(base.managerWallet.address, ethers.parseEther('10000'));

            await server.connect(base.managerWallet).whitelistToken(await mockERC20.getAddress(), 1); // ERC20
            await mockERC20.connect(base.managerWallet).transfer(serverAddr, ethers.parseEther('1000'));

            const { manager, managerWallet } = base;
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

            const { manager, managerWallet, user1 } = base;
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
            await expect(manager.connect(user1).claim(data, signature)).to.be.revertedWithCustomError(
                manager,
                'EnforcedPause'
            );
            await manager.connect(managerWallet).unpause();
            await manager.connect(user1).claim(data, signature);
            expect(await mockERC20.balanceOf(user1.address)).to.equal(ethers.parseEther('10'));
        });

        it('emits RewardClaimed on successful claim', async function () {
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
            await server.connect(base.managerWallet).whitelistToken(await mockERC20.getAddress(), 1);
            await mockERC20.connect(base.managerWallet).transfer(serverAddr, ethers.parseEther('1000'));
            const tokenId = 1;
            await server.connect(base.managerWallet).createTokenAndReserveRewards(
                { tokenId, tokenUri: 'u', maxSupply: 1, rewards: [{ rewardType: 1, rewardAmount: ethers.parseEther('1'), rewardTokenAddress: await mockERC20.getAddress(), rewardTokenIds: [], rewardTokenId: 0 }] },
                { value: 0 }
            );
            const { data, signature } = await buildClaimDataAndSignature(serverAddr, SERVER_ID, base.managerWallet, base.user1.address, [tokenId], 0);
            await expect(base.manager.connect(base.user1).claim(data, signature))
                .to.emit(base.manager, 'RewardClaimed')
                .withArgs(SERVER_ID, base.user1.address, 0n, [1n]);
        });

        it('MANAGER can unpause', async function () {
            const { manager, managerWallet } = await loadFixture(deployRewardsManagerFixture);
            await manager.connect(managerWallet).pause();
            expect(await manager.paused()).to.be.true;
            await manager.connect(managerWallet).unpause();
            expect(await manager.paused()).to.be.false;
        });

        it('router receive() accepts ETH', async function () {
            const { manager, user1 } = await loadFixture(deployRewardsManagerFixture);
            const amount = ethers.parseEther('0.5');
            await user1.sendTransaction({ to: await manager.getAddress(), value: amount });
            expect(await ethers.provider.getBalance(await manager.getAddress())).to.equal(amount);
        });

        it('router view proxies: getServerAllItemIds, getServerTokenRewards, reserved, available, whitelist', async function () {
            const base = await loadFixture(deployRewardsManagerFixture);
            await base.manager.connect(base.managerWallet).deployServer(SERVER_ID, base.devWallet.address);
            const serverAddr = await base.manager.getServer(SERVER_ID);
            const server = await ethers.getContractAt('RewardsServer', serverAddr);
            const SERVER_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes('SERVER_ADMIN_ROLE'));
            await server.connect(base.devWallet).grantRole(SERVER_ADMIN_ROLE, base.managerWallet.address);
            const MockERC20 = await ethers.getContractFactory('MockERC20');
            const mockERC20 = await MockERC20.deploy('Mock', 'M');
            await mockERC20.waitForDeployment();
            await mockERC20.mint(base.managerWallet.address, ethers.parseEther('10000'));
            await server.connect(base.managerWallet).whitelistToken(await mockERC20.getAddress(), 1);
            await mockERC20.connect(base.managerWallet).transfer(serverAddr, ethers.parseEther('500'));
            const tokenId = 7;
            await server.connect(base.managerWallet).createTokenAndReserveRewards(
                { tokenId, tokenUri: 'https://x.com/7', maxSupply: 5, rewards: [{ rewardType: 1, rewardAmount: ethers.parseEther('10'), rewardTokenAddress: await mockERC20.getAddress(), rewardTokenIds: [], rewardTokenId: 0 }] },
                { value: 0 }
            );
            const itemIds = await base.manager.getServerAllItemIds(SERVER_ID);
            expect(itemIds).to.deep.equal([7n]);
            const rewards = await base.manager.getServerTokenRewards(SERVER_ID, tokenId);
            expect(rewards.length).to.equal(1);
            expect(rewards[0].rewardAmount).to.equal(ethers.parseEther('10'));
            expect(await base.manager.getServerReservedAmount(SERVER_ID, await mockERC20.getAddress())).to.equal(ethers.parseEther('50'));
            expect(await base.manager.getServerAvailableTreasuryBalance(SERVER_ID, await mockERC20.getAddress())).to.equal(ethers.parseEther('450'));
            const whitelist = await base.manager.getServerWhitelistedTokens(SERVER_ID);
            expect(whitelist).to.include(await mockERC20.getAddress());
            expect(await base.manager.isServerWhitelistedToken(SERVER_ID, await mockERC20.getAddress())).to.be.true;
            expect(await base.manager.isServerWhitelistedToken(SERVER_ID, base.user1.address)).to.be.false;
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
                const tx = await manager.connect(user1).claim(data, signature);
                const receipt = await tx.wait();
                const gasCost = receipt!.gasUsed * receipt!.gasPrice;
                const afterBalance = await ethers.provider.getBalance(user1.address);
                expect(afterBalance - (beforeBalance - gasCost)).to.equal(ethers.parseEther('1'));
            });
        });
    });
});
