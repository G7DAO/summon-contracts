// SPDX-License-Identifier: UNLICENSED
///@notice This contract is for mock for WETH token.
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "../ERCSoulbound.sol";

contract Mock1155Soulbound is ERC1155Burnable, ERCSoulbound {
    constructor() ERC1155("lol://lol/{id}") {}

    // optional soulbound minting
    function mint(address to, uint256 id, uint256 amount, bool soulbound) public virtual {
        _mint(to, id, amount, "");
        if (soulbound) {
            _soulbound(to, id, amount);
        }
    }

    // optional soulbound batch minting
    function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bool soulbound) public virtual {
        _mintBatch(to, ids, amounts, "");
        if (soulbound) {
            _soulboundBatch(to, ids, amounts);
        }
    }

    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _id,
        uint256 _amount,
        bytes memory _data
    ) public virtual override soulboundCheck(_from, _to, _id, _amount) {
        super.safeTransferFrom(_from, _to, _id, _amount, _data);
    }

    function safeBatchTransferFrom(
        address _from,
        address _to,
        uint256[] memory _ids,
        uint256[] memory _amounts,
        bytes memory _data
    ) public virtual override soulboundCheckBatch(_from, _to, _ids, _amounts) {
        super.safeBatchTransferFrom(_from, _to, _ids, _amounts, _data);
    }

    function burn(address to, uint256 tokenId, uint256 amount) public virtual override syncSoulbound(to, tokenId, amount) {
        _burn(to, tokenId, amount);
    }

    function burnBatch(address to, uint256[] memory tokenIds, uint256[] memory amounts) public virtual override syncBatchSoulbound(to, tokenIds, amounts) {
        _burnBatch(to, tokenIds, amounts);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
