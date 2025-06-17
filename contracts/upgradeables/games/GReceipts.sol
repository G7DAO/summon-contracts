// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IGUnits } from "../../interfaces/IGUnits.sol";
import {
    AccessControlUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {
    Initializable
} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {
    PausableUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {
    ERC1155Upgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import {
    Achievo1155SoulboundUpgradeable
} from "../ercs/extensions/Achievo1155SoulboundUpgradeable.sol";
import {
    ReentrancyGuardUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// @author Game7.io Team - https://game7.io
// @contributors: [ @ogarciarevett, @karacurt]
/*
 *
 *
 *
 *
 *                                         ..',,;;:::;;;,'..
 *                                     .';ldkO0KXXNNNNNNNXXK0Okdl;'.
 *                                 .,cdOKNWMMMMMMMMMMMMMMMMMMMMMWNXOdc,.
 *                               'ckXWWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWXkc'
 *                            .,o0NMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMN0d,.
 *                          .;dKWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWXx;.
 *                        .'oKWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWKo'
 *                       .:ONMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMNO:.
 *                      .lKWMMMMMWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMWKl.
 *                     .lKWMMMMMWOoccccccccccccccccccccccccccccccccccccld0WMMMMMWKl.
 *                    .c0MMMMMMMWKl.                                   .oXWMMMMMMMKc.
 *                   ;OWMMMMMMMMMNx,                                 'oXMMMMMMMMMWO;
 *                  .oXMMMMMMMMMMMNO:.                             .c0NMMMMMMMMMMMNo.
 *                   ;kNMMMMMMMMMMMMMKo.          .;;;;;'.         .c0MMMMMMMMMMMMMWk;
 *                  .c0WMMMMMMMMMMMMMMXd.        .cOXXXOl.        ;kXWMMMMMMMMMMMMMWKc.
 *                  .lXWMMMMMMMMMMMMMMMNkl:::::::cdKWNKl.        ,OWMMMMMMMMMMMMMMMMXo.
 *                  .oXMMMMMMMMMMMMMMMMMMWMMMMMMMMMWW0:        'o0WMMMMMMMMMMMMMMMMMXo.
 *                  .lKWMMMMMMMMMMMMMMMMMMMMMMMMMWNkd:.       'kNMMMMMMMMMMMMMMMMMMWXl.
 *                  .:0WMMMMMMMMMMMMMMMMMMMMMMMMMKl.        .:kNMMMMMMMMMMMMMMMMMMMW0c.
 *                   ,xNMMMMMMMMMMMMMMMMMMMMMMMWKl.        .lKWMMMMMMMMMMMMMMMMMMMMNk,
 *                   .lXMMMMMMMMMMMMMMMMMMMMMMWKl.        'oKWMMMMMMMMMMMMMMMMMMMMMXl.
 *                   ,kNMMMMMMMMMMMMMMMMMMMMMMNk;       ,kNMMMMMMMMMMMMMMMMMMMMMMNk,
 *                   .;OWMMMMMMMMMMMMMMMMMMMMMMWOc.   .:OWMMMMMMMMMMMMMMMMMMMMMMW0;.
 *                     .:0WMMMMMMMMMMMMMMMMMMMMMMWXd:,,dXWMMMMMMMMMMMMMMMMMMMMMMW0c.
 *                      .:ONMMMMMMMMMMMMMMMMMMMMMMMNKK0NMMMMMMMMMMMMMMMMMMMMMMMNO:.
 *                       .,dXWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWXx,.
 *                         .:ONMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMNOc.
 *                           .lONMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMNOl.
 *                             .ckXWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWXkc.
 *                               .;oOXNWMMMMMMMMMMMMMMMMMMMMMMMMMMMWNXOo;.
 *                                 ..'cdOKNWMMMMMMMMMMMMMMMMMMMWNKOdc,..
 *                                      ..;codkO00KXXXXKKK0Okdoc;..
 *
 */

contract GReceipts is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ERC1155Upgradeable,
    Achievo1155SoulboundUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    event GUnitsSet(address indexed newGUnits);
    event PaymentTokenSet(address indexed newPaymentToken);
    error AddressIsZero();
    error SoulboundError();
    error InvalidAmount();

    bytes32 public constant DEV_CONFIG_ROLE = keccak256("DEV_CONFIG_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    address public gUnits;
    address public paymentToken;

    uint256 public constant DEFAULT_RECEIPT_ID = 1;

    // @dev Initializes the contract
    // @param _token The address of the token to use for the g-units
    // @param _isPaused Whether the contract is paused
    // @param _devWallet The address of the developer wallet
    function initialize(
        address _gUnits,
        address _paymentToken,
        bool _isPaused,
        address _devWallet
    ) public initializer {
        __ReentrancyGuard_init();
        __Pausable_init();
        __AccessControl_init();
        __ERC1155_init("");

        if (
            _devWallet == address(0) ||
            _gUnits == address(0) ||
            _paymentToken == address(0)
        ) {
            revert AddressIsZero();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, _devWallet);
        _grantRole(DEV_CONFIG_ROLE, _devWallet);
        _grantRole(MINTER_ROLE, _devWallet);
        _grantRole(MANAGER_ROLE, _devWallet);
        _setRoleAdmin(MINTER_ROLE, DEV_CONFIG_ROLE);
        _setRoleAdmin(MANAGER_ROLE, DEV_CONFIG_ROLE);

        gUnits = _gUnits;
        paymentToken = _paymentToken;

        if (_isPaused) _pause();
    }

    function mint(
        address _to,
        uint256 _amount
    ) external whenNotPaused onlyRole(MINTER_ROLE) {
        if (_to == address(0)) {
            revert AddressIsZero();
        }
        if (_amount == 0) {
            revert InvalidAmount();
        }
        _soulbound(_to, DEFAULT_RECEIPT_ID, _amount);
        _mint(_to, DEFAULT_RECEIPT_ID, _amount, "");
        uint256 currencyAmount = IGUnits(gUnits).parseGUnitsToCurrency(_amount);
        IERC20(paymentToken).safeTransferFrom(
            msg.sender,
            address(this),
            currencyAmount
        );
        IERC20(paymentToken).approve(gUnits, currencyAmount);
        address[] memory users = new address[](1);
        users[0] = _to;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = _amount;
        IGUnits(gUnits).adminDeposit(users, amounts);
    }

    // @dev Pauses the contract
    function pause() external onlyRole(DEV_CONFIG_ROLE) {
        _pause();
    }

    // @dev Unpauses the contract
    function unpause() external onlyRole(DEV_CONFIG_ROLE) {
        _unpause();
    }

    // @dev Sets the token
    // @param _token The address of the token to set
    // @param _previousTokenRecipient The address to send the previous token to
    function setGUnits(address _newGUnits) external onlyRole(DEV_CONFIG_ROLE) {
        if (_newGUnits == address(0)) {
            revert AddressIsZero();
        }
        gUnits = _newGUnits;
        emit GUnitsSet(_newGUnits);
    }

    // @dev Sets the payment token
    // @param _newPaymentToken The address of the new payment token
    function setPaymentToken(
        address _newPaymentToken
    ) external onlyRole(DEV_CONFIG_ROLE) {
        if (_newPaymentToken == address(0)) {
            revert AddressIsZero();
        }
        paymentToken = _newPaymentToken;
        emit PaymentTokenSet(_newPaymentToken);
    }

    // @dev Returns true if the contract implements the interface
    // @param interfaceId The interface id to check
    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(AccessControlUpgradeable, ERC1155Upgradeable)
        returns (bool)
    {
        return
            AccessControlUpgradeable.supportsInterface(interfaceId) ||
            ERC1155Upgradeable.supportsInterface(interfaceId);
    }

    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _id,
        uint256 _amount,
        bytes memory _data
    ) public virtual override nonReentrant {
        revert SoulboundError();
    }

    function safeBatchTransferFrom(
        address _from,
        address _to,
        uint256[] memory _ids,
        uint256[] memory _amounts,
        bytes memory _data
    ) public virtual override nonReentrant {
        revert SoulboundError();
    }

    // Reserved storage space to allow for layout changes in the future.
    uint256[47] private __gap;
}
