import { CONTRACT_TYPE, CONTRACT_FILE_NAME, CONTRACT_NAME } from '@constants/contract';
import { TENANT } from '@constants/tenant';

import { DeploymentContract } from '../../types/deployment-type';
import { NETWORK_TYPE, NetworkName } from '../network';
import { ItemBoundAzerothArgs } from '@constants/constructor-args';

const chain = NetworkName.PolygonMumbai;
const networkType = NETWORK_TYPE.TESTNET;

export const POLYGON_MUMBAI_CONTRACTS: DeploymentContract[] = [
    {
        contractFileName: CONTRACT_FILE_NAME.ERC1155Soulbound,
        type: CONTRACT_TYPE.Items,
        name: CONTRACT_NAME.Items,
        chain,
        networkType,
        tenants: [TENANT.Azeroth],
        verify: false,
        upgradable: false,
        dependencies: [],
        functionCalls: [],
        args: ItemBoundAzerothArgs.MAINNET,
    },
];
