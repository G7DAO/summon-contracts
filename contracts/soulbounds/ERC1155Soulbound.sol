// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

// @author Summon.xyz Team - https://summon.xyz
// @contributors: [ @ogarciarevett, @vasinl124]
//....................................................................................................................................................
//....................&&&&&&..........................................................................................................................
//..................&&&&&&&&&&&.......................................................................................................................
//..............X.....&&&&&&&&&&&&....................................................................................................................
//............&&&&&&.....&&&&&&&&&&&..................................................................................................................
//............&&&&&&&&&.....&&&&&.....................................................................................................................
//............&&&&&&&&&&&&.........&.............&&&&&&&&&&&&..&&&&....&&&&.&&&&&&&&..&&&&&&&.&&&&&&&&..&&&&&&&&.&&&&&&&&&&&&.&&&&&....&&&&...........
//...............&&&&&&&&&&&&.....&&$............&&&&..........&&&&....&&&&.&&&&&&&&.&&&&&&&&..&&&&&&&&.&&&&&&&&.&&&&&&&&&&&&.&&&&&&&..&&&&...........
//............&.....&&&&&&&&&&&&..................&&&&&&&&&&&..&&&&....&&&&.&&&&..&&&&&&.&&&&..&&&&.&&&&&&..&&&&.&&&&....&&&&.&&&&.&&&&&&&&...........
//............&&.......&&&&&&&&&&&&......................&&&&..&&&&&&&&&&&&.&&&&..&&&&&..&&&&..&&&&..&&&&...&&&&.&&&&&&&&&&&&.&&&&...&&&&&&...........
//................&&&.....&&&&&&&&&&+............&&&&&&&&&&&&...&&&&&&&&&&..&&&&...&&&&..&&&&.&&&&&..&&&&...&&&&.&&&&&&&&&&&&.&&&&....&&&&&...........
//.............&&&&&&&&&.....&&&&&&&..................................................................................................................
//.............&&&&&&&&&&&&.....&&&...................................................................................................................
//.................&&&&&&&&&&&........................................................................................................................
//....................&&&&&&&.........................................................................................................................
//....................................................................................................................................................

import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {
    ERC1155Burnable
} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import {
    ERC1155Supply
} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import {
    AccessControl
} from "@openzeppelin/contracts/access/AccessControl.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { ERC2981 } from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {
    Summon1155Soulbound
} from "../ercs/extensions/Summon1155Soulbound.sol";
import { ERCWhitelistSignature } from "../ercs/ERCWhitelistSignature.sol";
import { LibItems } from "../libraries/LibItems.sol";

error MissingRole();

