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
import { ERC1155Burnable } from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import { ERC1155Supply } from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { ERC2981 } from "@openzeppelin/contracts/token/common/ERC2981.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import { Achievo1155Soulbound } from "../ercs/extensions/Achievo1155Soulbound.sol";
import { LibItems } from "../libraries/LibItems.sol";

error AddressIsZero();
error NotOwnerOrApproved();

contract AdminERC1155Soulbound is
    ERC1155Burnable,
    ERC1155Supply,
    Achievo1155Soulbound,
    AccessControl,
    ERC2981,
    ReentrancyGuard,
    Initializable
{
    event ContractURIChanged(string indexed uri);

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEV_CONFIG_ROLE = keccak256("DEV_CONFIG_ROLE");

    string public name;
    string public symbol;
    string public defaultTokenURI;
    string public contractURI;

    using Strings for uint256;

    mapping(uint256 => bool) private tokenExists;
    uint256[] public itemIds;

    mapping(address => mapping(uint256 => bool)) private tokenIdProcessed;

    event Minted(address indexed to, uint256[] tokenIds, uint256 amount, bool soulbound);
    event MintedId(address indexed to, uint256 indexed tokenId, uint256 amount, bool soulbound);
    event TokenAdded(uint256 indexed tokenId);

    constructor(address devWallet) ERC1155("") {
        if (devWallet == address(0)) {
            revert AddressIsZero();
        }
        _grantRole(DEFAULT_ADMIN_ROLE, devWallet);
    }

    function initialize(
        string memory _name,
        string memory _symbol,
        string memory _defaultTokenURI,
        string memory _contractURI,
        address devWallet,
        address lootDropAddress
    ) external initializer onlyRole(DEFAULT_ADMIN_ROLE) {
        if (devWallet == address(0) || lootDropAddress == address(0)) {
            revert AddressIsZero();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, devWallet);
        _grantRole(MANAGER_ROLE, devWallet);
        _grantRole(DEV_CONFIG_ROLE, devWallet);
        _grantRole(DEV_CONFIG_ROLE, lootDropAddress);
        _grantRole(MINTER_ROLE, lootDropAddress);

        _updateWhitelistAddress(lootDropAddress, true);

        name = _name;
        symbol = _symbol;
        defaultTokenURI = _defaultTokenURI;
        contractURI = _contractURI;
    }

    function getAllItemsAdmin(
        address _owner
    ) public view onlyRole(MINTER_ROLE) returns (LibItems.TokenReturn[] memory) {
        uint256 totalTokens = itemIds.length;
        LibItems.TokenReturn[] memory tokenReturns = new LibItems.TokenReturn[](totalTokens);

        uint index;
        for (uint i = 0; i < totalTokens; i++) {
            uint256 tokenId = itemIds[i];
            uint256 amount = balanceOf(_owner, tokenId);

            LibItems.TokenReturn memory tokenReturn = LibItems.TokenReturn({
                tokenId: tokenId,
                tokenUri: uri(tokenId),
                amount: amount
            });
            tokenReturns[index] = tokenReturn;
            index++;
        }

        // truncate the array
        LibItems.TokenReturn[] memory returnsTruncated = new LibItems.TokenReturn[](index);
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

    function addNewToken(uint256 _tokenId) public onlyRole(DEV_CONFIG_ROLE) {
        tokenExists[_tokenId] = true;
        itemIds.push(_tokenId);
        emit TokenAdded(_tokenId);
    }

    function adminMintId(address to, uint256 id, uint256 amount, bool isSoulbound) public onlyRole(MINTER_ROLE) {
        isTokenExist(id);

        if (isSoulbound) {
            _soulbound(to, id, amount);
        }

        _mint(to, id, amount, "");
        emit MintedId(to, id, amount, isSoulbound);
    }

    function adminBatchMintId(
        address[] calldata toAddresses,
        uint256 _tokenId,
        uint256[] calldata _amounts,
        bool isSoulbound
    ) external onlyRole(MINTER_ROLE) {
        for (uint256 i = 0; i < toAddresses.length; i++) {
            adminMintId(toAddresses[i], _tokenId, _amounts[i], isSoulbound);
        }
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

    function whitelistBurn(
        address to,
        uint256 tokenId,
        uint256 amount
    ) public nonReentrant soulboundCheckAndSync(to, address(0), tokenId, amount, balanceOf(to, tokenId)) {
        if (!_getWhitelistAddress(_msgSender())) {
            revert();
        }

        _burn(to, tokenId, amount);
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
        return defaultTokenURI;
    }

    function updateDefaultTokenURI(string memory _defaultTokenURI) external onlyRole(DEV_CONFIG_ROLE) {
        defaultTokenURI = _defaultTokenURI;
    }

    function updateWhitelistAddress(address _address, bool _isWhitelisted) external onlyRole(DEV_CONFIG_ROLE) {
        _updateWhitelistAddress(_address, _isWhitelisted);
    }

    function setRoyaltyInfo(address receiver, uint96 feeBasisPoints) external onlyRole(MANAGER_ROLE) {
        _setDefaultRoyalty(receiver, feeBasisPoints);
    }

    function setTokenRoyalty(
        uint256 tokenId,
        address receiver,
        uint256 feeBasisPoints
    ) external onlyRole(MANAGER_ROLE) {
        _setTokenRoyalty(tokenId, receiver, uint96(feeBasisPoints));
    }

    function resetTokenRoyalty(uint256 tokenId) external onlyRole(MANAGER_ROLE) {
        _resetTokenRoyalty(tokenId);
    }

    function setContractURI(string memory _contractURI) public onlyRole(DEV_CONFIG_ROLE) {
        contractURI = _contractURI;
        emit ContractURIChanged(_contractURI);
    }
}
