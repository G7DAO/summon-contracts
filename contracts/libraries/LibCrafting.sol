// SPDX-License-Identifier: MIT

/**
 * Authors: Omar Garcia <omar@game7.io>
 * GitHub: https://github.com/ogarciarevett
 */

pragma solidity ^0.8.20;

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
