// SPDX-License-Identifier: UNLICENSED
///@notice This contract is for mock for WETH token.
pragma solidity ^0.8.17;

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

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./ERCSoulbound.sol";
import "./libraries/LibItems.sol";

import "forge-std/Test.sol";

error ItemBound_InvalidTokenId();
error ItemBound_TokenAlreadyExist();
error ItemBound_TokenNotExist();
error ItemBound_TokenInvalidLength();
error ItemBound_ExceedMaxMint();
error ItemBound_InvalidSignature();
error ItemBound_AlreadyUsedSignature();
error ItemBound_AddressIsZero();

abstract contract RandomItemFactory {
    function randomItem(uint256 seed, uint256 level) public virtual returns (uint256);
}

contract ItemBound is ERC1155Burnable, ERCSoulbound, ERC2981, AccessControl, Pausable {
    event SignerAdded(address signer);
    event SignerRemoved(address signer);

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    string private baseURI;
    string public name;
    string public symbol;
    using Strings for uint256;

    address private randomContract;

    uint256 public currentMaxLevel;

    uint256 public MAX_PER_MINT = 1;

    mapping(uint256 => LibItems.TokenInfo) public tokenInfo;
    mapping(LibItems.Tier => mapping(uint256 => uint256[])) public itemPerTierPerLevel; // tier => level => itemId[]

    mapping(address => bool) public whitelistSigners;
    mapping(bytes => bool) public usedSignatures;

    modifier signatureCheck(
        uint256 nonce,
        uint256 seedOrTokenId,
        bytes memory signature
    ) {
        if (!verifySignature(_msgSender(), nonce, seedOrTokenId, signature)) {
            revert ItemBound_InvalidSignature();
        }
        _;
    }

    modifier tokenExistsCheck(uint256 tokenId) {
        isTokenExist(tokenId);
        _;
    }

    modifier maxPerMintCheck(uint256 amount) {
        if (amount > MAX_PER_MINT) {
            revert ItemBound_ExceedMaxMint();
        }
        _;
    }

    function isTokenExist(uint256 tokenId) public view returns (bool) {
        if (!tokenInfo[tokenId].exists) {
            revert ItemBound_TokenNotExist();
        }
    }

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _initBaseURI,
        uint256 _maxPerMint,
        bool _isPaused,
        address _devWallet,
        uint96 _royalty
    ) ERC1155(_initBaseURI) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        setSigner(msg.sender);

        _setDefaultRoyalty(_devWallet, _royalty);
        name = _name;
        symbol = _symbol;
        baseURI = _initBaseURI;
        MAX_PER_MINT = _maxPerMint;

        if (_isPaused) _pause();
    }

    function pause() external onlyRole(MANAGER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(MANAGER_ROLE) {
        _unpause();
    }

    function addNewToken(uint256 _tokenId, LibItems.TokenInfo calldata _token) public onlyRole(MANAGER_ROLE) {
        if (tokenInfo[_tokenId].exists) {
            revert ItemBound_TokenAlreadyExist();
        }

        _updateTokenInfo(_tokenId, _token);

        // keep track of itemId
        itemPerTierPerLevel[_token.tier][_token.level].push(_token.itemId);
    }

    function addNewTokens(uint256[] calldata _tokenIds, LibItems.TokenInfo[] calldata _tokens) external onlyRole(MANAGER_ROLE) {
        if (_tokenIds.length != _tokens.length) {
            revert ItemBound_TokenInvalidLength();
        }

        for (uint256 i = 0; i < _tokens.length; i++) {
            addNewToken(_tokenIds[i], _tokens[i]);
        }
    }

    function updateTokenInfo(uint256 _tokenId, LibItems.TokenInfo calldata _token) public onlyRole(MANAGER_ROLE) {
        // if token not exists
        if (!tokenInfo[_tokenId].exists) {
            revert ItemBound_TokenNotExist();
        }

        _updateTokenInfo(_tokenId, _token);
    }

    function _updateTokenInfo(uint256 _tokenId, LibItems.TokenInfo calldata _token) private {
        // check tokenId with tier and level to see if legit or not
        checkTokenId(_tokenId, _token.itemId, _token.level, _token.tier);

        tokenInfo[_tokenId].exists = _token.exists;
        tokenInfo[_tokenId].availableToMint = _token.availableToMint;
        tokenInfo[_tokenId].itemId = _token.itemId;
        tokenInfo[_tokenId].tokenUri = _token.tokenUri; // can be empty ''
        tokenInfo[_tokenId].level = _token.level;
        tokenInfo[_tokenId].tier = _token.tier;

        if (_token.level > currentMaxLevel) {
            currentMaxLevel = _token.level;
        }
    }

    // function checkTokenId(uint256 _tokenId, uint256 _itemId, uint256 _level, LibItems.Tier _tier) public pure {
    function checkTokenId(uint256 _tokenId, uint256 _itemId, uint256 _level, LibItems.Tier _tier) public view {
        uint256 hash = uint256(keccak256(abi.encodePacked(_itemId, _level, _tier)));
        if (hash != _tokenId) {
            revert ItemBound_InvalidTokenId();
        }
    }

    function getCurrentMaxLevel() public view returns (uint256) {
        return currentMaxLevel;
    }

    function getItemsPerTierPerLevel(LibItems.Tier _tier, uint256 _level) public view returns (uint256[] memory) {
        return itemPerTierPerLevel[_tier][_level];
    }

    function __mint(address to, uint256 id, uint256 amount, bool soulbound) private {
        _mint(to, id, amount, "");
        if (soulbound) {
            _soulbound(to, id, amount);
        }
    }

    function mint(
        uint256 id,
        uint256 amount,
        bool soulbound,
        uint256 nonce,
        bytes memory signature
    ) external signatureCheck(nonce, id, signature) tokenExistsCheck(id) maxPerMintCheck(amount) whenNotPaused {
        __mint(_msgSender(), id, amount, soulbound);
    }

    function mintRandom(
        uint256 seed,
        uint256 amount,
        bool soulbound,
        uint256 nonce,
        bytes memory signature
    ) external signatureCheck(nonce, seed, signature) maxPerMintCheck(amount) whenNotPaused {
        uint256 id = _randomItem(seed, 0); // get random id from seed
        isTokenExist(id);

        __mint(_msgSender(), id, amount, soulbound);
    }

    function mintRandomAtLevel(
        uint256 seed,
        uint256 level,
        uint256 amount,
        bool soulbound,
        uint256 nonce,
        bytes memory signature
    ) external signatureCheck(nonce, seed, signature) maxPerMintCheck(amount) whenNotPaused {
        uint256 id = _randomItem(seed, level); // get random id from seed
        isTokenExist(id);

        __mint(_msgSender(), id, amount, soulbound);
    }

    function adminMint(
        address to,
        uint256 id,
        uint256 amount,
        bool soulbound
    ) external onlyRole(MINTER_ROLE) tokenExistsCheck(id) maxPerMintCheck(amount) whenNotPaused {
        __mint(to, id, amount, soulbound);
    }

    // admin - minter role with signature --> signature must have seed to random
    function adminMintRandom(address to, uint256 seed, uint256 amount, bool soulbound) external onlyRole(MINTER_ROLE) maxPerMintCheck(amount) whenNotPaused {
        uint256 id = _randomItem(seed, 0); // get random id from seed
        isTokenExist(id);

        __mint(to, id, amount, soulbound);
    }

    function adminMintRandomAtLevel(
        address to,
        uint256 seed,
        uint256 level,
        uint256 amount,
        bool soulbound
    ) external onlyRole(MINTER_ROLE) maxPerMintCheck(amount) whenNotPaused {
        uint256 id = _randomItem(seed, level); // get random id from seed
        isTokenExist(id);

        __mint(to, id, amount, soulbound);
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

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, ERC2981, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        if (!tokenInfo[tokenId].exists) {
            revert ItemBound_TokenNotExist();
        }

        if (bytes(tokenInfo[tokenId].tokenUri).length > 0) {
            return tokenInfo[tokenId].tokenUri;
        } else {
            return string(abi.encodePacked(baseURI, "/", tokenId.toString()));
        }
    }

    function updateBaseUri(string memory _baseURI) external onlyRole(MANAGER_ROLE) {
        baseURI = _baseURI;
    }

    function setRoyaltyInfo(address receiver, uint96 feeBasisPoints) external onlyRole(MANAGER_ROLE) {
        _setDefaultRoyalty(receiver, feeBasisPoints);
    }

    function updateWhitelistAddress(address _address, bool _isWhitelisted) external onlyRole(MANAGER_ROLE) {
        _updateWhitelistAddress(_address, _isWhitelisted);
    }

    function recoverAddress(address to, uint256 nonce, uint256 seedOrTokenId, bytes memory signature) private pure returns (address) {
        bytes32 message = keccak256(abi.encodePacked(to, nonce, seedOrTokenId));
        bytes32 hash = ECDSA.toEthSignedMessageHash(message);
        address signer = ECDSA.recover(hash, signature);
        return signer;
    }

    function verifySignature(address to, uint256 nonce, uint256 seedOrTokenId, bytes memory signature) private returns (bool) {
        if (usedSignatures[signature]) revert ItemBound_AlreadyUsedSignature();

        address signer = recoverAddress(to, nonce, seedOrTokenId, signature);
        if (whitelistSigners[signer]) {
            usedSignatures[signature] = true;
            return true;
        } else {
            return false;
        }
    }

    function adminVerifySignature(address to, uint256 nonce, uint256 seedOrTokenId, bytes memory signature) public onlyRole(DEFAULT_ADMIN_ROLE) returns (bool) {
        return verifySignature(to, nonce, seedOrTokenId, signature);
    }

    function setSigner(address _signer) public onlyRole(DEFAULT_ADMIN_ROLE) {
        whitelistSigners[_signer] = true;
        emit SignerAdded(_signer);
    }

    function removeSigner(address signer) public onlyRole(DEFAULT_ADMIN_ROLE) {
        whitelistSigners[signer] = false;
        emit SignerRemoved(signer);
    }

    function setRandomItemContract(address contractAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (contractAddress == address(0)) {
            revert ItemBound_AddressIsZero();
        }

        randomContract = contractAddress;
    }

    function _randomItem(uint256 seed, uint256 level) private returns (uint256) {
        RandomItemFactory factory = RandomItemFactory(randomContract);
        return factory.randomItem(seed, level);
    }
}
