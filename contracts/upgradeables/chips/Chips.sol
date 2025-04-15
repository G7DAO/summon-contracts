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
    ReentrancyGuardUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {
    UUPSUpgradeable
} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract Chips is
    IChips,
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    event ChipsUpdate(address indexed from, address indexed to, uint256 value);
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event AdminDeposit(
        address indexed admin,
        address[] indexed users,
        uint256[] amounts
    );
    event WithdrawAllAdmin(address indexed admin, address[] indexed users);
    event RetrieveBuyIn(
        address indexed game,
        address indexed user,
        uint256 amount
    );
    event DistributeChips(
        address indexed game,
        address[] indexed users,
        uint256[] amounts
    );

    error ChipInsufficientBalance(
        address from,
        uint256 fromBalance,
        uint256 value
    );

    error ArrayLengthMismatch();

    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    IERC20 public token;
    mapping(address => uint256) public _balances;
    uint256 public _totalSupply;
    uint8 private _decimals;

    // @dev Initializes the contract
    // @param _token The address of the token to use for the chips
    // @param _isPaused Whether the contract is paused
    function initialize(address _token, bool _isPaused) public initializer {
        __ReentrancyGuard_init();
        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(MANAGER_ROLE, msg.sender);
        _setRoleAdmin(MANAGER_ROLE, MANAGER_ROLE);
        _setRoleAdmin(GAME_ROLE, MANAGER_ROLE);

        token = IERC20(_token);
        _decimals = IERC20Metadata(_token).decimals();

        if (_isPaused) _pause();
    }

    // @dev Deposits the chips to the user
    // @param amount The amount of chips to deposit
    function deposit(uint256 amount) external whenNotPaused nonReentrant {
        token.safeTransferFrom(msg.sender, address(this), amount);
        _update(address(0), msg.sender, amount);
        emit Deposit(msg.sender, amount);
    }

    // @dev Withdraws the chips from the user
    // @param amount The amount of chips to withdraw
    function withdraw(uint256 amount) external whenNotPaused nonReentrant {
        _update(msg.sender, address(0), amount);
        token.safeTransfer(msg.sender, amount);
        emit Withdraw(msg.sender, amount);
    }

    // @dev Deposits the chips to the user
    // @param users The addresses of the users to deposit the chips to
    // @param amounts The amounts of chips to deposit to the users
    function adminDeposit(
        address[] memory users,
        uint256[] memory amounts
    ) external onlyRole(MANAGER_ROLE) nonReentrant {
        address admin = _msgSender();
        if (users.length != amounts.length) {
            revert ArrayLengthMismatch();
        }
        for (uint256 i = 0; i < users.length; i++) {
            token.safeTransferFrom(admin, address(this), amounts[i]);
            _update(address(0), users[i], amounts[i]);
        }
        emit AdminDeposit(admin, users, amounts);
    }

    // @dev Withdraws all the chips from the user
    // @param users The addresses of the users to withdraw the chips from
    function withdrawAllAdmin(
        address[] memory users
    ) external onlyRole(MANAGER_ROLE) whenPaused nonReentrant {
        for (uint256 i = 0; i < users.length; i++) {
            uint256 balance = _balances[users[i]];
            _update(users[i], address(0), balance);
            token.safeTransfer(users[i], balance);
        }
        emit WithdrawAllAdmin(_msgSender(), users);
    }

    // @dev Retrieves the buy-in from the user
    // @param from The address of the user to retrieve the buy-in from
    // @param amount The amount of chips to retrieve
    function retrieveBuyIn(
        address from,
        uint256 amount
    ) external onlyRole(GAME_ROLE) whenNotPaused nonReentrant {
        _update(from, _msgSender(), amount);
        emit RetrieveBuyIn(_msgSender(), from, amount);
    }

    // @dev Distributes the chips to the users
    // @param users The addresses of the users to distribute the chips to
    // @param amounts The amounts of chips to distribute to the users
    function distributeChips(
        address[] memory users,
        uint256[] memory amounts
    ) external onlyRole(GAME_ROLE) whenNotPaused nonReentrant {
        address sender = _msgSender();
        if (users.length != amounts.length) {
            revert ArrayLengthMismatch();
        }
        for (uint256 i = 0; i < users.length; i++) {
            _update(sender, users[i], amounts[i]);
        }
        emit DistributeChips(sender, users, amounts);
    }

    // @dev Pauses the contract
    function pause() external onlyRole(MANAGER_ROLE) {
        _pause();
    }

    // @dev Unpauses the contract
    function unpause() external onlyRole(MANAGER_ROLE) {
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

        emit ChipsUpdate(from, to, value);
    }

    // @dev Returns the decimals of the chips
    function decimals() external view returns (uint8) {
        return _decimals;
    }

    // @dev Returns true if the contract implements the interface
    // @param interfaceId The interface id to check
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(AccessControlUpgradeable) returns (bool) {
        return AccessControlUpgradeable.supportsInterface(interfaceId);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal view override onlyRole(MANAGER_ROLE) {
        // The onlyRole modifier already checks for the manager role
    }

    // Reserved storage space to allow for layout changes in the future.
    uint256[42] private __gap;
}
