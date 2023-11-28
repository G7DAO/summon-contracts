// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

/**
 * Author: Omar <omar@game7.io>(https://github.com/ogarciarevett)
 * Co-Authors: Max <max@game7.io>(https://github.com/vasinl124)
 */

/**                        .;c;.
 *                      'lkXWWWXk:.
 *                    .dXMMMMMMMMWXkc'.
 *               .,..  ,dKNMMMMMMMMMMN0o,.
 *             ,dKNXOo'. .;dKNMMMMMMMMMWN0c.
 *            .kMMMMMWN0o;. .,lkNMMMMMMWKd,
 *            .OMMMMMMMMMN0x:. .'ckXN0o;. ..
 *             :ONMMMMMMMMMMWKxc. .... .:d0d.
 *              .'cxKWMMMMMMMMMWXkl,.  'o0Nk.
 *            .:l,  .:dKWMMMMMMMMMMNOl,. .;,
 *            .OMKl.   .;oOXWMMMMMMMMMN0o;.
 *            .co;.  .;,. .'lOXWMMMMMMMMMWKl.
 *               .:dOXWWKd;.  'ckXWMMMMMMMMk.
 *             .c0WMMMMMMMWKd:.  .:xXWMMMWNo.
 *             ,oONWMMMMMMMMWXOl.  .;okxl'
 *                .,lkXWMMMMMMMMWXO:
 *                    .ckKWMMMMMWKd;
 *                       .:d0X0d:.
 *                          ...
 */

import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ERCWhitelistSignature.sol";

contract NFTDeposits is ERC721Holder, ERC1155Holder, ERCWhitelistSignature, Pausable, AccessControl, ReentrancyGuard {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // Mapping for ERC721 deposits: tokenId => owner address
    mapping(uint256 => address) private _erc721Deposits;

    // Mapping for ERC1155 deposits: tokenId => owner address
    mapping(uint256 => address) private _erc1155Deposits;

    constructor(address adminWallet) {
        _addWhitelistSigner(adminWallet);
        _setupRole(DEFAULT_ADMIN_ROLE, adminWallet);
    }

    // Deposit an ERC721 token
    function depositERC721(
        address nftAddress,
        uint256 tokenId,
        uint256 nonce,
        bytes calldata data,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        require(_verifySignature(msg.sender, nonce, data, signature), "Invalid signature");
        IERC721 nft = IERC721(nftAddress);
        require(nft.ownerOf(tokenId) == msg.sender, "Not the token owner");
        nft.safeTransferFrom(msg.sender, address(this), tokenId);
        _erc721Deposits[tokenId] = msg.sender;
    }

    // Deposit an ERC1155 token
    function depositERC1155(
        address nftAddress,
        uint256 tokenId,
        uint256 amount,
        uint256 nonce,
        bytes calldata data,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        require(_verifySignature(msg.sender, nonce, data, signature), "Invalid signature");
        IERC1155 nft = IERC1155(nftAddress);
        require(nft.balanceOf(msg.sender, tokenId) >= amount, "Insufficient token balance");
        nft.safeTransferFrom(msg.sender, address(this), tokenId, amount, "");
        _erc1155Deposits[tokenId] = msg.sender;
    }

    // Withdraw an ERC721 token
    function withdrawERC721(
        address nftAddress,
        uint256 tokenId,
        uint256 nonce,
        bytes calldata data,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        require(_verifySignature(msg.sender, nonce, data, signature), "Invalid signature");
        require(_erc721Deposits[tokenId] == msg.sender, "Not the token depositor");
        IERC721(nftAddress).safeTransferFrom(address(this), msg.sender, tokenId);
        delete _erc721Deposits[tokenId];
    }

    // Withdraw an ERC1155 token
    function withdrawERC1155(
        address nftAddress,
        uint256 tokenId,
        uint256 amount,
        uint256 nonce,
        bytes calldata data,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        require(_verifySignature(msg.sender, nonce, data, signature), "Invalid signature");
        require(_erc1155Deposits[tokenId] == msg.sender, "Not the token depositor");
        IERC1155(nftAddress).safeTransferFrom(address(this), msg.sender, tokenId, amount, "");
        delete _erc1155Deposits[tokenId];
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function addWhitelistSigner(address _signer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _addWhitelistSigner(_signer);
    }

    function removeWhitelistSigner(address signer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _removeWhitelistSigner(signer);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155Receiver, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
