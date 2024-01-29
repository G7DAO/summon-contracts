// SPDX-License-Identifier: MIT

/**
 * Authors: Omar Garcia
 * GitHub: https://github.com/ogarciarevett
 */

// MMMMNkc. .,oKWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
// MWXd,.      .cONMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
// Wx'           .cKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
// x.              ;KMMMMMMMMMMMMWKxlcclxKWMMMMMMMMWKxlc::::::::ckWMMXd:cOMMMMMMMMKo:oKMMWkccxWMWKdccccccccccccoKMM0l:l0MMMMMMMMMWkc:dXMMMXkoc::::::clxKW
// '                lNMMMMMMMMMMNd.  ..  .dNMMMMMMNd.  ..........oWMM0'  oWMMMMMMMk. .kMMN:  :XMNl   .''''''''';OMMX:  ,0MMMMMMMWk.  oNMWk'  ........  .o
// .                :XMMMMMMMMMWd. .o00l. .dWMMMMWx. .o0KKXKKXXXXNMMM0'  oNWWWWWWWk. .kMMN:  :NMNc  .kNNNNNNNNNNWMMM0,  :XMMMMMM0,  cXMMO.  c0KKKKXK0o.
// , .lkxo.  ;dkx,  oWMMMMMMMMWk.  oNMMNo. .kWMMMWl  ;KMMMMMMMMMMMMMM0'  .',',,,,,.  .kMMN:  :NMNc   ,:;;;;;;dXMMMMMMO.  lNMMMMK:  ;KMMMd. .OMMMMMMMMX;
// :  :KWX: .xMWx. .kMMMMMMMMM0'  cXMMMMXc  ,0MMMWl  ;KMMMMMMMMMMMMMM0'  .',,'',,,.  .kMMN:  :NMNc   ',,;;,;;oXMMMMMMWx. .dWMMNc  'OMMMMd. .OMMMMMMMMX;
// l   ,0WO:oXWd.  .OMMMMMMMMK;  ;KMMMMMMK;  :KMMWd. .o0KKXXKKKXXNMMM0'  oNWWWWWWWx. .kMMN:  :XMNc  .kNNNNNNNNWWWMMMMMNo. .dK0l. .xWMMMMO. .c0KKKXXK0o.
// o    dWMWWMK,   '0MMMMMMMXc  'OMMMMMMMMO'  cNMMNd.  ..........oWMM0'  oWMMMMMMMk. .kMMN:  :XMNl   .,,,,,,,,,:0MMMMMMNo.  ..  'xWMMMMMWx'   .......  .o
// O'   :XMMMMk.   cXMMMMMMMKo:cOWMMMMMMMMWOc:oKMMMWKxlc::::::::ckWMMXd:cOMMMMMMMMKo:oKMMWkc:xWMWKoc:::::::::::lKMMMMMMMWKdlcclxXWMMMMMMMMXkoc::::::clxKW
// WO;  'OMMMWl  .oXMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
// MMNx'.dWMMK;.:0WMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
// MMMM0cdNMM0cdNMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM

pragma solidity 0.8.17;

import { IDiamondCut } from "../interfaces/IDiamondCut.sol";

struct CraftingInputItem {
    uint256 tokenType; // item type: 20 for ERC20, 1155 for ERC1155
    address tokenAddress; // address of the token
    uint256 tokenId; // id of the token, any number for erc20
    uint256 amount; // amount of the token
    uint256 tokenAction; // 0 for transfer, 1 for burn, 2 for hold
}
struct CraftingOutputItem {
    uint256 tokenType; // item type: 20 for ERC20, 1155 for ERC1155
    address tokenAddress; // address of the token
    uint256 tokenId; // id of the token, any number for erc20
    uint256 amount; // amount of the token
    uint256 tokenAction; // 0 for transfer, 1 for mint
}

struct Recipe {
    CraftingInputItem[] inputs;
    CraftingOutputItem[] outputs;
    bool isActive;
}

library LibCrafting {
    bytes32 constant CRAFTING_STORAGE_POSITION = keccak256("achievo.eth.storage.crafting");

    uint256 public constant ERC20_TOKEN_TYPE = 20;
    uint256 public constant ERC1155_TOKEN_TYPE = 1155;

    uint256 public constant INPUT_TOKEN_ACTION_TRANSFER = 0;
    uint256 public constant INPUT_TOKEN_ACTION_BURN = 1;
    uint256 public constant INPUT_TOKEN_ACTION_HOLD = 2;

    uint256 public constant OUTPUT_TOKEN_ACTION_TRANSFER = 0;
    uint256 public constant OUTPUT_TOKEN_ACTION_MINT = 1;

    struct CraftingStorage {
        mapping(uint256 => Recipe) recipes;
        uint256 numRecipes;
        address authTerminusAddress;
        uint256 authTerminusPool;
    }

    function craftingStorage() internal pure returns (CraftingStorage storage ds) {
        bytes32 position = CRAFTING_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }
}
