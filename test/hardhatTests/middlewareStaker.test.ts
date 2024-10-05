import { expect } from 'chai';
// @ts-ignore
import { ethers, upgrades } from 'hardhat';
import { MiddlewareStakerNativeTokenV1, PositionMetadata, Staker } from '../../typechain-types';
import { BigNumber, Signer, ZeroAddress } from 'ethers';

describe('MiddlewareStakerNativeTokenV1', function () {
    let middlewareStaker: MiddlewareStakerNativeTokenV1;
    let mockStaker: Staker;
    let owner: Signer;
    let stakerRole: Signer;
    let pauserRole: Signer;
    let user: Signer;
    let otherUser: Signer;
    let adminAddress: string;
    let poolId: number;

    beforeEach(async function () {
        [owner, stakerRole, pauserRole, user, otherUser] = await ethers.getSigners();
        adminAddress = await owner.getAddress();

        // Deploy PositionMetadata
        const PositionMetadataFactory = await ethers.getContractFactory('PositionMetadata');
        const positionMetadata = (await PositionMetadataFactory.deploy()) as PositionMetadata;

        // Deploy MockStaker with the positionMetadata address
        const MockStakerFactory = await ethers.getContractFactory('Staker');
        mockStaker = (await MockStakerFactory.deploy(positionMetadata.target)) as Staker;

        // Deploy MiddlewareStakerNativeTokenV1
        const MiddlewareStakerFactory = await ethers.getContractFactory('MiddlewareStakerNativeTokenV1');
        middlewareStaker = (await upgrades.deployProxy(MiddlewareStakerFactory, [mockStaker.target, adminAddress], {
            initializer: 'initialize',
        })) as MiddlewareStakerNativeTokenV1;

        // Grant STAKER_ROLE to stakerRole signer
        const STAKER_ROLE = await middlewareStaker.STAKER_ROLE();
        await middlewareStaker.connect(owner).grantRole(STAKER_ROLE, await stakerRole.getAddress());

        // Grant PAUSER_ROLE to pauserRole signer
        const PAUSER_ROLE = await middlewareStaker.PAUSER_ROLE();
        await middlewareStaker.connect(owner).grantRole(PAUSER_ROLE, await pauserRole.getAddress());

        await mockStaker.connect(stakerRole).createPool(1, ZeroAddress, 0, false, 1, 1);
        await mockStaker.connect(stakerRole).transferPoolAdministration(0, middlewareStaker.target);
        poolId = 0;
    });

    // Helper function to create a pool
    async function createPool(
        tokenType: number,
        tokenAddress: string,
        tokenID: number,
        transferable: boolean,
        lockupSeconds: number,
        cooldownSeconds: number
    ) {
        const tx = await mockStaker
            .connect(stakerRole)
            .createPool(tokenType, tokenAddress, tokenID, transferable, lockupSeconds, cooldownSeconds);
        await tx.wait();
    }

    async function stakePosition(playerAddress: string, stakeAmount: BigNumber = ethers.parseEther('1.0')) {
        const tx = await middlewareStaker
            .connect(stakerRole)
            .stakeNative(poolId, playerAddress, { value: stakeAmount });
        const receipt = await tx.wait();
        // Parse logs using the contract interface
        const events = receipt?.logs
            .filter((log) => log.address === middlewareStaker.target)
            .map((log) => middlewareStaker.interface.parseLog(log));

        // Find the 'Staked' event
        // @ts-ignore
        const event = events?.find((e) => e.name === 'Staked');
        return event?.args?.positionTokenID;
    }

    it('Should initialize correctly', async function () {
        expect(await middlewareStaker.stakerContract()).to.equal(mockStaker.target);

        const DEFAULT_ADMIN_ROLE = await middlewareStaker.DEFAULT_ADMIN_ROLE();
        expect(await middlewareStaker.hasRole(DEFAULT_ADMIN_ROLE, adminAddress)).to.be.true;

        const STAKER_ROLE = await middlewareStaker.STAKER_ROLE();
        expect(await middlewareStaker.hasRole(STAKER_ROLE, adminAddress)).to.be.true;

        const PAUSER_ROLE = await middlewareStaker.PAUSER_ROLE();
        expect(await middlewareStaker.hasRole(PAUSER_ROLE, adminAddress)).to.be.true;

        expect(await middlewareStaker.MINIMUM_STAKE_AMOUNT()).to.equal(1);
    });

    it('Should set MINIMUM_STAKE_AMOUNT when called by STAKER_ROLE', async function () {
        const newAmount = 100;
        await middlewareStaker.connect(owner).setMinimumStakeAmount(newAmount);
        expect(await middlewareStaker.MINIMUM_STAKE_AMOUNT()).to.equal(newAmount);
    });

    it('Should revert when setMinimumStakeAmount called by non-STAKER_ROLE', async function () {
        const newAmount = 100;
        await expect(middlewareStaker.connect(user).setMinimumStakeAmount(newAmount))
            .to.be.revertedWithCustomError(middlewareStaker, 'AccessControlUnauthorizedAccount')
            .withArgs(await user.getAddress(), await middlewareStaker.STAKER_ROLE());
    });

    it('Should revert when newAmount equals current MINIMUM_STAKE_AMOUNT', async function () {
        const newAmount = await middlewareStaker.MINIMUM_STAKE_AMOUNT();
        await expect(middlewareStaker.connect(owner).setMinimumStakeAmount(newAmount)).to.be.revertedWithCustomError(
            middlewareStaker,
            'InvalidAmount'
        );
    });

    it('Should stakeNative successfully when called by STAKER_ROLE', async function () {
        const stakeAmount = ethers.parseEther('1.0');
        const playerAddress = await user.getAddress();

        const totalPools = await mockStaker.TotalPools();
        expect(BigInt(1)).to.be.eq(totalPools);

        const tx = await middlewareStaker
            .connect(stakerRole)
            .stakeNative(poolId, playerAddress, { value: stakeAmount });
        const receipt = await tx.wait();

        // Parse logs using the contract interface
        const events = receipt?.logs
            .filter((log) => log.address === middlewareStaker.target)
            .map((log) => middlewareStaker.interface.parseLog(log));

        // Find the 'Staked' event
        // @ts-ignore
        const event = events?.find((e) => e.name === 'Staked');
        expect(event).to.not.be.undefined;

        const positionTokenID = event!.args.positionTokenID;

        const positionInfo = await middlewareStaker.positions(positionTokenID);
        expect(positionInfo.user).to.equal(playerAddress);
        expect(positionInfo.poolID).to.equal(poolId);
        expect(positionInfo.amount).to.equal(stakeAmount);
        expect(positionInfo.active).to.be.true;

        const userPositions = await middlewareStaker.getUserPositions(playerAddress);
        expect(userPositions).to.include(positionTokenID);

        expect(await middlewareStaker.totalStaked()).to.equal(stakeAmount);
        expect(await middlewareStaker.totalPositions()).to.equal(1);
    });

    it('Should revert when stakeNative called by non-STAKER_ROLE', async function () {
        const poolID = 1;
        const stakeAmount = ethers.parseEther('1.0');
        const playerAddress = await user.getAddress();

        await expect(middlewareStaker.connect(user).stakeNative(poolID, playerAddress, { value: stakeAmount }))
            .to.be.revertedWithCustomError(middlewareStaker, 'AccessControlUnauthorizedAccount')
            .withArgs(await user.getAddress(), await middlewareStaker.STAKER_ROLE());
    });

    it('Should unstake successfully when called by STAKER_ROLE', async function () {
        const playerAddress = await user.getAddress();
        const positionTokenID = await stakePosition(playerAddress);

        const initiateUnstakeTx = await middlewareStaker
            .connect(stakerRole)
            .initiateUnstake(positionTokenID, playerAddress);
        await initiateUnstakeTx.wait();

        const tx = await middlewareStaker.connect(stakerRole).unstake(positionTokenID, playerAddress);
        await expect(tx)
            .to.emit(middlewareStaker, 'Unstaked')
            .withArgs(playerAddress, positionTokenID, ethers.parseEther('1.0'), await stakerRole.getAddress());
    });

    it('Should initiateUnstake successfully when called by STAKER_ROLE', async function () {
        const playerAddress = await user.getAddress();
        const positionTokenID = await stakePosition(playerAddress);

        const tx = await middlewareStaker.connect(stakerRole).initiateUnstake(positionTokenID, playerAddress);
        await expect(tx)
            .to.emit(middlewareStaker, 'UnstakeInitiated')
            .withArgs(playerAddress, positionTokenID, await stakerRole.getAddress());
    });

    it('Should revert when pause called by non-PAUSER_ROLE', async function () {
        await expect(middlewareStaker.connect(user).pause())
            .to.be.revertedWithCustomError(middlewareStaker, 'AccessControlUnauthorizedAccount')
            .withArgs(await user.getAddress(), await middlewareStaker.PAUSER_ROLE());
    });

    it('Should accept TG7T via receive function', async function () {
        const sendAmount = ethers.parseEther('1.0');
        const tx = await user.sendTransaction({
            to: middlewareStaker.target,
            value: sendAmount,
        });

        await tx.wait();

        const contractBalance = await ethers.provider.getBalance(middlewareStaker.target);
        expect(contractBalance).to.equal(sendAmount);
    });

    it('Should handle staking into pools with 72h cooldown and 12/24 months lockup', async function () {
        const NATIVE_TOKEN_TYPE = await mockStaker.NATIVE_TOKEN_TYPE();

        const twelveMonthsInSeconds = 12 * 30 * 24 * 60 * 60; // 12 months
        const twentyFourMonthsInSeconds = 24 * 30 * 24 * 60 * 60; // 24 months
        const seventyTwoHoursInSeconds = 72 * 60 * 60; // 72 hours

        // Create pools
        await createPool(
            Number(NATIVE_TOKEN_TYPE),
            ZeroAddress,
            0,
            false,
            twelveMonthsInSeconds,
            seventyTwoHoursInSeconds
        );

        await createPool(
            Number(NATIVE_TOKEN_TYPE),
            ZeroAddress,
            0,
            false,
            twentyFourMonthsInSeconds,
            seventyTwoHoursInSeconds
        );

        // transfer owner of staking to the middleware
        await mockStaker.connect(stakerRole).transferPoolAdministration(1, middlewareStaker.target);
        await mockStaker.connect(stakerRole).transferPoolAdministration(2, middlewareStaker.target);

        // Verify total pools
        const totalPools = await mockStaker.TotalPools();
        expect(totalPools).to.equal(3); // 2 here and 1 created in beforeEach

        const stakeAmount = ethers.parseEther('1.0');
        const playerAddress = await user.getAddress();

        // Stake into the 12-month lockup pool (poolID 0)
        const tx1 = await middlewareStaker.connect(stakerRole).stakeNative(1, playerAddress, { value: stakeAmount });
        const receipt1 = await tx1.wait();

        // Parse logs to get the positionTokenID
        const events1 = receipt1?.logs
            .filter((log) => log.address === middlewareStaker.target)
            .map((log) => middlewareStaker.interface.parseLog(log));

        const event1 = events1?.find((e) => e?.name === 'Staked');
        expect(event1).to.not.be.undefined;
        const positionTokenID1 = event1!.args.positionTokenID;

        // Stake into the 24-month lockup pool (poolID 1)
        const tx2 = await middlewareStaker.connect(stakerRole).stakeNative(2, playerAddress, { value: stakeAmount });
        const receipt2 = await tx2.wait();

        const events2 = receipt2?.logs
            .filter((log) => log.address === middlewareStaker.target)
            .map((log) => middlewareStaker.interface.parseLog(log));

        const event2 = events2?.find((e) => e?.name === 'Staked');
        expect(event2).to.not.be.undefined;
        const positionTokenID2 = event2!.args.positionTokenID;

        // Check positions
        const positionInfo1 = await middlewareStaker.positions(positionTokenID1);
        expect(positionInfo1.user).to.equal(playerAddress);
        expect(positionInfo1.poolID).to.equal(1);
        expect(positionInfo1.amount).to.equal(stakeAmount);
        expect(positionInfo1.active).to.be.true;

        const positionInfo2 = await middlewareStaker.positions(positionTokenID2);
        expect(positionInfo2.user).to.equal(playerAddress);
        expect(positionInfo2.poolID).to.equal(2);
        expect(positionInfo2.amount).to.equal(stakeAmount);
        expect(positionInfo2.active).to.be.true;

        // Verify total staked and positions
        expect(await middlewareStaker.totalStaked()).to.equal(stakeAmount * BigInt(2));
        expect(await middlewareStaker.totalPositions()).to.equal(2);

        const unlockAt = positionInfo1.unlockAt;

        await expect(middlewareStaker.connect(stakerRole).initiateUnstake(positionTokenID1, playerAddress))
            .to.be.revertedWithCustomError(mockStaker, 'LockupNotExpired')
            .withArgs(unlockAt);

        // Attempt to unstake before cooldown period (should fail due to cooldown)
        await expect(middlewareStaker.connect(stakerRole).unstake(positionTokenID1, playerAddress)).to.be.reverted;
    });
});
