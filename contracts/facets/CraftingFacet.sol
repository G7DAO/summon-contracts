// SPDX-License-Identifier: MIT

/**
 * Authors: Omar Garcia <omar@game7.io>
 * GitHub: https://github.com/ogarciarevett
 */

pragma solidity ^0.8.17;
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../libraries/LibCrafting.sol";
import "../libraries/LibDiamond.sol";
import "../security/DiamondReentrancyGuard.sol";
import { MockErc20 } from "../mocks/MockErc20.sol";
import { MockERC1155 } from "../mocks/MockErc1155.sol";

contract CraftingFacet is ERC1155Holder, ERC721Holder, DiamondReentrancyGuard, AccessControl {
  bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

  function addRecipe(Recipe calldata recipe) external onlyRole(MINTER_ROLE) {
    LibCrafting.CraftingStorage storage cs = LibCrafting.craftingStorage();
    cs.numRecipes++;
    cs.recipes[cs.numRecipes] = recipe;
  }

  function getRecipe(uint256 recipeId) external view returns (Recipe memory) {
    return LibCrafting.craftingStorage().recipes[recipeId];
  }

  function numRecipes() external view returns (uint256) {
    return LibCrafting.craftingStorage().numRecipes;
  }

  function craft(uint256 recipeId) public diamondNonReentrant {
    Recipe memory recipe = LibCrafting.craftingStorage().recipes[recipeId];
    for (uint256 i = 0; i < recipe.inputs.length; i++) {
      if (recipe.inputs[i].tokenType == LibCrafting.ERC20_TOKEN_TYPE) {
        ERC20Burnable erc20InputToken = ERC20Burnable(recipe.inputs[i].tokenAddress);
        if (recipe.inputs[i].tokenAction == LibCrafting.INPUT_TOKEN_ACTION_TRANSFER) {
          bool succeed = erc20InputToken.transferFrom(msg.sender, address(this), recipe.inputs[i].amount);
          require(succeed, "CraftingFacet.craft: transfer of erc20InputToken failed");
        } else if (recipe.inputs[i].tokenAction == LibCrafting.INPUT_TOKEN_ACTION_BURN) {
          erc20InputToken.burnFrom(msg.sender, recipe.inputs[i].amount);
        } else if (recipe.inputs[i].tokenAction == LibCrafting.INPUT_TOKEN_ACTION_HOLD) {
          uint256 balance = erc20InputToken.balanceOf(msg.sender);
          if (balance < recipe.inputs[i].amount) {
            revert("CraftingFacet.craft: User doesn't hold enough tokens for crafting");
          }
        }
      } else if (recipe.inputs[i].tokenType == LibCrafting.ERC1155_TOKEN_TYPE) {
        ERC1155Burnable erc1155InputToken = ERC1155Burnable(recipe.inputs[i].tokenAddress);
        if (recipe.inputs[i].tokenAction == LibCrafting.INPUT_TOKEN_ACTION_TRANSFER) {
          erc1155InputToken.safeTransferFrom(msg.sender, address(this), recipe.inputs[i].tokenId, recipe.inputs[i].amount, "");
        } else if (recipe.inputs[i].tokenAction == LibCrafting.INPUT_TOKEN_ACTION_BURN) {
          erc1155InputToken.burn(msg.sender, recipe.inputs[i].tokenId, recipe.inputs[i].amount);
        } else if (recipe.inputs[i].tokenAction == LibCrafting.INPUT_TOKEN_ACTION_HOLD) {
          uint256 balance = erc1155InputToken.balanceOf(msg.sender, recipe.inputs[i].tokenId);
          if (balance < recipe.inputs[i].amount) {
            revert("CraftingFacet.craft: User doesn't hold enough tokens for crafting");
          }
        }
      }
    }

    for (uint256 i = 0; i < recipe.outputs.length; i++) {
      if (recipe.outputs[i].tokenType == LibCrafting.ERC20_TOKEN_TYPE) {
        MockErc20 erc20OutputToken = MockErc20(recipe.outputs[i].tokenAddress);
        if (recipe.outputs[i].tokenAction == LibCrafting.OUTPUT_TOKEN_ACTION_TRANSFER) {
          bool succeed = erc20OutputToken.transfer(msg.sender, recipe.outputs[i].amount);
          require(succeed, "CraftingFacet.craft: transfer of erc20OutputToken failed");
        } else if (recipe.outputs[i].tokenAction == LibCrafting.OUTPUT_TOKEN_ACTION_MINT) {
          erc20OutputToken.mint(msg.sender, recipe.outputs[i].amount);
        }
      } else if (recipe.outputs[i].tokenType == LibCrafting.ERC1155_TOKEN_TYPE) {
        MockERC1155 erc1155OutputToken = MockERC1155(recipe.outputs[i].tokenAddress);
        if (recipe.outputs[i].tokenAction == LibCrafting.OUTPUT_TOKEN_ACTION_TRANSFER) {
          erc1155OutputToken.safeTransferFrom(address(this), msg.sender, recipe.outputs[i].tokenId, recipe.outputs[i].amount, "");
        } else if (recipe.outputs[i].tokenAction == LibCrafting.OUTPUT_TOKEN_ACTION_MINT) {
          erc1155OutputToken.mint(msg.sender, recipe.outputs[i].tokenId, recipe.outputs[i].amount, "");
        }
      }
    }
  }

  // The following functions are overrides required by Solidity.
  function supportsInterface(bytes4 interfaceId) public view override(ERC1155Receiver, AccessControl) returns (bool) {
    return super.supportsInterface(interfaceId);
  }
}
