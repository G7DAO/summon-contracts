import { ethers } from 'hardhat';
import { MockERC20 } from '../../../typechain-types';

/**
 * Deploys the contracts needed for the tests
 *
 */
export async function deployContracts() {
    const MockERC20Factory = await ethers.getContractFactory('MockERC20');
    const mockERC20 = (await MockERC20Factory.deploy('MockERC20', 'ME20')) as unknown as MockERC20;
    await mockERC20.waitForDeployment();

    return [mockERC20];
}
