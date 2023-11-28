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
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./ERCSoulbound.sol";
import "./ERCWhitelistSignature.sol";
import "./libraries/LibItems.sol";

contract ItemBound is ERC1155Burnable, ERC1155Supply, ERCSoulbound, ERC2981, ERCWhitelistSignature, AccessControl, Pausable {
    event SignerAdded(address signer);
    event SignerRemoved(address signer);

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    string private baseURI;
    string public name;
    string public symbol;
    using Strings for uint256;

    uint256 public currentMaxLevel;

    uint256 public MAX_PER_MINT = 1;

    mapping(uint256 => bool) public tokenExists;
    mapping(uint256 => string) public tokenUris; // tokenId => tokenUri
    mapping(uint256 => bool) public isTokenMintPaused; // tokenId => bool - default is false
    mapping(LibItems.Tier => mapping(uint256 => uint256[])) public itemPerTierPerLevel; // tier => level => itemId[]

    uint256[] public itemIds;

    modifier signatureCheck(
        uint256 nonce,
        bytes calldata data,
        bytes calldata signature
    ) {
        if (!_verifySignature(_msgSender(), nonce, data, signature)) {
            revert("InvalidSignature");
        }
        _;
    }

    modifier maxPerMintCheck(uint256 amount) {
        if (amount > MAX_PER_MINT) {
            revert("ExceedMaxMint");
        }
        _;
    }
    
    function totalTokensOwnedBy(address _owner) public view returns (uint256) {
        // TODO * view function to return total tokenIDs balance per wallet
    }

    function isTokenExist(uint256 _tokenId) public view returns (bool) {
        if (!tokenExists[_tokenId]) {
            revert("TokenNotExist");
        }
    }

    function _decodeData(bytes calldata _data) private view returns (uint256[] memory) {
        (uint256[] memory itemIds) = abi.decode(_data, (uint256[]));
        return itemIds;
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
        _addWhitelistSigner(msg.sender);

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

    function addNewToken(LibItems.TokenCreate calldata _token) public onlyRole(MANAGER_ROLE) {
        if (tokenExists[_token.tokenId]) {
            revert("TokenAlreadyExist");
        }
        if (bytes(_token.tokenUri).length > 0) {
            tokenUris[_token.tokenId] = _token.tokenUri;
        }

        tokenExists[_token.tokenId] = true;

        // keep track of itemId
        itemPerTierPerLevel[_token.tier][_token.level].push(_token.tokenId);
        itemIds.push(_token.tokenId);

        if (_token.level > currentMaxLevel) {
            currentMaxLevel = _token.level;
        }
    }

    function addNewTokens(LibItems.TokenCreate[] calldata _tokens) external onlyRole(MANAGER_ROLE) {
        for (uint256 i = 0; i < _tokens.length; i++) {
            addNewToken(_tokens[i]);
        }
    }

    function updateTokenUri(uint256 _tokenId, string calldata _tokenUri) public onlyRole(MANAGER_ROLE) {
        tokenUris[_tokenId] = _tokenUri;
    }

    function updateTokenMintPaused(uint256 _tokenId, bool _isTokenMintPaused) public onlyRole(MANAGER_ROLE) {
        isTokenMintPaused[_tokenId] = _isTokenMintPaused;
    }

    function getCurrentMaxLevel() public view returns (uint256) {
        return currentMaxLevel;
    }

    function getItemsPerTierPerLevel(LibItems.Tier _tier, uint256 _level) public view returns (uint256[] memory) {
        return itemPerTierPerLevel[_tier][_level];
    }

    function _mintBatch(address to, uint256[] memory _tokenIds, uint256 amount, bool soulbound) private {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            uint256 _id = _tokenIds[i];
            isTokenExist(_id);
            if (isTokenMintPaused[_id]) {
                revert("TokenMintPaused");
            }

            _mint(to, _id, amount, "");
            if (soulbound) {
                _soulbound(to, _id, amount);
            }
        }
    }

    function mint(
        bytes calldata data,
        uint256 amount,
        bool soulbound,
        uint256 nonce,
        bytes calldata signature
    ) external signatureCheck(nonce, data, signature) maxPerMintCheck(amount) whenNotPaused {
        uint256[] memory _tokenIds = _decodeData(data);
        _mintBatch(_msgSender(), _tokenIds, amount, soulbound);
    }

    function adminMint(
        address to,
        bytes calldata data,
        bool soulbound
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        uint256[] memory _tokenIds = _decodeData(data);
        _mintBatch(to, _tokenIds, 1, soulbound);
    }

    function adminMintId(address to, uint256 id, uint256 amount, bool soulbound) external onlyRole(MINTER_ROLE) whenNotPaused {
        isTokenExist(id);

        if (isTokenMintPaused[id]) {
            revert("TokenMintPaused");
        }

        _mint(to, id, amount, "");
        if (soulbound) {
            _soulbound(to, id, amount);
        }   
    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override(ERC1155, ERC1155Supply) {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
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
        isTokenExist(tokenId);
        if (bytes(tokenUris[tokenId]).length > 0) {
            return tokenUris[tokenId];
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

    function adminVerifySignature(address to, uint256 nonce, bytes calldata data, bytes calldata signature) public onlyRole(DEFAULT_ADMIN_ROLE) returns (bool) {
        return _verifySignature(to, nonce, data, signature);
    }

    function addWhitelistSigner(address _signer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _addWhitelistSigner(_signer);
    }

    function removeWhitelistSigner(address signer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _removeWhitelistSigner(signer);
    }
}
