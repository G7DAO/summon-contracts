import { ItemsBoundArgs } from '@constants/constructor-args';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import deploySoulbound1155Generic from './deploy.soulbound1155.generic';

const CONTRACT_NAME = 'ItemBound';
const CONTRACT_TYPE = 'Items';
const ABI_PATH = 'artifacts-zk/contracts/ItemBound.sol/ItemBound.json';

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
