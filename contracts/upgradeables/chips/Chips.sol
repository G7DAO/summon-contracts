// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IChips } from "../../interfaces/IChips.sol";
import {
    SafeERC20,
    IERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
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
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract Chips is
    IChips,
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ERC2981Upgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    event Transfer(address indexed from, address indexed to, uint256 value);

    error ChipInsufficientBalance(
        address from,
        uint256 fromBalance,
        uint256 value
    );

    IERC20 public token;

    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    mapping(address => uint256) public _balances;
    uint256 public _totalSupply;

    function initialize(address _token, bool _isPaused) public initializer {
        __ReentrancyGuard_init();
        __Pausable_init();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(GAME_ROLE, DEFAULT_ADMIN_ROLE);

        token = IERC20(_token);
        if (_isPaused) _pause();
    }

    function deposit(uint256 amount) external whenNotPaused {
        token.safeTransferFrom(msg.sender, address(this), amount);
        _update(address(0), msg.sender, amount);
    }

    function withdraw(uint256 amount) external whenNotPaused {
        _update(msg.sender, address(0), amount);
        token.safeTransfer(msg.sender, amount);
    }

    function withdrawAllAdmin(
        address[] memory users
    ) external onlyRole(DEFAULT_ADMIN_ROLE) whenPaused {
        for (uint256 i = 0; i < users.length; i++) {
            _update(users[i], address(0), _balances[users[i]]);
            token.safeTransfer(users[i], _balances[users[i]]);
        }
    }

    function retrieveBuyIn(
        address from,
        uint256 amount
    ) external onlyRole(GAME_ROLE) whenNotPaused {
        _update(from, msg.sender, amount);
    }

    function distributeChips(
        address[] memory users,
        uint256[] memory amounts
    ) external onlyRole(GAME_ROLE) {
        address sender = msg.sender;
        for (uint256 i = 0; i < users.length; i++) {
            _update(sender, users[i], amounts[i]);
        }
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

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
    
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {

    }
}
