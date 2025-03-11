import {solidityPackedKeccak256} from "ethers";

export const LISTER_ROLE = solidityPackedKeccak256(['string'], ['LISTER_ROLE']);
export const ASSET_ROLE = solidityPackedKeccak256(['string'], ['ASSET_ROLE']);