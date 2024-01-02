// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

/**
 * Author: Omar <omar@game7.io>(https://github.com/ogarciarevett)
 * Co-Authors: Max <max@game7.io>(https://github.com/vasinl124)
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

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
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
    bytes32 public constant DEV_CONFIG_ROLE = keccak256("DEV_CONFIG_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("DEV_CONFIG_ROLE");


    // Mapping for ERC721 deposits: tokenId => owner address
    mapping(uint256 => address) public _erc721Deposits;

    // Mapping for ERC1155 deposits: tokenId => owner address
    mapping(uint256 => address) public _erc1155Deposits;

    constructor(address adminWallet, address devWallet) {
        _addWhitelistSigner(adminWallet);
        _setupRole(DEFAULT_ADMIN_ROLE, adminWallet);
        _setupRole(DEV_CONFIG_ROLE, devWallet);
    }

    // Deposit an ERC721 token
    function depositERC721(
        address nftAddress,
        uint256 tokenId,
        uint256 nonce,
        bytes calldata data,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        require(_verifySignature(_msgSender(), nonce, data, signature), "Invalid signature");
        IERC721 nft = IERC721(nftAddress);
        require(nft.ownerOf(tokenId) == _msgSender(), "Not the token owner");
        nft.safeTransferFrom(_msgSender(), address(this), tokenId);
        _erc721Deposits[tokenId] = _msgSender();
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
        require(_verifySignature(_msgSender(), nonce, data, signature), "Invalid signature");
        IERC1155 nft = IERC1155(nftAddress);
        require(nft.balanceOf(_msgSender(), tokenId) >= amount, "Insufficient token balance");
        nft.safeTransferFrom(_msgSender(), address(this), tokenId, amount, "");
        _erc1155Deposits[tokenId] = _msgSender();
    }

    // Withdraw an ERC721 token
    function withdrawERC721(
        address nftAddress,
        uint256 tokenId,
        uint256 nonce,
        bytes calldata data,
        bytes calldata signature
    ) external onlyRole(MANAGER_ROLE) nonReentrant whenNotPaused  {
        require(_verifySignature(_msgSender(), nonce, data, signature), "Invalid signature");
        require(_erc721Deposits[tokenId] == _msgSender(), "Not the token depositor");
        IERC721(nftAddress).safeTransferFrom(address(this), _msgSender(), tokenId);
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
    ) external onlyRole(MANAGER_ROLE) nonReentrant whenNotPaused {
        require(_verifySignature(_msgSender(), nonce, data, signature), "Invalid signature");
        require(_erc1155Deposits[tokenId] == _msgSender(), "Not the token depositor");
        IERC1155(nftAddress).safeTransferFrom(address(this), _msgSender(), tokenId, amount, "");
        delete _erc1155Deposits[tokenId];
    }

    function withdrawERC1155Batch(
        address nftAddress,
        uint256[] memory tokenIds,
        uint256[] memory amounts,
        uint256 nonce,
        bytes calldata data,
        bytes calldata signature
    ) external onlyRole(MANAGER_ROLE) nonReentrant whenNotPaused{
        require(_verifySignature(_msgSender(), nonce, data, signature), "Invalid signature");
        IERC1155 nft = IERC1155(nftAddress);
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(_erc1155Deposits[tokenIds[i]] == _msgSender(), "Not the token depositor");
            nft.safeTransferFrom(address(this), _msgSender(), tokenIds[i], amounts[i], "");
            delete _erc1155Deposits[tokenIds[i]];
        }
    }

    function withdrawERC20(
        address _to,
        uint256 _amount,
        address erc20Address,
        bytes calldata data,
        bytes calldata signature
    ) onlyRole(MANAGER_ROLE) nonReentrant whenNotPaused external {
        // send paymaster funds to the owner
        IERC20 token = IERC20(allowedERC20Token);
        uint256 balance = token.balanceOf(address(this));
        require(balance >= _amount, "Insufficient balance");
        token.transfer(_to, _amount);
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
