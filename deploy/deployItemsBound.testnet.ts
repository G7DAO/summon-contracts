import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { ItemsBoundArgs } from '@constants/constructor-args';
import deploySoulbound1155Generic from './deploy.soulbound1155.generic';

const CONTRACT_NAME = 'Soulbound1155';
const CONTRACT_TYPE = 'Items';
const ABI_PATH = 'artifacts/contracts/Soulbound1155.sol/Soulbound1155.json';

export default async function (hre: HardhatRuntimeEnvironment) {
    await deploySoulbound1155Generic(
        hre,
        {
            CONTRACT_NAME,
            CONTRACT_TYPE,
            ABI_PATH,
        },
        ItemsBoundArgs.TESTNET
    );
}
