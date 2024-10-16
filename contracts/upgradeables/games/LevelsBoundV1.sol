// SPDX-License-Identifier: MIT
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

import {
    Initializable
} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {
    ERC1155Upgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import {
    ReentrancyGuardUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {
    AccessControlUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {
    ERCWhitelistSignatureUpgradeable
} from "../ercs/ERCWhitelistSignatureUpgradeable.sol";
import { IItemBound } from "../../interfaces/IItemBound.sol";
import {
    Achievo1155SoulboundUpgradeable
} from "../ercs/extensions/Achievo1155SoulboundUpgradeable.sol";

contract LevelsBoundV1 is
    Initializable,
    ERC1155Upgradeable,
    Achievo1155SoulboundUpgradeable,
    ReentrancyGuardUpgradeable,
    ERCWhitelistSignatureUpgradeable,
    AccessControlUpgradeable
{
    mapping(address => uint256) private currentPlayerLevel;
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant DEV_CONFIG_ROLE = keccak256("DEV_CONFIG_ROLE");

    string public name;
    string public symbol;
    address public itemsNFTAddress;
    bool public mintRandomItemEnabled;

    error InvalidSignature();
    error AddressAlreadySet();
    error AccountAlreadyHasThatLevel();
    error MintingRandomItemAlreadySet();
    error InvalidSeed();

    event RandomItemMinted(address to, bytes data, address itemsNFTAddress);
    event MintRandomItemEnabledChanged(bool enabled, address admin);
    event LevelUp(uint256 newLevel, address account);
    event LevelBurned(uint256 levelBurned, address admin);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory _name,
        string memory _symbol,
        address developerAdmin,
        bool _mintRandomItemEnabled,
        address _itemsNFTAddress
    ) public initializer {
        __ERC1155_init("");
        __ReentrancyGuard_init();
        __AccessControl_init();
        __ERCWhitelistSignatureUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, developerAdmin);
        _grantRole(MINTER_ROLE, developerAdmin);
        _grantRole(DEV_CONFIG_ROLE, developerAdmin);
        _addWhitelistSigner(msg.sender);
        name = _name;
        symbol = _symbol;
        mintRandomItemEnabled = _mintRandomItemEnabled;
        itemsNFTAddress = _itemsNFTAddress;
    }

    function mintLevel(
        address account,
        uint256 level,
        bytes calldata data
    ) private {
        _soulbound(account, level, 1);
        _mint(account, level, 1, "");
        currentPlayerLevel[account] = level;
        if (mintRandomItemEnabled) {
            mintRandomItem(account, data);
        }
        emit LevelUp(level, account);
    }

    function mintRandomItem(address to, bytes calldata data) private {
        IItemBound(itemsNFTAddress).adminMint(to, data, false);
        emit RandomItemMinted(to, data, itemsNFTAddress);
    }

    function mintItems(address to, bytes memory data) private {
        IItemBound(itemsNFTAddress).adminMint(to, data, false);
        emit RandomItemMinted(to, data, itemsNFTAddress);
    }

    function levelUp(
        uint256 nonce,
        bytes calldata data,
        bytes calldata signature
    ) public {
        if (!_verifySignature(_msgSender(), nonce, data, signature)) {
            revert InvalidSignature();
        }
        uint currentLevel = currentPlayerLevel[_msgSender()];
        uint nextLevel = currentLevel + 1;

        if (nextLevel == 1) {
            mintLevel(_msgSender(), 1, data);
            return;
        }
        mintLevel(_msgSender(), nextLevel, data);
        burnLevel(_msgSender(), currentLevel);
    }

    function changeItemsNFTAddress(
        address _itemsNFTAddress
    ) public onlyRole(DEV_CONFIG_ROLE) {
        if (_itemsNFTAddress == itemsNFTAddress) {
            revert AddressAlreadySet();
        }
        itemsNFTAddress = _itemsNFTAddress;
    }

    function adminReplaceLevel(
        address account,
        uint256 level
    ) public onlyRole(MINTER_ROLE) {
        if (currentPlayerLevel[account] == level) {
            revert AccountAlreadyHasThatLevel();
        }

        // burn first the current level if exists
        if (currentPlayerLevel[account] != 0) {
            burnLevel(account, currentPlayerLevel[account]);
        }
        _soulbound(account, level, 1);
        _mint(account, level, 1, "");
        currentPlayerLevel[account] = level;
        emit LevelUp(level, account);
    }

    function adminReplaceLevelAndMintItems(
        address account,
        uint256 level,
        bytes calldata data
    ) public onlyRole(MINTER_ROLE) {
        if (currentPlayerLevel[account] == level) {
            revert AccountAlreadyHasThatLevel();
        }

        // burn first the current level if exists
        if (currentPlayerLevel[account] != 0) {
            burnLevel(account, currentPlayerLevel[account]);
        }
        _soulbound(account, level, 1);
        _mint(account, level, 1, "");

        uint256[] memory _itemIds = _verifyContractChainIdAndDecode(data);
        uint256 currentChainId = getChainID();
        bytes memory itemsSeed = abi.encode(
            itemsNFTAddress,
            currentChainId,
            _itemIds
        );
        mintItems(account, itemsSeed);
        currentPlayerLevel[account] = level;
        emit LevelUp(level, account);
    }

    function _mintRandomItem(address to, uint256[] memory _itemIds) private {
        // encode item ids data
        uint256 currentChainId = getChainID();
        bytes memory data = abi.encode(
            itemsNFTAddress,
            currentChainId,
            _itemIds
        );

        IItemBound(itemsNFTAddress).adminMint(to, data, false);
        emit RandomItemMinted(to, data, itemsNFTAddress);
    }

    function adminBurnLevel(
        address account,
        uint256 levelTokenId
    ) public onlyRole(DEV_CONFIG_ROLE) {
        burnLevel(account, levelTokenId);
        currentPlayerLevel[account] = 0; // reset level to 0
        emit LevelBurned(levelTokenId, _msgSender());
    }

    function burnLevel(address account, uint256 tokenId) private nonReentrant {
        _burn(account, tokenId, 1);
    }

    function adminMintLevel(
        address account,
        uint256 level
    ) public onlyRole(MINTER_ROLE) {
        if (currentPlayerLevel[account] == level) {
            revert AccountAlreadyHasThatLevel();
        }
        currentPlayerLevel[account] = level;
        _mint(account, level, 1, "");
        emit LevelUp(level, account);
    }

    function adminGetAccountLevel(
        address account
    ) public view onlyRole(DEV_CONFIG_ROLE) returns (uint256) {
        return currentPlayerLevel[account];
    }

    function getMyLevel() public view returns (uint256) {
        return currentPlayerLevel[_msgSender()];
    }

    function setMintRandomItemEnabled(
        bool _mintRandomItemEnabled
    ) public onlyRole(DEV_CONFIG_ROLE) {
        if (_mintRandomItemEnabled == mintRandomItemEnabled) {
            revert MintingRandomItemAlreadySet();
        }
        mintRandomItemEnabled = _mintRandomItemEnabled;
        emit MintRandomItemEnabledChanged(_mintRandomItemEnabled, _msgSender());
    }

    function burn(uint256 tokenId, uint256 amount) public nonReentrant {
        revert("You can't burn this token");
        _burn(msg.sender, tokenId, amount);
    }

    function burnBatch(
        uint256[] memory tokenIds,
        uint256[] memory amounts
    ) public nonReentrant {
        revert("You can't burn more of one of this token");
        _burnBatch(msg.sender, tokenIds, amounts);
    }

    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _id,
        uint256 _amount,
        bytes memory _data
    ) public virtual override nonReentrant {
        revert("You can't transfer this token");
        super.safeTransferFrom(_from, _to, _id, _amount, _data);
    }

    function safeBatchTransferFrom(
        address _from,
        address _to,
        uint256[] memory _ids,
        uint256[] memory _amounts,
        bytes memory _data
    ) public virtual override nonReentrant {
        revert("You can't transfer this token");
        super.safeBatchTransferFrom(_from, _to, _ids, _amounts, _data);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(AccessControlUpgradeable, ERC1155Upgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
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

    function getChainID() public view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }

    function _verifyContractChainIdAndDecode(
        bytes calldata data
    ) private view returns (uint256[] memory) {
        uint256 currentChainId = getChainID();
        (
            address contractAddress,
            uint256 chainId,
            uint256[] memory tokenIds
        ) = _decodeData(data);

        if (chainId != currentChainId || contractAddress != address(this)) {
            revert InvalidSeed();
        }
        return tokenIds;
    }

    function _decodeData(
        bytes calldata _data
    ) private view returns (address, uint256, uint256[] memory) {
        (
            address contractAddress,
            uint256 chainId,
            uint256[] memory _itemIds
        ) = abi.decode(_data, (address, uint256, uint256[]));
        return (contractAddress, chainId, _itemIds);
    }

    function verifyContractChainIdAndDecode(
        bytes calldata data
    ) public view onlyRole(DEV_CONFIG_ROLE) returns (uint256[] memory) {
        return _verifyContractChainIdAndDecode(data);
    }

    // Reserved storage space to allow for layout changes in the future.
    uint256[43] private __gap;
}
