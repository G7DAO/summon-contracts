import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { SoulBoundBadgesArgs } from '@constants/constructor-args';
import deploySoulBound1155Generic from './deploy.soulbound1155.generic';

const CONTRACT_NAME = 'SoulBound1155';
const CONTRACT_TYPE = 'Badges';
const ABI_PATH = 'artifacts/contracts/SoulBound1155.sol/SoulBound1155.json';

export default async function (hre: HardhatRuntimeEnvironment) {
    await deploySoulBound1155Generic(
        hre,
        {
            CONTRACT_NAME,
            CONTRACT_TYPE,
            ABI_PATH,
        },
        SoulBoundBadgesArgs.TESTNET
    );
}
