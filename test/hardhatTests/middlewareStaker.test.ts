import { expect } from 'chai';
// @ts-ignore-next-line
import { ethers, upgrades } from 'hardhat';

describe('MiddlewareStaker', function () {
    let MiddlewareStaker;
    let middlewareStaker;
    let StakerMock;
    let stakerMock;
    let owner;
    let stakerRoleAddress;
    let playerAddress;
    let nonStaker;

    beforeEach(async function () {
        // Get signers
        [owner, stakerRoleAddress, playerAddress, nonStaker] = await ethers.getSigners();

        // Deploy a mock of the Staker contract
        StakerMock = await ethers.getContractFactory('StakerMock');
        stakerMock = await StakerMock.deploy();
        await stakerMock.deployed();

        // Deploy MiddlewareStaker contract
        MiddlewareStaker = await ethers.getContractFactory('MiddlewareStaker');
        middlewareStaker = await upgrades.deployProxy(MiddlewareStaker, [stakerMock.address, owner.address], {
            initializer: 'initialize',
        });

        // Grant STAKER_ROLE to stakerRoleAddress
        const STAKER_ROLE = await middlewareStaker.STAKER_ROLE();
        await middlewareStaker.connect(owner).grantRole(STAKER_ROLE, stakerRoleAddress.address);
    });

    describe('Deployment and Initialization', function () {
        it('Should set the correct staker contract address', async function () {
            expect(await middlewareStaker.stakerContract()).to.equal(stakerMock.address);
        });

        it('Should assign DEFAULT_ADMIN_ROLE and STAKER_ROLE to owner', async function () {
            const DEFAULT_ADMIN_ROLE = await middlewareStaker.DEFAULT_ADMIN_ROLE();
            const STAKER_ROLE = await middlewareStaker.STAKER_ROLE();
            expect(await middlewareStaker.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
            expect(await middlewareStaker.hasRole(STAKER_ROLE, owner.address)).to.be.true;
        });

        it('Should assign STAKER_ROLE to stakerRoleAddress', async function () {
            const STAKER_ROLE = await middlewareStaker.STAKER_ROLE();
            expect(await middlewareStaker.hasRole(STAKER_ROLE, stakerRoleAddress.address)).to.be.true;
        });
    });

    describe('Staking', function () {
        it('Should allow staking by STAKER_ROLE', async function () {
            const poolID = 1;
            const stakeAmount = ethers.utils.parseEther('1');

            await expect(
                middlewareStaker.connect(stakerRoleAddress).stakeNative(poolID, playerAddress.address, {
                    value: stakeAmount,
                })
            ).to.emit(middlewareStaker, 'Staked');

            const positionTokenID = await stakerMock.latestPositionTokenID();
            const position = await middlewareStaker.positions(positionTokenID);
            expect(position.user).to.equal(playerAddress.address);
            expect(position.poolID).to.equal(poolID);
            expect(position.amount).to.equal(stakeAmount);
            expect(position.active).to.be.true;

            const userPositions = await middlewareStaker.userPositions(playerAddress.address);
            expect(userPositions.length).to.equal(1);
            expect(userPositions[0]).to.equal(positionTokenID);
        });

        it('Should not allow staking by non-STAKER_ROLE', async function () {
            const poolID = 1;
            const stakeAmount = ethers.utils.parseEther('1');

            await expect(
                middlewareStaker.connect(nonStaker).stakeNative(poolID, playerAddress.address, {
                    value: stakeAmount,
                })
            ).to.be.revertedWith(
                `AccessControl: account ${nonStaker.address.toLowerCase()} is missing role ${await middlewareStaker.STAKER_ROLE()}`
            );
        });

        it('Should revert if staking zero amount', async function () {
            const poolID = 1;

            await expect(
                middlewareStaker.connect(stakerRoleAddress).stakeNative(poolID, playerAddress.address, {
                    value: 0,
                })
            ).to.be.revertedWithCustomError(middlewareStaker, 'InvalidAmount');
        });
    });

    describe('Initiate Unstake', function () {
        it('Should allow initiate unstake by STAKER_ROLE', async function () {
            const poolID = 1;
            const stakeAmount = ethers.utils.parseEther('1');

            // Stake first
            await middlewareStaker.connect(stakerRoleAddress).stakeNative(poolID, playerAddress.address, {
                value: stakeAmount,
            });

            const positionTokenID = await stakerMock.latestPositionTokenID();

            // Initiate unstake
            await expect(
                middlewareStaker.connect(stakerRoleAddress).initiateUnstake(positionTokenID, playerAddress.address)
            ).to.emit(stakerMock, 'UnstakeInitiated');

            // Ensure the position is still active
            const position = await middlewareStaker.positions(positionTokenID);
            expect(position.active).to.be.true;
        });

        it('Should not allow initiate unstake by non-STAKER_ROLE', async function () {
            const poolID = 1;
            const stakeAmount = ethers.utils.parseEther('1');

            // Stake first
            await middlewareStaker.connect(stakerRoleAddress).stakeNative(poolID, playerAddress.address, {
                value: stakeAmount,
            });

            const positionTokenID = await stakerMock.latestPositionTokenID();

            // Attempt to initiate unstake by non-STAKER_ROLE
            await expect(
                middlewareStaker.connect(nonStaker).initiateUnstake(positionTokenID, playerAddress.address)
            ).to.be.revertedWith(
                `AccessControl: account ${nonStaker.address.toLowerCase()} is missing role ${await middlewareStaker.STAKER_ROLE()}`
            );
        });

        it('Should revert if position is inactive', async function () {
            const poolID = 1;
            const stakeAmount = ethers.utils.parseEther('1');

            // Stake first
            await middlewareStaker.connect(stakerRoleAddress).stakeNative(poolID, playerAddress.address, {
                value: stakeAmount,
            });

            const positionTokenID = await stakerMock.latestPositionTokenID();

            // Unstake to make position inactive
            await middlewareStaker
                .connect(stakerRoleAddress)
                .unstake(positionTokenID, playerAddress.address, { gasLimit: 3000000 });

            // Attempt to initiate unstake again
            await expect(
                middlewareStaker.connect(stakerRoleAddress).initiateUnstake(positionTokenID, playerAddress.address)
            ).to.be.revertedWithCustomError(middlewareStaker, 'PositionInactive');
        });
    });

    describe('Unstaking', function () {
        it('Should allow unstaking by STAKER_ROLE', async function () {
            const poolID = 1;
            const stakeAmount = ethers.utils.parseEther('1');

            // Stake first
            await middlewareStaker.connect(stakerRoleAddress).stakeNative(poolID, playerAddress.address, {
                value: stakeAmount,
            });

            const positionTokenID = await stakerMock.latestPositionTokenID();

            // Unstake
            const initialBalance = await stakerRoleAddress.getBalance();
            const tx = await middlewareStaker
                .connect(stakerRoleAddress)
                .unstake(positionTokenID, playerAddress.address, { gasLimit: 3000000 });

            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed.mul(tx.gasPrice || 0);
            const finalBalance = await stakerRoleAddress.getBalance();

            expect(finalBalance).to.equal(initialBalance.add(stakeAmount).sub(gasUsed));

            // Check that position is inactive
            const position = await middlewareStaker.positions(positionTokenID);
            expect(position.active).to.be.false;

            // Check that position is removed from user's active positions
            const userPositions = await middlewareStaker.userPositions(playerAddress.address);
            expect(userPositions.length).to.equal(0);
        });

        it('Should not allow unstaking by non-STAKER_ROLE', async function () {
            const poolID = 1;
            const stakeAmount = ethers.utils.parseEther('1');

            // Stake first
            await middlewareStaker.connect(stakerRoleAddress).stakeNative(poolID, playerAddress.address, {
                value: stakeAmount,
            });

            const positionTokenID = await stakerMock.latestPositionTokenID();

            // Attempt to unstake by non-STAKER_ROLE
            await expect(
                middlewareStaker.connect(nonStaker).unstake(positionTokenID, playerAddress.address)
            ).to.be.revertedWith(
                `AccessControl: account ${nonStaker.address.toLowerCase()} is missing role ${await middlewareStaker.STAKER_ROLE()}`
            );
        });

        it('Should revert if position is inactive', async function () {
            const poolID = 1;
            const stakeAmount = ethers.utils.parseEther('1');

            // Stake and then unstake
            await middlewareStaker.connect(stakerRoleAddress).stakeNative(poolID, playerAddress.address, {
                value: stakeAmount,
            });

            const positionTokenID = await stakerMock.latestPositionTokenID();

            await middlewareStaker
                .connect(stakerRoleAddress)
                .unstake(positionTokenID, playerAddress.address, { gasLimit: 3000000 });

            // Attempt to unstake again
            await expect(
                middlewareStaker.connect(stakerRoleAddress).unstake(positionTokenID, playerAddress.address)
            ).to.be.revertedWithCustomError(middlewareStaker, 'PositionInactive');
        });

        it('Should revert if not called by position owner', async function () {
            const poolID = 1;
            const stakeAmount = ethers.utils.parseEther('1');

            // Stake first
            await middlewareStaker.connect(stakerRoleAddress).stakeNative(poolID, playerAddress.address, {
                value: stakeAmount,
            });

            const positionTokenID = await stakerMock.latestPositionTokenID();

            // Attempt to unstake with incorrect player address
            await expect(
                middlewareStaker.connect(stakerRoleAddress).unstake(positionTokenID, nonStaker.address)
            ).to.be.revertedWithCustomError(middlewareStaker, 'NotYourPosition');
        });
    });

    describe('Access Control', function () {
        it('Should allow admin to grant and revoke STAKER_ROLE', async function () {
            const STAKER_ROLE = await middlewareStaker.STAKER_ROLE();

            // Grant STAKER_ROLE to nonStaker
            await middlewareStaker.connect(owner).grantRole(STAKER_ROLE, nonStaker.address);
            expect(await middlewareStaker.hasRole(STAKER_ROLE, nonStaker.address)).to.be.true;

            // Revoke STAKER_ROLE from nonStaker
            await middlewareStaker.connect(owner).revokeRole(STAKER_ROLE, nonStaker.address);
            expect(await middlewareStaker.hasRole(STAKER_ROLE, nonStaker.address)).to.be.false;
        });

        it('Should not allow non-admin to grant or revoke roles', async function () {
            const STAKER_ROLE = await middlewareStaker.STAKER_ROLE();

            // Attempt to grant STAKER_ROLE by non-admin
            await expect(
                middlewareStaker.connect(nonStaker).grantRole(STAKER_ROLE, nonStaker.address)
            ).to.be.revertedWith(
                `AccessControl: account ${nonStaker.address.toLowerCase()} is missing role ${await middlewareStaker.DEFAULT_ADMIN_ROLE()}`
            );

            // Attempt to revoke STAKER_ROLE by non-admin
            await expect(
                middlewareStaker.connect(nonStaker).revokeRole(STAKER_ROLE, stakerRoleAddress.address)
            ).to.be.revertedWith(
                `AccessControl: account ${nonStaker.address.toLowerCase()} is missing role ${await middlewareStaker.DEFAULT_ADMIN_ROLE()}`
            );
        });
    });
});
