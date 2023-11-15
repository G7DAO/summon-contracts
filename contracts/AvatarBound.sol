// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

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


import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { ERCSoulBound } from "./ERCSoulBound.sol";
import { ISoulBound1155 } from "./interfaces/ISoulBound1155.sol";
import { IOpenMint } from "./interfaces/IOpenMint.sol";

contract AvatarBound is ERC721URIStorage, ERC721Enumerable, AccessControl, ERCSoulBound, Pausable, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant URI_SETTER_ROLE = keccak256("URI_SETTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    uint256 private _tokenIdCounter;
    uint256 private _specialItemId = 0;
    string public baseTokenURI;
    string public contractURI;
    address public holderNFTAddress;
    address public itemsNFTAddress;
    bool public nftGatingMintEnabled;
    bool public mintRandomItemEnabled;

    event URIChanged(uint256 indexed tokenId);
    event BaseURIChanged(string indexed uri);
    event SignerAdded(address signer);
    event SignerRemoved(address signer);

    mapping(uint256 => string) private _baseSkins;

    mapping(address => bool) public whitelistSigners;

    // bytes(signature) => used
    mapping(bytes => bool) public usedSignatures;

    modifier onlyOnceSignature(bytes memory signature) {
        require(usedSignatures[signature] != true, "Signature and nonce already used");
        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _baseTokenURI,
        string memory _contractURI,
        address _holderNFTAddress,
        address _itemsNFTAddress,
        bool _nftGatingMintEnabled,
        bool _mintRandomItemEnabled
    ) ERC721(_name, _symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        whitelistSigners[msg.sender] = true;
        baseTokenURI = _baseTokenURI;
        contractURI = _contractURI;
        holderNFTAddress = _holderNFTAddress;
        itemsNFTAddress = _itemsNFTAddress;
        nftGatingMintEnabled = _nftGatingMintEnabled;
        mintRandomItemEnabled = _mintRandomItemEnabled;
    }

    function mint(address to, uint256 baseSkinId) private {
        require(!isSoulboundAddress(to), "Address has already minted an Avatar");
        require(bytes(_baseSkins[baseSkinId]).length > 0, "Base Skin not found on-chain");
        uint256 tokenId = _tokenIdCounter++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, _baseSkins[baseSkinId]);
        _soulboundAddress(to);

        if(mintRandomItemEnabled) {
            mintRandomItem(to);
        }
    }

    function mintAvatarForNftHolder(uint256 baseSkinId, uint256 nonce, bytes memory signature) public nonReentrant whenNotPaused  {
        require(verifySignature(_msgSender(), nonce, signature), "Invalid signature");
        require(IOpenMint(holderNFTAddress).balanceOf(_msgSender()) > 0, "1 NFT Hold Required");
        mint(_msgSender(), baseSkinId);
        mintSpecialItem(_msgSender());
    }

    function mintAvatar(uint256 baseSkinId, uint256 nonce, bytes memory signature) public nonReentrant whenNotPaused  {
        require(verifySignature(_msgSender(), nonce, signature), "Invalid signature");
        mint(_msgSender(), baseSkinId);
    }

    function adminMint(address to, uint256 baseSkinId) public onlyRole(MINTER_ROLE) whenNotPaused {
        mint(to, baseSkinId);
    }

    function batchMint(address[] calldata addresses, uint256[] calldata baseSkinIds) public onlyRole(MINTER_ROLE) whenNotPaused {
        require(addresses.length == baseSkinIds.length, "Addresses and URIs length mismatch");
        for (uint256 i = 0; i < baseSkinIds.length; i++) {
            mint(addresses[i], baseSkinIds[i]);
        }
    }

    function revealNFTHolder(uint256 tokenId, string memory uri) public onlyRole(MINTER_ROLE) whenNotPaused {
        require(IOpenMint(holderNFTAddress).balanceOf(msg.sender) > 0, "1 NFT Hold Required");
        IOpenMint(holderNFTAddress).reveal(tokenId, uri);
    }

    function mintSpecialItem(address to) public onlyRole(MINTER_ROLE) whenNotPaused {
        ISoulBound1155(itemsNFTAddress).mint(to, _specialItemId, 1, true);
    }

    function mintRandomItem(address to) internal onlyRole(MINTER_ROLE) whenNotPaused {
        // Do randomness here to mint a random item between the id 1 and 26
        uint256 random = uint256(keccak256(abi.encodePacked(block.timestamp, block.difficulty, to)));
        uint256 randomItem = random % 26;
        ISoulBound1155(itemsNFTAddress).mint(to, randomItem, 1, true);
    }

    function setSigner(address _signer) public onlyRole(DEFAULT_ADMIN_ROLE) {
        whitelistSigners[_signer] = true;
        emit SignerAdded(_signer);
    }

    function removeSigner(address signer) public onlyRole(DEFAULT_ADMIN_ROLE) {
        whitelistSigners[signer] = false;
        emit SignerRemoved(signer);
    }

    function recoverAddress(address to, uint256 nonce, bytes memory signature) private view returns (address) {
        bytes32 message = keccak256(abi.encodePacked(to, nonce));
        bytes32 hash = ECDSA.toEthSignedMessageHash(message);
        address signer = ECDSA.recover(hash, signature);
        return signer;
    }

    function verifySignature(address to, uint256 nonce, bytes memory signature) private returns (bool) {
        address signer = recoverAddress(to, nonce, signature);
        if (whitelistSigners[signer]) {
            usedSignatures[signature] = true;
            return true;
        } else {
            return false;
        }
    }

    function adminVerifySignature(address to, uint256 nonce, bytes memory signature) public onlyRole(DEFAULT_ADMIN_ROLE) returns (bool) {
        return verifySignature(to, nonce, signature);
    }


    function tokenURI(uint256 tokenId)
    public
    view
    override(ERC721, ERC721URIStorage)
    returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function batchSetTokenURI(uint256[] memory tokenIds, string[] memory tokenURIs) public onlyRole(URI_SETTER_ROLE) {
        require(tokenIds.length == tokenURIs.length, "TokenIds and URIs length mismatch");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(_ownerOf(tokenIds[i]) != address(0), "URI set of nonexistent token");
            _setTokenURI(tokenIds[i], tokenURIs[i]);
        }
    }

    function setContractURI(string memory _contractURI) public onlyRole(DEFAULT_ADMIN_ROLE) {
        contractURI = _contractURI;
    }

    function setTokenURI(uint256 tokenId, string memory tokenURL) public onlyRole(URI_SETTER_ROLE) {
        require(_ownerOf(tokenId) != address(0), "URI set of nonexistent token");
        _setTokenURI(tokenId, tokenURL);
        emit URIChanged(tokenId);
    }

    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }

    function setBaseURI(string memory _baseTokenURI) public onlyRole(DEFAULT_ADMIN_ROLE) {
        baseTokenURI = _baseTokenURI;
        emit BaseURIChanged(baseTokenURI);
    }

    function setBaseSkin(uint256 baseSkinId, string memory uri) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _baseSkins[baseSkinId] = uri;
    }

    function setMintRandomItemEnabled(bool _mintRandomItemEnabled) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_mintRandomItemEnabled != mintRandomItemEnabled, "Minting random item already set");
        mintRandomItemEnabled = _mintRandomItemEnabled;
    }

    function setItemsNFTAddress(address _newAddress) public onlyRole(DEFAULT_ADMIN_ROLE) {
        itemsNFTAddress = _newAddress;
    }

    function setHolderNFTAddress(address _newAddress) public onlyRole(DEFAULT_ADMIN_ROLE) {
        holderNFTAddress = _newAddress;
    }

    function setSpecialItemId(uint256 _newId) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _specialItemId = _newId;
    }

    function setOnlyNftGatingMintEnabled(bool _nftGatingMintEnabled) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_nftGatingMintEnabled != nftGatingMintEnabled, "NFT gating already set");
        nftGatingMintEnabled = _nftGatingMintEnabled;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batch
    ) internal override(ERC721, ERC721Enumerable) revertOperation {
        super._beforeTokenTransfer(from, to, tokenId, batch);
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) revertOperation {
        super._burn(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721URIStorage, ERC721Enumerable, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
