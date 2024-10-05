// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// @author summon Team - https://summon.xyz
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

import "../interfaces/IERC20Decimals.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ERCWhitelistSignature } from "../ercs/ERCWhitelistSignature.sol";

contract ERC20Bridge is Pausable, ReentrancyGuard, AccessControl, ERCWhitelistSignature {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEV_CONFIG_ROLE = keccak256("DEV_CONFIG_ROLE");

    mapping(address => bool) public disabledTokens;
    uint256 public chainIdFrom;
    uint256 public chainIdTo;

    event Lock(address indexed from, address indexed token, uint256 value, uint8 decimals);
    event Unlock(address indexed from, address indexed token, uint256 value, uint8 decimals);

    constructor(address developerAdmin, uint256 _chainIdFrom, uint256 _chainIdTo) {
        _grantRole(DEFAULT_ADMIN_ROLE, developerAdmin);
        _grantRole(MINTER_ROLE, developerAdmin);
        _grantRole(DEV_CONFIG_ROLE, developerAdmin);
        _addWhitelistSigner(msg.sender);
        chainIdFrom = _chainIdFrom;
        chainIdTo = _chainIdTo;

        disabledTokens[address(0)] = true;
    }

    function pause() public onlyRole(MANAGER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(MANAGER_ROLE) {
        _unpause();
    }

    function lock(
        uint256 nonce,
        bytes calldata data,
        bytes calldata signature,
        address token,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        require(_verifySignature(_msgSender(), nonce, data, signature), "InvalidSignature");
        require(!disabledTokens[token], "DisabledToken");
        require(amount > 0, "InvalidAmount");

        // check allowance
        uint256 allowance = IERC20(token).allowance(_msgSender(), address(this));
        require(allowance >= amount, "InsufficientAllowance");

        bool success = IERC20Decimals(token).transferFrom(_msgSender(), address(this), amount);
        require(success, "TransferFailed");
        emit Lock(_msgSender(), token, amount, IERC20Decimals(token).decimals());
    }

    function unlock(
        uint256 nonce,
        bytes calldata data,
        bytes calldata signature,
        address token,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        require(_verifySignature(_msgSender(), nonce, data, signature), "InvalidSignature");
        require(!disabledTokens[token], "DisabledToken");
        require(amount > 0, "InvalidAmount");

        // check balance
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance >= amount, "InsufficientBalance");

        bool success = IERC20Decimals(token).transfer(_msgSender(), amount);
        require(success, "TransferFailed");

        emit Unlock(_msgSender(), token, amount, IERC20Decimals(token).decimals());
    }
}
