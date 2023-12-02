// SPDX-License-Identifier: UNLICENSED
///@notice This contract is for mock for WETH token.
pragma solidity 0.8.17;

/**
 * Author: Max <max@game7.io>(https://github.com/vasinl124)
 * Co-Authors: Omar <omar@game7.io>(https://github.com/ogarciarevett)
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

import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import { ERC1155Burnable } from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { ERC2981 } from "@openzeppelin/contracts/token/common/ERC2981.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import { ERCSoulbound } from "./ERCSoulbound.sol";
import { ERCWhitelistSignature } from "./ERCWhitelistSignature.sol";
import { LibSoulbound1155 } from "./libraries/LibSoulbound1155.sol";

contract Soulbound1155 is
    ERC1155Burnable,
    ERCSoulbound,
    ERC2981,
    ERCWhitelistSignature,
    AccessControl,
    Pausable,
    ReentrancyGuard
{
    event ContractURIChanged(string indexed uri);

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    string public contractURI;
    string private baseURI;
    string public name;
    string public symbol;
    using Strings for uint256;

    uint256 public MAX_PER_MINT;

    mapping(uint256 => bool) public tokenExists;
    mapping(uint256 => string) public tokenUris; // tokenId => tokenUri
    mapping(uint256 => bool) public isTokenMintPaused; // tokenId => bool - default is false
    mapping(uint256 => mapping(address => bool)) public isMinted; // tokenId => address => bool

    uint256[] public itemIds;

    mapping(address => mapping(uint256 => bool)) private tokenIdProcessed;

    modifier canMint(
        address to,
        uint256 tokenId,
        uint256 amount
    ) {
        isTokenExist(tokenId);
        isTokenMintPausedCheck(tokenId);
        isTokenAlreadyMinted(to, tokenId);
        isExceedMaxMint(amount);
        _;
    }

    modifier canMintBatch(
        address to,
        uint256[] memory tokenIds,
        uint256[] memory amounts
    ) {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            isTokenExist(tokenIds[i]);
            isTokenMintPausedCheck(tokenIds[i]);
            isTokenAlreadyMinted(to, tokenIds[i]);
            isExceedMaxMint(amounts[i]);
        }

        _;
    }

    function getAllItems(address _owner) public view returns (LibSoulbound1155.TokenReturn[] memory) {
        uint256 totalTokens = itemIds.length;
        LibSoulbound1155.TokenReturn[] memory tokenReturns = new LibSoulbound1155.TokenReturn[](totalTokens);

        uint index;
        for (uint i = 0; i < totalTokens; i++) {
            uint256 tokenId = itemIds[i];
            uint256 amount = balanceOf(_owner, tokenId);

            if (amount > 0) {
                LibSoulbound1155.TokenReturn memory tokenReturn = LibSoulbound1155.TokenReturn({
                    tokenId: tokenId,
                    tokenUri: uri(tokenId),
                    amount: amount
                });
                tokenReturns[index] = tokenReturn;
                index++;
            }
        }

        // truncate the array
        LibSoulbound1155.TokenReturn[] memory returnsTruncated = new LibSoulbound1155.TokenReturn[](index);
        for (uint i = 0; i < index; i++) {
            returnsTruncated[i] = tokenReturns[i];
        }

        return returnsTruncated;
    }

    function isTokenExist(uint256 _tokenId) public view returns (bool) {
        if (!tokenExists[_tokenId]) {
            revert("TokenNotExist");
        }
    }

    function isTokenAlreadyMinted(address _wallet, uint256 _tokenId) public view returns (bool) {
        if (isMinted[_tokenId][_wallet]) {
            revert("AlreadyMinted");
        }
    }

    function isExceedMaxMint(uint256 amount) public view returns (bool) {
        if (amount > MAX_PER_MINT) {
            revert("ExceedMaxMint");
        }
    }

    function isTokenMintPausedCheck(uint256 _tokenId) public view returns (bool) {
        if (isTokenMintPaused[_tokenId]) {
            revert("TokenMintPaused");
        }
    }

    function _decodeData(bytes calldata _data) private view returns (uint256) {
        uint256 itemId = abi.decode(_data, (uint256));
        return itemId;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _initBaseURI,
        string memory _contractURI,
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
        contractURI = _contractURI;
        MAX_PER_MINT = _maxPerMint;

        if (_isPaused) _pause();
    }

    function pause() external onlyRole(MANAGER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(MANAGER_ROLE) {
        _unpause();
    }

    function addNewToken(LibSoulbound1155.TokenCreate calldata _token) public onlyRole(MANAGER_ROLE) {
        if (tokenExists[_token.tokenId]) {
            revert("TokenAlreadyExist");
        }

        if (bytes(_token.tokenUri).length > 0) {
            tokenUris[_token.tokenId] = _token.tokenUri;
        }

        tokenExists[_token.tokenId] = true;
    }

    function addNewTokens(LibSoulbound1155.TokenCreate[] calldata _tokens) external onlyRole(MANAGER_ROLE) {
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

    function __mint(address to, uint256 id, uint256 amount, bool soulbound) private {
        isMinted[id][to] = true;
        if (soulbound) {
            _soulbound(to, id, amount);
        }
        _mint(to, id, amount, "");
    }

    function __mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bool soulbound) private {
        for (uint256 i = 0; i < ids.length; i++) {
            isMinted[ids[i]][to] = true;
        }

        if (soulbound) {
            _soulboundBatch(to, ids, amounts);
        }

        _mintBatch(to, ids, amounts, "");
    }

    // optional soulbound minting
    function mint(
        uint256 id,
        bytes calldata data,
        uint256 amount,
        bool soulbound,
        uint256 nonce,
        bytes calldata signature
    )
        external
        nonReentrant
        signatureCheck(_msgSender(), nonce, data, signature)
        canMint(_msgSender(), id, amount)
        whenNotPaused
    {
        if (id != _decodeData(data)) {
            revert("InvalidData");
        }
        __mint(_msgSender(), id, amount, soulbound);
    }

    function adminMint(
        address to,
        uint256 id,
        uint256 amount,
        bool soulbound
    ) external onlyRole(MINTER_ROLE) canMint(to, id, amount) whenNotPaused {
        __mint(to, id, amount, soulbound);
    }

    function adminMintBatch(
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bool soulbound
    ) public onlyRole(MINTER_ROLE) canMintBatch(to, ids, amounts) whenNotPaused {
        __mintBatch(to, ids, amounts, soulbound);
    }

    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _id,
        uint256 _amount,
        bytes memory _data
    ) public virtual override soulboundCheckAndSync(_from, _to, _id, _amount, balanceOf(_from, _id)) {
        super.safeTransferFrom(_from, _to, _id, _amount, _data);
    }

    function safeBatchTransferFrom(
        address _from,
        address _to,
        uint256[] memory _ids,
        uint256[] memory _amounts,
        bytes memory _data
    )
        public
        virtual
        override
        soulboundCheckAndSyncBatch(_from, _to, _ids, _amounts, balanceOfBatchOneAccount(_from, _ids))
    {
        for (uint256 i = 0; i < _ids.length; i++) {
            uint256 id = _ids[i];

            if (tokenIdProcessed[_from][id]) {
                revert("ERC1155: duplicate ID");
            }

            tokenIdProcessed[_from][id] = true;
        }

        super.safeBatchTransferFrom(_from, _to, _ids, _amounts, _data);

        // Reset processed status after the transfer is completed
        for (uint256 i = 0; i < _ids.length; i++) {
            uint256 id = _ids[i];
            tokenIdProcessed[_from][id] = false;
        }
    }

    function balanceOfBatchOneAccount(
        address account,
        uint256[] memory ids
    ) public view virtual returns (uint256[] memory) {
        uint256[] memory batchBalances = new uint256[](ids.length);

        for (uint256 i = 0; i < ids.length; ++i) {
            batchBalances[i] = balanceOf(account, ids[i]);
        }

        return batchBalances;
    }

    function burn(
        address to,
        uint256 tokenId,
        uint256 amount
    )
        public
        virtual
        override
        nonReentrant
        soulboundCheckAndSync(to, address(0), tokenId, amount, balanceOf(to, tokenId))
    {
        ERC1155Burnable.burn(to, tokenId, amount);
    }

    function burnBatch(
        address to,
        uint256[] memory tokenIds,
        uint256[] memory amounts
    )
        public
        virtual
        override
        nonReentrant
        soulboundCheckAndSyncBatch(to, address(0), tokenIds, amounts, balanceOfBatchOneAccount(to, tokenIds))
    {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 id = tokenIds[i];

            if (tokenIdProcessed[to][id]) {
                revert("ERC1155: duplicate ID");
            }

            tokenIdProcessed[to][id] = true;
        }

        ERC1155Burnable.burnBatch(to, tokenIds, amounts);

        // Reset processed status after the transfer is completed
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 id = tokenIds[i];
            tokenIdProcessed[to][id] = false;
        }
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC1155, ERC2981, AccessControl) returns (bool) {
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

    function setContractURI(string memory _contractURI) public onlyRole(DEFAULT_ADMIN_ROLE) {
        contractURI = _contractURI;
        emit ContractURIChanged(_contractURI);
    }

    function adminVerifySignature(
        address to,
        uint256 nonce,
        bytes calldata data,
        bytes calldata signature
    ) public onlyRole(DEFAULT_ADMIN_ROLE) returns (bool) {
        return _verifySignature(to, nonce, data, signature);
    }

    function addWhitelistSigner(address _signer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _addWhitelistSigner(_signer);
    }

    function removeWhitelistSigner(address signer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _removeWhitelistSigner(signer);
    }
}
