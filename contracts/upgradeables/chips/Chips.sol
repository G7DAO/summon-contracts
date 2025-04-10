// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IChips } from "../../interfaces/IChips.sol";
import {
    SafeERC20,
    IERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {
    IERC20Metadata
} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {
    AccessControlUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {
    Initializable
} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {
    PausableUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import {
    ERC2981Upgradeable
} from "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import {
    ReentrancyGuardUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

contract Chips is
    IChips,
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ERC2981Upgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    event Transfer(address indexed from, address indexed to, uint256 value);

    error ChipInsufficientBalance(
        address from,
        uint256 fromBalance,
        uint256 value
    );

    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    IERC20 public token;
    mapping(address => uint256) public _balances;
    uint256 public _totalSupply;
    uint8 private _decimals;

    constructor() {
        _disableInitializers();
    }

    // @dev Initializes the contract
    // @param _token The address of the token to use for the chips
    // @param _isPaused Whether the contract is paused
    function initialize(address _token, bool _isPaused) public initializer {
        __ReentrancyGuard_init();
        __Pausable_init();
        __AccessControl_init();

        _grantRole(ADMIN_ROLE, msg.sender);
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
        _setRoleAdmin(GAME_ROLE, ADMIN_ROLE);

        token = IERC20(_token);
        _decimals = IERC20Metadata(_token).decimals();

        if (_isPaused) _pause();
    }

    // @dev Deposits the chips to the user
    // @param amount The amount of chips to deposit
    function deposit(uint256 amount) external whenNotPaused nonReentrant {
        token.safeTransferFrom(msg.sender, address(this), amount);
        _update(address(0), msg.sender, amount);
    }

    // @dev Withdraws the chips from the user
    // @param amount The amount of chips to withdraw
    function withdraw(uint256 amount) external whenNotPaused {
        _update(msg.sender, address(0), amount);
        token.safeTransfer(msg.sender, amount);
    }

    // @dev Deposits the chips to the user
    // @param users The addresses of the users to deposit the chips to
    // @param amounts The amounts of chips to deposit to the users
    function adminDeposit(
        address[] memory users,
        uint256[] memory amounts
    ) external onlyRole(ADMIN_ROLE) nonReentrant {
        address admin = _msgSender();
        for (uint256 i = 0; i < users.length; i++) {
            token.safeTransferFrom(admin, address(this), amounts[i]);
            _update(address(0), users[i], amounts[i]);
        }
    }

    // @dev Withdraws all the chips from the user
    // @param users The addresses of the users to withdraw the chips from
    function withdrawAllAdmin(
        address[] memory users
    ) external onlyRole(ADMIN_ROLE) whenPaused nonReentrant {
        for (uint256 i = 0; i < users.length; i++) {
            _update(users[i], address(0), _balances[users[i]]);
            token.safeTransfer(users[i], _balances[users[i]]);
        }
    }

    // @dev Retrieves the buy-in from the user
    // @param from The address of the user to retrieve the buy-in from
    // @param amount The amount of chips to retrieve
    function retrieveBuyIn(
        address from,
        uint256 amount
    ) external onlyRole(GAME_ROLE) whenNotPaused {
        _update(from, address(0), amount);
    }

    // @dev Distributes the chips to the users
    // @param users The addresses of the users to distribute the chips to
    // @param amounts The amounts of chips to distribute to the users
    function distributeChips(
        address[] memory users,
        uint256[] memory amounts
    ) external onlyRole(GAME_ROLE) {
        address sender = msg.sender;
        for (uint256 i = 0; i < users.length; i++) {
            _update(sender, users[i], amounts[i]);
        }
    }

    // @dev Pauses the contract
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    // @dev Unpauses the contract
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // @dev Returns the balance of the user
    // @param account The address of the user to get the balance of
    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    // @dev Returns the total supply of the chips
    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    // @dev Internal function to update the balances of the users
    // @param from The address of the user to update the balance of
    // @param to The address of the user to update the balance of
    // @param value The amount of chips to update the balance of
    function _update(address from, address to, uint256 value) internal virtual {
        if (from == address(0)) {
            // Overflow check required: The rest of the code assumes that totalSupply never overflows
            _totalSupply += value;
        } else {
            uint256 fromBalance = _balances[from];
            if (fromBalance < value) {
                revert ChipInsufficientBalance(from, fromBalance, value);
            }
            unchecked {
                // Overflow not possible: value <= fromBalance <= totalSupply.
                _balances[from] = fromBalance - value;
            }
        }

        if (to == address(0)) {
            unchecked {
                // Overflow not possible: value <= totalSupply or value <= fromBalance <= totalSupply.
                _totalSupply -= value;
            }
        } else {
            unchecked {
                // Overflow not possible: balance + value is at most totalSupply, which we know fits into a uint256.
                _balances[to] += value;
            }
        }

        emit Transfer(from, to, value);
    }

    // @dev Returns the decimals of the chips
    function decimals() external view returns (uint8) {
        return _decimals;
    }

    // @dev Returns true if the contract implements the interface
    // @param interfaceId The interface id to check
    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(AccessControlUpgradeable, ERC2981Upgradeable)
        returns (bool)
    {
        return
            AccessControlUpgradeable.supportsInterface(interfaceId) ||
            ERC2981Upgradeable.supportsInterface(interfaceId);
    }
}
