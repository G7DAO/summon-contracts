import { ItemsBoundArgs } from '@constants/constructor-args';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import deploySoulbound1155UpgradeableGeneric from './deploy.soulbound1155Upgradeable.generic';

const CONTRACT_NAME = 'ItemBoundV1';
const CONTRACT_TYPE = 'Items';
const ABI_PATH = 'artifacts-zk/contracts/upgradeables/ItemBoundV1.sol/ItemBoundV1.json';

export default async function (hre: HardhatRuntimeEnvironment) {
    await deploySoulbound1155UpgradeableGeneric(
        hre,
        {
            CONTRACT_NAME,
            CONTRACT_TYPE,
            ABI_PATH,
        },
        ItemsBoundArgs.TESTNET
    );
}
