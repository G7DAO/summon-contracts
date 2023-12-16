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

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { ERC721SoulboundUpgradeable } from "../extensions/upgradeables/ERC721SoulboundUpgradeable.sol";
import { ERCWhitelistSignatureUpgradeable } from "./ERCWhitelistSignatureUpgradeable.sol";
import { IOpenMint } from "../interfaces/IOpenMint.sol";
import { IItemBound } from "../interfaces/IItemBound.sol";

contract AvatarBoundV1 is
    Initializable,
    ERC721EnumerableUpgradeable,
    ERC721URIStorageUpgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    ERC721SoulboundUpgradeable,
    ERCWhitelistSignatureUpgradeable
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant DEV_CONFIG_ROLE = keccak256("DEV_CONFIG_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    uint256 private _tokenIdCounter;
    uint256 public _baseSkinCounter;
    uint256 private _specialItemId;
    uint256 private defaultItemId;
    string public baseTokenURI;
    string public contractURI;
    string public revealURI;
    address public gatingNFTAddress;
    address public itemsNFTAddress;
    bool public mintNftGatingEnabled;
    bool public mintNftWithoutGatingEnabled;
    bool public mintRandomItemEnabled;
    bool public mintSpecialItemEnabled;
    bool public mintDefaultItemEnabled;
    bool public revealNftGatingEnabled;

    struct BaseSkinResponse {
        uint256 baseSkinId;
        string tokenUri;
    }

    event BaseURIChanged(string indexed uri, address admin);
    event ContractURIChanged(string indexed uri, address admin);
    event RevealURIChanged(string indexed uri, address admin);
    event SignerAdded(address signer, address admin);
    event SignerRemoved(address signer, address admin);
    event GatingNFTAddressChanged(address _newAddress, address admin);
    event ItemsNFTAddressChanged(address _newAddress, address admin);
    event MintNftWithoutGatingEnabledChanged(bool enabled, address admin);
    event MintNftGatingEnabledChanged(bool enabled, address admin);
    event MintRandomItemEnabledChanged(bool enabled, address admin);
    event MintSpecialItemEnabledChanged(bool enabled, address admin);
    event MintDefaultItemEnabledChanged(bool enabled, address admin);
    event EnabledRevealNftGatingEnabledChanged(bool enabled, address admin);
    event RandomItemsMintsChanged(uint256 indexed newMints, address admin);
    event SpecialItemIdChanged(uint indexed newId, address admin);
    event DefaultItemIdChanged(uint indexed newId, address admin);
    event SkinBaseChanged(uint indexed newBaseSkinId, string newUri, address admin);
    event URIChanged(uint indexed tokenId, string newURI, address admin);
    event RandomItemMinted(address to, bytes data, address itemsNFTAddress);
    event SpecialItemMinted(uint indexed specialItemId, address to, address itemsNFTAddress);
    event ItemMinted(uint indexed itemId, address to, address itemsNFTAddress);
    event NFTRevealed(uint indexed tokenId, address to, address gatingNFTAddress);
    event AvatarMinted(uint indexed tokenId, address to, string baseSkinUri);

    mapping(uint256 => string) public baseSkins;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory _name,
        string memory _symbol,
        string memory _baseTokenURI,
        string memory _contractURI,
        string memory _revealURI,
        address developerAdmin,
        address _gatingNFTAddress,
        address _itemsNFTAddress,
        bool _mintNftGatingEnabled,
        bool _mintNftWithoutGatingEnabled,
        bool _mintRandomItemEnabled,
        bool _mintSpecialItemEnabled
    ) public initializer {
        __ERC721_init(_name, _symbol);
        __ERC721Enumerable_init();
        __ERC721URIStorage_init();
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __ERC721SoulboundUpgradable_init();
        __ERCWhitelistSignatureUpgradeable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, developerAdmin);
        _grantRole(MINTER_ROLE, developerAdmin);
        _grantRole(DEV_CONFIG_ROLE, developerAdmin);
        _grantRole(MANAGER_ROLE, developerAdmin);
        _addWhitelistSigner(developerAdmin);

        baseTokenURI = _baseTokenURI;
        contractURI = _contractURI;
        gatingNFTAddress = _gatingNFTAddress;
        itemsNFTAddress = _itemsNFTAddress;
        mintNftGatingEnabled = _mintNftGatingEnabled;
        mintNftWithoutGatingEnabled = _mintNftWithoutGatingEnabled;
        mintRandomItemEnabled = _mintRandomItemEnabled;
        mintSpecialItemEnabled = _mintSpecialItemEnabled;
        mintDefaultItemEnabled = true;
        revealNftGatingEnabled = true;
        revealURI = _revealURI;
    }

    function mint(address to, uint256 baseSkinId) private {
        require(balanceOf(to) == 0, "Already has an Avatar");
        require(!isSoulboundAddress(to), "Address has already minted an Avatar");
        require(bytes(baseSkins[baseSkinId]).length > 0, "Base Skin not found on-chain");
        uint256 tokenId = _tokenIdCounter++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, baseSkins[baseSkinId]);
        _soulboundAddress(to);
        emit AvatarMinted(tokenId, to, baseSkins[baseSkinId]);
    }

    function mintAvatarNftGating(
        uint256 nftGatingId,
        uint256 baseSkinId,
        uint256 nonce,
        bytes calldata data,
        bytes calldata signature
    ) public nonReentrant whenNotPaused {
        require(mintNftGatingEnabled, "NFT gating mint is not enabled");
        require(_verifySignature(_msgSender(), nonce, data, signature), "Invalid signature");
        require(
            IOpenMint(gatingNFTAddress).ownerOf(nftGatingId) == _msgSender(),
            "Sender does not own the required NFT"
        );
        mint(_msgSender(), baseSkinId);

        if (revealNftGatingEnabled) {
            revealNFTGatingToken(nftGatingId);
        }

        if (mintRandomItemEnabled) {
            mintRandomItem(_msgSender(), data);
        }

        if (mintSpecialItemEnabled) {
            mintItem(_msgSender(), _specialItemId);
        }
    }

    function mintAvatar(
        uint256 baseSkinId,
        uint256 nonce,
        bytes calldata data,
        bytes calldata signature
    ) public nonReentrant whenNotPaused {
        require(mintNftWithoutGatingEnabled, "Minting without nft gating is not enabled");
        require(_verifySignature(_msgSender(), nonce, data, signature), "Invalid signature");
        mint(_msgSender(), baseSkinId);

        if (mintRandomItemEnabled) {
            mintRandomItem(_msgSender(), data);
        }

        if (mintDefaultItemEnabled) {
            mintItem(_msgSender(), defaultItemId);
        }
    }

    function adminMint(address to, uint256 baseSkinId) public onlyRole(MINTER_ROLE) whenNotPaused {
        require(balanceOf(to) == 0, "Address already has an Avatar");
        mint(to, baseSkinId);
    }

    function batchMint(
        address[] calldata addresses,
        uint256[] calldata baseSkinIds
    ) public onlyRole(MINTER_ROLE) whenNotPaused {
        require(addresses.length == baseSkinIds.length, "Addresses and URIs length mismatch");
        for (uint256 i = 0; i < baseSkinIds.length; i++) {
            mint(addresses[i], baseSkinIds[i]);
        }
    }

    function revealNFTGatingToken(uint256 tokenId) private {
        IOpenMint(gatingNFTAddress).reveal(tokenId, revealURI);
        emit NFTRevealed(tokenId, _msgSender(), gatingNFTAddress);
    }

    function mintItem(address to, uint256 itemId) private {
        IItemBound(itemsNFTAddress).adminMintId(to, itemId, 1, true);
        if (itemId == _specialItemId) {
            emit SpecialItemMinted(itemId, to, itemsNFTAddress);
        } else {
            emit ItemMinted(itemId, to, itemsNFTAddress);
        }
    }

    function mintRandomItem(address to, bytes calldata data) private {
        IItemBound(itemsNFTAddress).adminMint(to, data, false);
        emit RandomItemMinted(to, data, itemsNFTAddress);
    }

    function adminVerifySignature(
        address to,
        uint256 nonce,
        bytes calldata data,
        bytes calldata signature
    ) public onlyRole(DEFAULT_ADMIN_ROLE) returns (bool) {
        return _verifySignature(to, nonce, data, signature);
    }

    function pause() public onlyRole(MANAGER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(MANAGER_ROLE) {
        _unpause();
    }

    function batchSetTokenURI(uint256[] memory tokenIds, string[] memory tokenURIs) public onlyRole(DEV_CONFIG_ROLE) {
        require(tokenIds.length == tokenURIs.length, "TokenIds and URIs length mismatch");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(_ownerOf(tokenIds[i]) != address(0), "URI set of nonexistent token");
            _setTokenURI(tokenIds[i], tokenURIs[i]);
            emit URIChanged(tokenIds[i], tokenURIs[i], _msgSender());
        }
    }

    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }

    function getAllBaseSkins() public view returns (BaseSkinResponse[] memory) {
        BaseSkinResponse[] memory allBaseSkins = new BaseSkinResponse[](_baseSkinCounter);
        for (uint256 i = 0; i < _baseSkinCounter; i++) {
            BaseSkinResponse memory avatarBaseSkinResponse = BaseSkinResponse({
                baseSkinId: i,
                tokenUri: baseSkins[i]
            });
            allBaseSkins[i] = avatarBaseSkinResponse;
        }
        return allBaseSkins;
    }

    function getSpecialId() public view onlyRole(DEV_CONFIG_ROLE) returns (uint256) {
        return _specialItemId;
    }

    function getDefaultItem() public view onlyRole(DEV_CONFIG_ROLE) returns (uint256) {
        return defaultItemId;
    }

    function setContractURI(string memory _contractURI) public onlyRole(DEV_CONFIG_ROLE) {
        contractURI = _contractURI;
        emit ContractURIChanged(_contractURI, _msgSender());
    }

    function setTokenURI(uint256 tokenId, string memory tokenURL) public onlyRole(DEV_CONFIG_ROLE) {
        require(_ownerOf(tokenId) != address(0), "URI set of nonexistent token");
        _setTokenURI(tokenId, tokenURL);
        emit URIChanged(tokenId, tokenURL, _msgSender());
    }

    function setBaseURI(string memory _baseTokenURI) public onlyRole(DEV_CONFIG_ROLE) {
        baseTokenURI = _baseTokenURI;
        emit BaseURIChanged(baseTokenURI, _msgSender());
    }

    function setRevealURI(string memory _revealURI) public onlyRole(DEV_CONFIG_ROLE) {
        revealURI = _revealURI;
        emit RevealURIChanged(_revealURI, _msgSender());
    }

    function setBaseSkin(uint256 baseSkinId, string memory uri) public onlyRole(DEV_CONFIG_ROLE) {
        if (bytes(baseSkins[baseSkinId]).length == 0) {
            _baseSkinCounter++;
        }
        baseSkins[baseSkinId] = uri;
        emit SkinBaseChanged(baseSkinId, uri, _msgSender());
    }

    function removeBaseSkin(uint256 baseSkinId) public onlyRole(DEV_CONFIG_ROLE) {
        require(bytes(baseSkins[baseSkinId]).length > 0, "Base Skin not found on-chain");
        delete baseSkins[baseSkinId];
        _baseSkinCounter--;
        emit SkinBaseChanged(baseSkinId, "", _msgSender());
    }

    function setMintRandomItemEnabled(bool _mintRandomItemEnabled) public onlyRole(DEV_CONFIG_ROLE) {
        require(_mintRandomItemEnabled != mintRandomItemEnabled, "Minting random item already set");
        mintRandomItemEnabled = _mintRandomItemEnabled;
        emit MintRandomItemEnabledChanged(_mintRandomItemEnabled, _msgSender());
    }

    function setMintDefaultItemEnabled(bool _mintDefaultItemEnabled) public onlyRole(DEV_CONFIG_ROLE) {
        require(_mintDefaultItemEnabled != mintDefaultItemEnabled, "Minting default item already set");
        mintDefaultItemEnabled = _mintDefaultItemEnabled;
        emit MintDefaultItemEnabledChanged(_mintDefaultItemEnabled, _msgSender());
    }

    function setItemsNFTAddress(address _newAddress) public onlyRole(DEV_CONFIG_ROLE) {
        itemsNFTAddress = _newAddress;
        emit ItemsNFTAddressChanged(_newAddress, _msgSender());
    }

    function setNftGatingAddress(address _newAddress) public onlyRole(DEV_CONFIG_ROLE) {
        gatingNFTAddress = _newAddress;
        emit GatingNFTAddressChanged(_newAddress, _msgSender());
    }

    function setSpecialItemId(uint256 _newId) public onlyRole(DEV_CONFIG_ROLE) {
        require(_newId != _specialItemId, "Special Item ID already has this value");
        require(defaultItemId != _newId, "Special Item ID can't have the same value that the Default Item ID");
        _specialItemId = _newId;
        emit SpecialItemIdChanged(_newId, _msgSender());
    }

    function setDefaultItemId(uint256 _newId) public onlyRole(DEV_CONFIG_ROLE) {
        require(_newId != defaultItemId, "Same value");
        require(_specialItemId != _newId, "Default Item Id must be different that Special Item Id");
        defaultItemId = _newId;
        emit DefaultItemIdChanged(_newId, _msgSender());
    }

    function setMintNftGatingEnabled(bool _mintNftGatingEnabled) public onlyRole(DEV_CONFIG_ROLE) {
        require(_mintNftGatingEnabled != mintNftGatingEnabled, "NFT gating already set");
        mintNftGatingEnabled = _mintNftGatingEnabled;
        emit MintNftGatingEnabledChanged(_mintNftGatingEnabled, _msgSender());
    }

    function setMintSpecialItemEnabled(bool _mintSpecialItemEnabled) public onlyRole(DEV_CONFIG_ROLE) {
        require(_mintSpecialItemEnabled != mintSpecialItemEnabled, "NFT gating already set");
        mintSpecialItemEnabled = _mintSpecialItemEnabled;
        emit MintSpecialItemEnabledChanged(_mintSpecialItemEnabled, _msgSender());
    }

    function setMintNftWithoutGatingEnabled(bool _mintNftWithoutGatingEnabled) public onlyRole(DEV_CONFIG_ROLE) {
        require(_mintNftWithoutGatingEnabled != mintNftWithoutGatingEnabled, "NFT without gating already set");
        mintNftWithoutGatingEnabled = _mintNftWithoutGatingEnabled;
        emit MintNftWithoutGatingEnabledChanged(_mintNftWithoutGatingEnabled, _msgSender());
    }

    function setRevealNftGatingEnabled(bool _revealNftGatingEnabled) public onlyRole(DEV_CONFIG_ROLE) {
        require(_revealNftGatingEnabled != revealNftGatingEnabled, "NFT without gating already set");
        revealNftGatingEnabled = _revealNftGatingEnabled;
        emit EnabledRevealNftGatingEnabledChanged(_revealNftGatingEnabled, _msgSender());
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batch
    ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) soulboundAddressCheck(from) {
        super._beforeTokenTransfer(from, to, tokenId, batch);
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override(IERC721Upgradeable, ERC721Upgradeable) nonReentrant {
        revert("You can't transfer this token");
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override(IERC721Upgradeable, ERC721Upgradeable) nonReentrant {
        revert("You can't transfer this token");
        super.safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public override(IERC721Upgradeable, ERC721Upgradeable) nonReentrant {
        revert("You can't transfer this token");
        super._safeTransfer(from, to, tokenId, data);
    }

    function _burn(uint256 tokenId) internal override(ERC721Upgradeable, ERC721URIStorageUpgradeable) {}

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721Upgradeable, ERC721URIStorageUpgradeable) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721EnumerableUpgradeable, ERC721URIStorageUpgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function addWhitelistSigner(address _signer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _addWhitelistSigner(_signer);
    }

    function removeWhitelistSigner(address signer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _removeWhitelistSigner(signer);
    }

    function _decodeData(bytes calldata _data) private view returns (uint256[] memory) {
        uint256[] memory itemIds = abi.decode(_data, (uint256[]));
        return itemIds;
    }

    function decodeData(bytes calldata _data) public view onlyRole(DEV_CONFIG_ROLE) returns (uint256[] memory) {
        return _decodeData(_data);
    }
}
