// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * Authors: Omar Garcia <omar@game7.io>
 * GitHub: https://github.com/ogarciarevett
 */

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "./ERCSoulBoundUpgradable.sol";
import "../interfaces/IOpenMint.sol";
import "../interfaces/ISoulBound1155.sol";

contract AvatarBoundV1 is
    Initializable,
    ERC721URIStorageUpgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    ERCSoulBoundUpgradable
{
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant URI_SETTER_ROLE = keccak256("URI_SETTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    uint256 private _tokenIdCounter;
    uint256 private _specialItemId = 1;
    uint256 private defaultItemId = 2;
    string public baseTokenURI;
    string public contractURI;
    string public revealURI;
    address public gatingNFTAddress;
    address public itemsNFTAddress;
    bool public mintNftGatingEnabled;
    bool public mintNftWithoutGatingEnabled;
    bool public mintRandomItemEnabled;
    bool public mintDefaultItemEnabled;

    event BaseURIChanged(string indexed uri);
    event ContractURIChanged(string indexed uri);
    event RevealURIChanged(string indexed uri);
    event SignerAdded(address signer);
    event SignerRemoved(address signer);
    event GatingNFTAddressChanged(address _newAddress);
    event ItemsNFTAddressChanged(address _newAddress);
    event MintNftWithoutGatingEnabledChanged(bool enabled);
    event MintNftGatingEnabledChanged(bool enabled);
    event MintRandomItemEnabledChanged(bool enabled);
    event MintDefaultItemEnabledChanged(bool enabled);
    event SpecialItemIdChanged(uint indexed newId);
    event DefaultItemIdChanged(uint indexed newId);
    event SkinBaseChanged(uint indexed newBaseSkinId, string newUri);
    event URIChanged(uint indexed tokenId, string newURI);
    event RandomItemMinted(uint indexed itemId, address to, address itemsNFTAddress);
    event SpecialItemMinted(uint indexed specialItemId, address to, address itemsNFTAddress);
    event ItemMinted(uint indexed itemId, address to, address itemsNFTAddress);
    event NFTRevealed(uint indexed tokenId, address to, address gatingNFTAddress);
    event AvatarMinted(uint indexed tokenId, address to, string baseSkinUri);

    mapping(uint256 => string) public baseSkins;

    mapping(address => bool) public whitelistSigners;

    // bytes(signature) => used
    mapping(bytes => bool) public usedSignatures;

    function initialize(
        string memory _name,
        string memory _symbol,
        string memory _baseTokenURI,
        string memory _contractURI,
        address developerAdmin,
        address _gatingNFTAddress,
        address _itemsNFTAddress,
        bool _mintNftGatingEnabled,
        bool _mintNftWithoutGatingEnabled,
        bool _mintRandomItemEnabled
    ) public initializer {
        __ERC721_init(_name, _symbol);
        __ERC721URIStorage_init();
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, developerAdmin);
        baseTokenURI = _baseTokenURI;
        contractURI = _contractURI;
        gatingNFTAddress = _gatingNFTAddress;
        itemsNFTAddress = _itemsNFTAddress;
        mintNftGatingEnabled = _mintNftGatingEnabled;
        mintNftWithoutGatingEnabled = _mintNftWithoutGatingEnabled;
        mintRandomItemEnabled = _mintRandomItemEnabled;
    }

    function mint(address to, uint256 baseSkinId) private {
        require(!isSoulboundAddress(to), "Address has already minted an Avatar");
        require(bytes(baseSkins[baseSkinId]).length > 0, "Base Skin not found on-chain");
        uint256 tokenId = _tokenIdCounter++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, baseSkins[baseSkinId]);
        _soulboundAddress(to);
        emit AvatarMinted(tokenId, to, baseSkins[baseSkinId]);
    }

    function mintAvatarNftGating(uint256 nftGatingId, uint256 baseSkinId, uint256 nonce, bytes memory signature) public nonReentrant whenNotPaused {
        require(mintNftGatingEnabled, "NFT gating mint is not enabled");
        require(verifySignature(_msgSender(), nonce, signature), "Invalid signature");
        require(IOpenMint(gatingNFTAddress).ownerOf(nftGatingId) == _msgSender(), "Sender does not own the required NFT");
        mint(_msgSender(), baseSkinId);
        revealNFTGatingToken(nftGatingId);

        if (mintRandomItemEnabled) {
            mintRandomItem(_msgSender());
        }

        mintItem(_msgSender(), _specialItemId);
    }

    function mintAvatar(uint256 baseSkinId, uint256 nonce, bytes memory signature) public nonReentrant whenNotPaused {
        require(mintNftWithoutGatingEnabled, "Minting without nft gating is not enabled");
        require(verifySignature(_msgSender(), nonce, signature), "Invalid signature");
        mint(_msgSender(), baseSkinId);

        if (mintRandomItemEnabled) {
            mintRandomItem(_msgSender());
        }

        if (mintDefaultItemEnabled) {
            mintItem(_msgSender(), defaultItemId);
        }
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

    function revealNFTGatingToken(uint256 tokenId) public onlyRole(MINTER_ROLE) whenNotPaused {
        IOpenMint(gatingNFTAddress).reveal(tokenId, revealURI);
        emit NFTRevealed(tokenId, _msgSender(), gatingNFTAddress);
    }

    function mintItem(address to, uint256 itemId) public onlyRole(MINTER_ROLE) whenNotPaused {
        ISoulBound1155(itemsNFTAddress).mint(to, itemId, 1, true);
        if (itemId == _specialItemId) {
            emit SpecialItemMinted(itemId, to, itemsNFTAddress);
        } else {
            emit ItemMinted(itemId, to, itemsNFTAddress);
        }
    }

    function mintRandomItem(address to) internal onlyRole(MINTER_ROLE) whenNotPaused {
        // Do randomness here to mint a random item between the id 1 and 26
        uint256 random = uint256(keccak256(abi.encodePacked(block.timestamp, block.difficulty, to)));
        uint256 randomItem = random % 26;
        ISoulBound1155(itemsNFTAddress).mint(to, randomItem, 1, false);
        emit RandomItemMinted(randomItem, to, itemsNFTAddress);
    }

    function recoverAddress(address to, uint256 nonce, bytes memory signature) public view returns (address) {
        bytes32 message = keccak256(abi.encodePacked(to, nonce));
        bytes32 hash = ECDSAUpgradeable.toEthSignedMessageHash(message);
        address signer = ECDSAUpgradeable.recover(hash, signature);
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
            emit URIChanged(tokenIds[i], tokenURIs[i]);
        }
    }

    function setContractURI(string memory _contractURI) public onlyRole(DEFAULT_ADMIN_ROLE) {
        contractURI = _contractURI;
        emit ContractURIChanged(_contractURI);
    }

    function setSigner(address _signer) public onlyRole(DEFAULT_ADMIN_ROLE) {
        whitelistSigners[_signer] = true;
        emit SignerAdded(_signer);
    }

    function removeSigner(address signer) public onlyRole(DEFAULT_ADMIN_ROLE) {
        whitelistSigners[signer] = false;
        emit SignerRemoved(signer);
    }

    function setTokenURI(uint256 tokenId, string memory tokenURL) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_ownerOf(tokenId) != address(0), "URI set of nonexistent token");
        _setTokenURI(tokenId, tokenURL);
        emit URIChanged(tokenId, tokenURL);
    }

    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }

    function setBaseURI(string memory _baseTokenURI) public onlyRole(DEFAULT_ADMIN_ROLE) {
        baseTokenURI = _baseTokenURI;
        emit BaseURIChanged(baseTokenURI);
    }

    function setRevealURI(string memory _revealURI) public onlyRole(DEFAULT_ADMIN_ROLE) {
        revealURI = _revealURI;
        emit RevealURIChanged(_revealURI);
    }

    function setBaseSkin(uint256 baseSkinId, string memory uri) public onlyRole(DEFAULT_ADMIN_ROLE) {
        baseSkins[baseSkinId] = uri;
        emit SkinBaseChanged(baseSkinId, uri);
    }

    function setMintRandomItemEnabled(bool _mintRandomItemEnabled) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_mintRandomItemEnabled != mintRandomItemEnabled, "Minting random item already set");
        mintRandomItemEnabled = _mintRandomItemEnabled;
        emit MintRandomItemEnabledChanged(_mintRandomItemEnabled);
    }

    function setMintDefaultItemEnabled(bool _mintDefaultItemEnabled) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_mintDefaultItemEnabled != mintDefaultItemEnabled, "Minting default item already set");
        mintDefaultItemEnabled = _mintDefaultItemEnabled;
        emit MintDefaultItemEnabledChanged(_mintDefaultItemEnabled);
    }

    function setItemsNFTAddress(address _newAddress) public onlyRole(DEFAULT_ADMIN_ROLE) {
        itemsNFTAddress = _newAddress;
        emit ItemsNFTAddressChanged(_newAddress);
    }

    function setNftGatingAddress(address _newAddress) public onlyRole(DEFAULT_ADMIN_ROLE) {
        gatingNFTAddress = _newAddress;
        emit GatingNFTAddressChanged(_newAddress);
    }

    function setSpecialItemId(uint256 _newId) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newId != _specialItemId, "Special Item ID already has this value");
        require(defaultItemId != _newId, "Special Item ID can't have the same value that the Default Item ID");
        _specialItemId = _newId;
        emit SpecialItemIdChanged(_newId);
    }

    function setDefaultItemId(uint256 _newId) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newId != defaultItemId, "Same value");
        require(_specialItemId != _newId, "Default Item Id must be different that Special Item Id");
        defaultItemId = _newId;
        emit DefaultItemIdChanged(_newId);
    }

    function setMintNftGatingEnabled(bool _mintNftGatingEnabled) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_mintNftGatingEnabled != mintNftGatingEnabled, "NFT gating already set");
        mintNftGatingEnabled = _mintNftGatingEnabled;
        emit MintNftGatingEnabledChanged(_mintNftGatingEnabled);
    }

    function setMintNftWithoutGatingEnabled(bool _mintNftWithoutGatingEnabled) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_mintNftWithoutGatingEnabled != mintNftWithoutGatingEnabled, "NFT without gating already set");
        mintNftWithoutGatingEnabled = _mintNftWithoutGatingEnabled;
        emit MintNftGatingEnabledChanged(_mintNftWithoutGatingEnabled);
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batch) internal override soulboundAddressCheck(from) {
        super._beforeTokenTransfer(from, to, tokenId, batch);
    }

    function _burn(uint256 tokenId) internal override(ERC721URIStorageUpgradeable) {}

    function tokenURI(uint256 tokenId) public view override(ERC721URIStorageUpgradeable) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721URIStorageUpgradeable, AccessControlUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}