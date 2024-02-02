import { ERC20StakeV1Args } from '@constants/constructor-args';
import { CONTRACT_UPGRADABLE_FILE_NAME, CONTRACT_UPGRADABLE_NAME, CONTRACT_TYPE } from '@constants/contract';
import { TENANT } from '@constants/tenant';

import { DeploymentContract } from '../../types/deployment-type';
import { NETWORK_TYPE, NetworkName } from '../network';

const chain = NetworkName.PolygonMumbai;
const networkType = NETWORK_TYPE.TESTNET;

export const POLYGON_MUMBAI_CONTRACTS: DeploymentContract[] = [];
