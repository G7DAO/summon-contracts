import { ItemBoundArgs } from '@constants/constructor-args';
import { CONTRACT_TYPE, CONTRACT_UPGRADABLE_NAME, CONTRACT_UPGRADABLE_FILE_NAME } from '@constants/contract';
import { TENANT } from '@constants/tenant';

import { DeploymentContract } from '../../types/deployment-type';
import { NETWORK_TYPE, NetworkName } from '../network';

const chain = NetworkName.LineaSepolia;
const networkType = NETWORK_TYPE.TESTNET;

export const LINEA_SEPOLIA_CONTRACTS: DeploymentContract[] = [
    {
        contractFileName: CONTRACT_UPGRADABLE_FILE_NAME.ERC1155RoyaltiesSoulbound,
        type: CONTRACT_TYPE.Items,
        name: CONTRACT_UPGRADABLE_NAME.ItemsRoyaltiesV2,
        chain,
        networkType,
        tenants: [TENANT.Game7],
        verify: false,
        upgradable: true,
        dependencies: [],
        functionCalls: [],
        args: ItemBoundArgs.TESTNET,
    },
];
