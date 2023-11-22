import { log } from '@helpers/logger';
import { FacetCutAction, getSelectorsFacet } from '../libraries/selectors';
import { ethers } from 'hardhat';

import { DiamondCutFacet } from '../../typechain-types';

export async function deployFacet() {
    try {
        const [deployer] = await ethers.getSigners();
        const diamondAddress = process.env.DIAMOND_ADDRESS || 'FILL_ME';
        // const diamondAddress = process.env.DIAMOND_ADDRESS || '0x627203D940DE013a1582190b320A0CC1EA0FDA2d';

        // Deploy the AchievementFacet
        const AchievementFacetFactory = await ethers.getContractFactory('AchievementFacet');
        const achievementFacet = await AchievementFacetFactory.deploy('url://lol/lol');
        await achievementFacet.waitForDeployment();
        log('AchievementFacet deployed to:', achievementFacet.address);

        // Get the DiamondCut facet instance
        const diamondCutFacet = (await ethers.getContractAt('DiamondCutFacet', diamondAddress)) as DiamondCutFacet;

        // Prepare the cut
        const cut = [
            {
                action: FacetCutAction.Add, // Add facet
                facetAddress: achievementFacet.address,
                functionSelectors: getSelectorsFacet(achievementFacet),
            },
        ];

        log('Cut:', cut);

        // Execute the diamond cut
        const tx = await diamondCutFacet.diamondCut(cut, ethers.constants.AddressZero, '0x');
        await tx.wait();
        log('AchievementFacet added to the Diamond');
    } catch (error) {
        console.error(error);
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
if (require.main === module) {
    deployFacet()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
