// SPDX-License-Identifier: UNLICENSED
///@notice This contract is for mock for WETH token.
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "../ERCSoulbound.sol";

contract Mock1155Soulbound is ERC1155Burnable, ERCSoulbound, ReentrancyGuard {
    constructor() ERC1155("lol://lol/{id}") {}

    // optional soulbound minting
    function mint(address to, uint256 id, uint256 amount, bool soulbound) public virtual nonReentrant {
        if (soulbound) {
            _soulbound(to, id, amount);
        }
        _mint(to, id, amount, "");
    }

    // optional soulbound batch minting
    function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bool soulbound) public virtual nonReentrant {
        if (soulbound) {
            _soulboundBatch(to, ids, amounts);
        }
        _mintBatch(to, ids, amounts, "");
    }

    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _id,
        uint256 _amount,
        bytes memory _data
    ) public virtual override soulboundCheck(_from, _to, _id, _amount, balanceOf(_from, _id)) syncSoulbound(_from, _to, _id, _amount, balanceOf(_from, _id)) {
        super.safeTransferFrom(_from, _to, _id, _amount, _data);
    }

    function safeBatchTransferFrom(
        address _from,
        address _to,
        uint256[] memory _ids,
        uint256[] memory _amounts,
        bytes memory _data
    ) public virtual override soulboundCheckBatch(_from, _to, _ids, _amounts, balanceOfBatchOneAccount(_from, _ids)) syncBatchSoulbound(_from, _to, _ids, _amounts, balanceOfBatchOneAccount(_from, _ids)) {
        super.safeBatchTransferFrom(_from, _to, _ids, _amounts, _data);
    }


    function balanceOfBatchOneAccount(address account, uint256[] memory ids) public view virtual returns (uint256[] memory) {
        uint256[] memory batchBalances = new uint256[](ids.length);

        for (uint256 i = 0; i < ids.length; ++i) {
            batchBalances[i] = balanceOf(account, ids[i]);
        }

        return batchBalances;
    }

    function burn(address to, uint256 tokenId, uint256 amount) public virtual override soulboundCheck(to, address(0), tokenId, amount, balanceOf(to, tokenId)) syncSoulbound(to, address(0), tokenId, amount, balanceOf(to, tokenId)) {
        ERC1155Burnable.burn(to, tokenId, amount);
    }

    function burnBatch(address to, uint256[] memory tokenIds, uint256[] memory amounts) public virtual override soulboundCheckBatch(to, address(0), tokenIds, amounts, balanceOfBatchOneAccount(to, tokenIds)) syncBatchSoulbound(to, address(0), tokenIds, amounts, balanceOfBatchOneAccount(to, tokenIds)) {
        ERC1155Burnable.burnBatch(to, tokenIds, amounts);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
