// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";


contract LevelsBound is ERC1155, Ownable, ReentrancyGuard {

  constructor() ERC1155("no/{uri}") {}

  function mintLevel(address account, uint256 level) onlyOwner public {
    // check the balance of the account before minting twice
    require(balanceOf(account, level) == 0, "User already has this level token");
    _mint(account, level, 1, "");
  }

  function safeTransferFrom(address _from, address _to, uint256 _id, uint256 _amount, bytes memory _data) public virtual override {
    revert("You can't transfer this token");
    super.safeTransferFrom(_from, _to, _id, _amount, _data);
  }

  function safeBatchTransferFrom(address _from, address _to, uint256[] memory _ids, uint256[] memory _amounts, bytes memory _data) public virtual override {
    revert("You can't transfer this token");
    super.safeBatchTransferFrom(_from, _to, _ids, _amounts, _data);
  }

  function burn(uint256 tokenId, uint256 amount) public nonReentrant {
    _burn(msg.sender, tokenId, amount);
  }

  function burnBatch(uint256[] memory tokenIds, uint256[] memory amounts) public nonReentrant {
    _burnBatch(msg.sender, tokenIds, amounts);
  }

  function supportsInterface(bytes4 interfaceId) public view override(ERC1155) returns (bool) {
    return super.supportsInterface(interfaceId);
  }

}