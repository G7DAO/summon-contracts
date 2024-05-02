import { expect } from 'chai';
// @ts-ignore-next-line
import { ethers, SignerWithAddress, loadFixture } from 'hardhat';
import { deployContracts } from './fixture/contractsFixture';
import { MockERC20 } from '../../typechain-types';

describe('EnglishAuction', function () {
    let mockERC20: MockERC20;
    let deployer: SignerWithAddress;

    beforeEach(async function () {
        const [deployer] = await ethers.getSigners();

        [mockERC20] = await loadFixture(deployContracts);
    });
});
