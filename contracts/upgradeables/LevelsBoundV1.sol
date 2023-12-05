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

contract LevelsBoundV1 is
    Initializable,
    ERC1155Upgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    ERCWhitelistSignatureUpgradeable,
    AccessControlUpgradeable
{
    mapping(address => uint256) public playerLevel;
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    address public itemsNFTAddress;
    bool private mintRandomItemEnabled;

    event RandomItemMinted(address to, bytes data, address itemsNFTAddress);
    event MintRandomItemEnabledChanged(bool enabled, address admin);
    event LevelUp(uint256 newLevel, address account);
    event LevelReseted(uint256 newLevel, address account);

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
        mintRandomItemEnabled = _mintRandomItemEnabled;
        itemsNFTAddress = _itemsNFTAddress;
    }

    function mintLevel(address account, uint256 level, bytes calldata data) private {
        _mint(account, level, 1, "");
        playerLevel[account] = level;
        if (mintRandomItemEnabled) {
            mintRandomItem(account, data);
        }
        emit LevelUp(level, account);
    }

    function adminMintLevel(address account, uint256 newLevel) public onlyRole(MINTER_ROLE) {
        require(newLevel > 0, "Level must be greater than 0");
        require(playerLevel[account] < newLevel, "Is not possible to do lvl down");
        require(playerLevel[account] != 0, "Player already has this level token");
        _mint(account, newLevel, 1, "");
        playerLevel[account] = newLevel;
        emit LevelUp(newLevel, account);
    }

    function mintRandomItem(address to, bytes calldata data) private {
        IItemBound(itemsNFTAddress).adminMint(to, data, false);
        emit RandomItemMinted(to, data, itemsNFTAddress);
    }

    function levelUp(
        address account,
        uint256 newLevel,
        uint256 nonce,
        bytes calldata data,
        bytes calldata signature
    ) public nonReentrant {
        require(newLevel > 0, "New level must be greater than 0");
        require(_verifySignature(_msgSender(), nonce, data, signature), "Invalid signature");
        require(playerLevel[account] != 0, "Player already has this level token");

        if (newLevel == 1) {
            mintLevel(account, newLevel, data);
            return;
        }

        uint oldLevel = newLevel - 1;
        require(balanceOf(account, oldLevel) == 1, "Player does not have the previous level token");
        require(playerLevel[account] < newLevel, "Is not possible to do lvl down");

        burnLevel(account, oldLevel);
        mintLevel(account, newLevel, data);
    }

    function burnLevel(address account, uint256 tokenId) private nonReentrant {
        _burn(account, tokenId, 1);
    }

    function getAccountLevel(address account) public view onlyRole(DEFAULT_ADMIN_ROLE) returns (uint256) {
        return playerLevel[account];
    }

    function getMyLevel() public view returns (uint256) {
        return playerLevel[msg.sender];
    }

    function setMintRandomItemEnabled(bool _mintRandomItemEnabled) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_mintRandomItemEnabled != mintRandomItemEnabled, "Minting random item already set");
        mintRandomItemEnabled = _mintRandomItemEnabled;
        emit MintRandomItemEnabledChanged(_mintRandomItemEnabled, _msgSender());
    }

    function burn(uint256 tokenId, uint256 amount) public nonReentrant {
        _burn(msg.sender, tokenId, amount);
        playerLevel[msg.sender] = 0;
        emit LevelReseted(tokenId, msg.sender);
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
    ) public virtual override {
        revert("You can't transfer this token");
        super.safeTransferFrom(_from, _to, _id, _amount, _data);
    }

    function safeBatchTransferFrom(
        address _from,
        address _to,
        uint256[] memory _ids,
        uint256[] memory _amounts,
        bytes memory _data
    ) public virtual override {
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
