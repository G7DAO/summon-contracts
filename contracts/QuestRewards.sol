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

import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ERCWhitelistSignature.sol";

contract QuestRewards is ERC721Holder, ERC1155Holder, ERCWhitelistSignature, Pausable, AccessControl, ReentrancyGuard {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // Mapping for ERC721 deposits: contract address => tokenId => owner address
    mapping(address => mapping(uint256 => address)) private _erc721Deposits;

    // Mapping for ERC1155 deposits: contract address => tokenId => owner address
    mapping(address => mapping(uint256 => address)) private _erc1155Deposits;

    constructor(address adminWallet) {
        _addWhitelistSigner(adminWallet);
        _setupRole(DEFAULT_ADMIN_ROLE, adminWallet);
    }

    /**
     * @notice Whitelist signer signature gated function to deposit ERC721 tokens. 
     * @dev Caller will have to approve this contract on the ERC721 contract first.
     * @param contractAddress ERC721 contract address
     * @param tokenId Token id to deposit from caller
     */
    function depositERC721(
        address contractAddress,
        uint256 tokenId,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        // It is necessary to construct the signed message here to prevent one signature being used for any function
        bytes memory message = abi.encodePacked(
            "DEPOSIT",
            "ERC721",
            "TOKENID",
            tokenId,
            "CONTRACT_ADDRESS",
            contractAddress
        );
        uint256 nonce = 0;
        require(_verifySignature(msg.sender, nonce, message, signature), "Invalid signature");
        IERC721 nft = IERC721(contractAddress);
        require(nft.ownerOf(tokenId) == msg.sender, "Not the token owner");
        nft.safeTransferFrom(msg.sender, address(this), tokenId);
        _erc721Deposits[contractAddress][tokenId] = msg.sender;
    }

    // Deposit an ERC1155 token
    // function depositERC1155(
    //     address contractAddress,
    //     uint256 tokenId,
    //     uint256 amount,
    //     bytes calldata signature
    // ) external nonReentrant whenNotPaused {
    //     // It is necessary to construct the signed message here to prevent one signature being used for any function
    //     string memory message = abi.encodePacked(
    //         "DEPOSIT",
    //         "ERC1155",
    //         "TOKENID",
    //         tokenId,
    //         "CONTRACT_ADDRESS",
    //         contractAddress,
    //         "AMOUNT",
    //         amount
    //     );
    //     uint256 nonce = 0;
    //     bytes32 data = keccak256(abi.encodePacked(msg.sender, message, nonce));
    //     require(_verifySignature(msg.sender, 0, data, signature), "Invalid signature");
    //     IERC1155 nft = IERC1155(contractAddress);
    //     require(nft.balanceOf(msg.sender, tokenId) >= amount, "Insufficient token balance");
    //     nft.safeTransferFrom(msg.sender, address(this), tokenId, amount, "");
    //     _erc1155Deposits[contractAddress][tokenId] = msg.sender;
    // }

    // // Withdraw an ERC721 token
    // function withdrawERC721(
    //     address contractAddress,
    //     uint256 tokenId,
    //     bytes calldata signature
    // ) external nonReentrant whenNotPaused {
    //     // It is necessary to construct the signed message here to prevent one signature being used for any function
    //     string memory message = abi.encodePacked(
    //         "WITHDRAW",
    //         "ERC721",
    //         "TOKENID",
    //         tokenId,
    //         "CONTRACT_ADDRESS",
    //         contractAddress
    //     );
    //     uint256 nonce = 0;
    //     bytes32 data = keccak256(abi.encodePacked(msg.sender, message, nonce));
    //     require(_verifySignature(msg.sender, nonce, data, signature), "Invalid signature");
    //     require(_erc721Deposits[contractAddress][tokenId] == msg.sender, "Not the token depositor");
    //     IERC721(contractAddress).safeTransferFrom(address(this), msg.sender, tokenId);
    //     delete _erc721Deposits[contractAddress][tokenId];
    // }

    // // Withdraw an ERC1155 token
    // function withdrawERC1155(
    //     address contractAddress,
    //     uint256 tokenId,
    //     uint256 amount,
    //     bytes calldata signature
    // ) external nonReentrant whenNotPaused {
    //     // It is necessary to construct the signed message here to prevent one signature being used for any function
    //     string memory message = abi.encodePacked(
    //         "WITHDRAW",
    //         "ERC1155",
    //         "TOKENID",
    //         tokenId,
    //         "CONTRACT_ADDRESS",
    //         contractAddress,
    //         "AMOUNT",
    //         amount
    //     );
    //     uint256 nonce = 0;
    //     bytes32 data = keccak256(abi.encodePacked(msg.sender, message, nonce));
    //     // construct data with nonce
    //     require(_verifySignature(msg.sender, 0, data, signature), "Invalid signature");
    //     require(_erc1155Deposits[contractAddress][tokenId] == msg.sender, "Not the token depositor");
    //     IERC1155(contractAddress).safeTransferFrom(address(this), msg.sender, tokenId, amount, "");
    //     delete _erc1155Deposits[contractAddress][tokenId];
    // }

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

    // function claimERC721(
    //     address contractAddress,
    //     uint256 tokenId,
    //     bytes calldata signature
    // ) external nonReentrant whenNotPaused {
    //     // It is necessary to construct the signed message here to prevent one signature being used for any function
    //     string memory message = abi.encodePacked(
    //         "CLAIM",
    //         "ERC721",
    //         "TOKENID",
    //         tokenId,
    //         "CONTRACT_ADDRESS",
    //         contractAddress
    //     );
    //     uint256 nonce = 0;
    //     bytes32 data = keccak256(abi.encodePacked(msg.sender, message, nonce));
    //     require(_verifySignature(msg.sender, 0, data, signature), "Invalid signature");
    //     IERC721(contractAddress).safeTransferFrom(address(this), msg.sender, tokenId);
    // }

    // function claimERC721(
    //     address contractAddress,
    //     uint256 tokenId,
    //     uint256 amount,
    //     bytes calldata signature
    // ) external nonReentrant whenNotPaused {
    //     // It is necessary to construct the signed message here to prevent one signature being used for any function
    //     string memory message = abi.encodePacked(
    //         "CLAIM",
    //         "ERC1155",
    //         "TOKENID",
    //         tokenId,
    //         "CONTRACT_ADDRESS",
    //         contractAddress,
    //         "AMOUNT",
    //         amount
    //     );
    //     uint256 nonce = 0;
    //     bytes32 data = keccak256(abi.encodePacked(msg.sender, message, nonce));
    //     require(_verifySignature(msg.sender, nonce, data, signature), "Invalid signature");
    //     IERC721(contractAddress).safeTransferFrom(address(this), msg.sender, tokenId);
    // }
}