contract ERC1155Soulbound is
    ERC1155Burnable,
    ERC1155Supply,
    ERC2981,
    Summon1155Soulbound,
    ERCWhitelistSignature,
    AccessControl,
    Pausable,
    ReentrancyGuard
{
    event ContractURIChanged(string indexed uri);

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEV_CONFIG_ROLE = keccak256("DEV_CONFIG_ROLE");

    string public contractURI;
    string private baseURI;
    string public name;
    string public symbol;
    using Strings for uint256;

    uint256 public MAX_PER_MINT;

    mapping(uint256 => bool) private tokenExists;
    mapping(uint256 => string) public tokenUris; // tokenId => tokenUri
    mapping(uint256 => bool) public isTokenMintPaused; // tokenId => bool - default is false

    uint256[] public itemIds;

    mapping(address => mapping(uint256 => bool)) private tokenIdProcessed;

    event Minted(
        address indexed to,
        uint256[] tokenIds,
        uint256 amount,
        bool soulbound
    );
    event MintedId(
        address indexed to,
        uint256 indexed tokenId,
        uint256 amount,
        bool soulbound
    );
    event TokenAdded(uint256 indexed tokenId);

    modifier maxPerMintCheck(uint256 amount) {
        if (amount > MAX_PER_MINT) {
            revert("ExceedMaxMint");
        }
        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _initBaseURI,
        string memory _contractURI,
        uint256 _maxPerMint,
        bool _isPaused,
        address devWallet
    ) ERC1155(_initBaseURI) {
        require(devWallet != address(0), "AddressIsZero");

        _grantRole(DEFAULT_ADMIN_ROLE, devWallet);
        _grantRole(DEV_CONFIG_ROLE, devWallet);
        _grantRole(MINTER_ROLE, devWallet);
        _grantRole(MANAGER_ROLE, devWallet);
        _addWhitelistSigner(devWallet);

        name = _name;
        symbol = _symbol;
        baseURI = _initBaseURI;
        contractURI = _contractURI;
        MAX_PER_MINT = _maxPerMint;

        if (_isPaused) _pause();
    }

    function getAllItems(
        address _owner
    ) public view returns (LibItems.TokenReturn[] memory) {
        bool isAdmin = hasRole(MINTER_ROLE, _msgSender());
        if (!isAdmin && _owner != _msgSender()) {
            revert MissingRole();
        }
        uint256 totalTokens = itemIds.length;
        LibItems.TokenReturn[] memory tokenReturns = new LibItems.TokenReturn[](
            totalTokens
        );

        uint index;
        for (uint i = 0; i < totalTokens; i++) {
            uint256 tokenId = itemIds[i];
            uint256 amount = balanceOf(_owner, tokenId);

            if (isAdmin || amount > 0) {
                LibItems.TokenReturn memory tokenReturn = LibItems.TokenReturn({
                    tokenId: tokenId,
                    tokenUri: uri(tokenId),
                    amount: amount
                });
                tokenReturns[index] = tokenReturn;
                index++;
            }
        }

        // truncate the array
        LibItems.TokenReturn[]
            memory returnsTruncated = new LibItems.TokenReturn[](index);
        for (uint i = 0; i < index; i++) {
            returnsTruncated[i] = tokenReturns[i];
        }

        return returnsTruncated;
    }

    function isTokenExist(uint256 _tokenId) public view returns (bool) {
        if (!tokenExists[_tokenId]) {
            revert("TokenNotExist");
        }
        return true;
    }

    function decodeData(
        bytes calldata _data
    ) public view onlyRole(DEV_CONFIG_ROLE) returns (uint256[] memory) {
        return _decodeData(_data);
    }

    function _decodeData(
        bytes calldata _data
    ) private view returns (uint256[] memory) {
        return abi.decode(_data, (uint256[]));
    }

    function pause() external onlyRole(MANAGER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(MANAGER_ROLE) {
        _unpause();
    }

    function addNewToken(
        LibItems.TokenCreate calldata _token
    ) public onlyRole(DEV_CONFIG_ROLE) {
        if (bytes(_token.tokenUri).length > 0) {
            tokenUris[_token.tokenId] = _token.tokenUri;
        }

        if (_token.receiver != address(0)) {
            _setTokenRoyalty(
                _token.tokenId,
                _token.receiver,
                uint96(_token.feeBasisPoints)
            );
        }

        tokenExists[_token.tokenId] = true;

        itemIds.push(_token.tokenId);
        emit TokenAdded(_token.tokenId);
    }

    function addNewTokens(
        LibItems.TokenCreate[] calldata _tokens
    ) external onlyRole(DEV_CONFIG_ROLE) {
        for (uint256 i = 0; i < _tokens.length; i++) {
            addNewToken(_tokens[i]);
        }
    }

    function updateTokenUri(
        uint256 _tokenId,
        string calldata _tokenUri
    ) public onlyRole(DEV_CONFIG_ROLE) {
        tokenUris[_tokenId] = _tokenUri;
    }

    function batchUpdateTokenUri(
        uint256[] calldata _tokenIds,
        string[] calldata _tokenUris
    ) public onlyRole(DEV_CONFIG_ROLE) {
        if (_tokenIds.length != _tokenUris.length) {
            revert("InvalidInput");
        }
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            updateTokenUri(_tokenIds[i], _tokenUris[i]);
        }
    }

    function updateTokenMintPaused(
        uint256 _tokenId,
        bool _isTokenMintPaused
    ) public onlyRole(MANAGER_ROLE) {
        isTokenMintPaused[_tokenId] = _isTokenMintPaused;
    }

    function _mintBatch(
        address to,
        uint256[] memory _tokenIds,
        uint256 amount,
        bool soulbound
    ) private {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            uint256 _id = _tokenIds[i];
            isTokenExist(_id);
            if (isTokenMintPaused[_id]) {
                revert("TokenMintPaused");
            }

            if (soulbound) {
                _soulbound(to, _id, amount);
            }

            _mint(to, _id, amount, "");
        }
        emit Minted(to, _tokenIds, amount, soulbound);
    }

    function mint(
        bytes calldata data,
        uint256 amount,
        bool soulbound,
        uint256 nonce,
        bytes calldata signature
    )
        external
        nonReentrant
        signatureCheck(_msgSender(), nonce, data, signature)
        maxPerMintCheck(amount)
        whenNotPaused
    {
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

    function adminMintId(
        address to,
        uint256 id,
        uint256 amount,
        bool soulbound
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        isTokenExist(id);

        if (isTokenMintPaused[id]) {
            revert("TokenMintPaused");
        }

        if (soulbound) {
            _soulbound(to, id, amount);
        }

        _mint(to, id, amount, "");
        emit MintedId(to, id, amount, soulbound);
    }

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal virtual override(ERC1155, ERC1155Supply) {
        super._update(from, to, ids, values);
    }

    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _id,
        uint256 _amount,
        bytes memory _data
    )
        public
        virtual
        override
        soulboundCheckAndSync(_from, _to, _id, _amount, balanceOf(_from, _id))
    {
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
        soulboundCheckAndSyncBatch(
            _from,
            _to,
            _ids,
            _amounts,
            balanceOfBatchOneAccount(_from, _ids)
        )
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
        soulboundCheckAndSync(
            to,
            address(0),
            tokenId,
            amount,
            balanceOf(to, tokenId)
        )
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
        soulboundCheckAndSyncBatch(
            to,
            address(0),
            tokenIds,
            amounts,
            balanceOfBatchOneAccount(to, tokenIds)
        )
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
    ) public view override(ERC2981, ERC1155, AccessControl) returns (bool) {
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

    function updateBaseUri(
        string memory _baseURI
    ) external onlyRole(DEV_CONFIG_ROLE) {
        baseURI = _baseURI;
    }

    function updateWhitelistAddress(
        address _address,
        bool _isWhitelisted
    ) external onlyRole(DEV_CONFIG_ROLE) {
        _updateWhitelistAddress(_address, _isWhitelisted);
    }

    function setContractURI(
        string memory _contractURI
    ) public onlyRole(DEV_CONFIG_ROLE) {
        contractURI = _contractURI;
        emit ContractURIChanged(_contractURI);
    }

    function adminVerifySignature(
        address to,
        uint256 nonce,
        bytes calldata data,
        bytes calldata signature
    ) public onlyRole(DEV_CONFIG_ROLE) returns (bool) {
        return _verifySignature(to, nonce, data, signature);
    }

    function addWhitelistSigner(
        address _signer
    ) external onlyRole(DEV_CONFIG_ROLE) {
        _addWhitelistSigner(_signer);
    }

    function removeWhitelistSigner(
        address signer
    ) external onlyRole(DEV_CONFIG_ROLE) {
        _removeWhitelistSigner(signer);
    }

    function setRoyaltyInfo(
        address receiver,
        uint96 feeBasisPoints
    ) external onlyRole(MANAGER_ROLE) {
        _setDefaultRoyalty(receiver, feeBasisPoints);
    }

    function setTokenRoyalty(
        uint256 tokenId,
        address receiver,
        uint256 feeBasisPoints
    ) external onlyRole(MANAGER_ROLE) {
        _setTokenRoyalty(tokenId, receiver, uint96(feeBasisPoints));
    }

    function resetTokenRoyalty(
        uint256 tokenId
    ) external onlyRole(MANAGER_ROLE) {
        _resetTokenRoyalty(tokenId);
    }
}
