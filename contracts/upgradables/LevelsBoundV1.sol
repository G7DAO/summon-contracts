// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract LevelsBoundV1 is Initializable, ERC1155Upgradeable, OwnableUpgradeable {

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() initializer public {
        __ERC1155_init("");
        __Ownable_init();
    }

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

    function burn(uint256 tokenId, uint256 amount) public {
        _burn(msg.sender, tokenId, amount);
    }

    function burnBatch(uint256[] memory tokenIds, uint256[] memory amounts) public {
        _burnBatch(msg.sender, tokenIds, amounts);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155Upgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

}