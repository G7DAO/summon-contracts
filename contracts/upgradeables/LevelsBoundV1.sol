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

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { ERC1155Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {
    ReentrancyGuardUpgradeable
} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { ERCWhitelistSignatureUpgradeable } from "./ERCWhitelistSignatureUpgradeable.sol";
import { IItemBound } from "../interfaces/IItemBound.sol";
import { ERC1155SoulboundUpgradeable } from "../extensions/upgradeables/ERC1155SoulboundUpgradeable.sol";

contract LevelsBoundV1 is
    Initializable,
    ERC1155Upgradeable,
    ERC1155SoulboundUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    ERCWhitelistSignatureUpgradeable,
    AccessControlUpgradeable
{
    mapping(address => uint256) private currentPlayerLevel;
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    string public name;
    string public symbol;
    address public itemsNFTAddress;
    bool public mintRandomItemEnabled;

    event RandomItemMinted(address to, bytes data, address itemsNFTAddress);
    event MintRandomItemEnabledChanged(bool enabled, address admin);
    event LevelUp(uint256 newLevel, address account);

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
        __Ownable_init();
        __ReentrancyGuard_init();
        __AccessControl_init();
        __ERCWhitelistSignatureUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, developerAdmin);
        _setupRole(MINTER_ROLE, developerAdmin);
        _addWhitelistSigner(msg.sender);
        name = _name;
        symbol = _symbol;
        mintRandomItemEnabled = _mintRandomItemEnabled;
        itemsNFTAddress = _itemsNFTAddress;
    }

    function mintLevel(address account, uint256 level, bytes calldata data) private {
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

    function levelUp(uint256 nonce, bytes calldata data, bytes calldata signature) public {
        require(_verifySignature(_msgSender(), nonce, data, signature), "Invalid signature");
        uint currentLevel = currentPlayerLevel[_msgSender()];
        uint nextLevel = currentLevel + 1;

        if (nextLevel == 1) {
            mintLevel(_msgSender(), 1, data);
            return;
        }
        mintLevel(_msgSender(), nextLevel, data);
        burnLevel(_msgSender(), currentLevel);
    }

    function burnLevel(address account, uint256 tokenId) private nonReentrant {
        _burn(account, tokenId, 1);
    }

    function adminGetAccountLevel(address account) public view onlyRole(DEFAULT_ADMIN_ROLE) returns (uint256) {
        return currentPlayerLevel[account];
    }

    function getMyLevel() public view returns (uint256) {
        return currentPlayerLevel[_msgSender()];
    }

    function setMintRandomItemEnabled(bool _mintRandomItemEnabled) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_mintRandomItemEnabled != mintRandomItemEnabled, "Minting random item already set");
        mintRandomItemEnabled = _mintRandomItemEnabled;
        emit MintRandomItemEnabledChanged(_mintRandomItemEnabled, _msgSender());
    }

    function burn(uint256 tokenId, uint256 amount) public nonReentrant {
        revert("You can't burn this token");
        _burn(msg.sender, tokenId, amount);
    }

    function burnBatch(uint256[] memory tokenIds, uint256[] memory amounts) public nonReentrant {
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
    ) public view override(AccessControlUpgradeable, ERC1155Upgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function addWhitelistSigner(address _signer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _addWhitelistSigner(_signer);
    }

    function removeWhitelistSigner(address signer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _removeWhitelistSigner(signer);
    }
}
