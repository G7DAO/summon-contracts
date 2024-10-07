// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * Author: Omar ogarciarevett(https://github.com/ogarciarevett)
 * Co-Authors:
 */

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

import "../../interfaces/IERC20Decimals.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { ERCWhitelistSignatureUpgradeable } from "../ercs/ERCWhitelistSignatureUpgradeable.sol";
import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

contract ERC20StakeV1 is
    Initializable,
    ERC20Upgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    AccessControlUpgradeable,
    ERCWhitelistSignatureUpgradeable
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEV_CONFIG_ROLE = keccak256("DEV_CONFIG_ROLE");

    IERC20Decimals public regularToken;
    uint8 private _decimals;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory name_,
        string memory symbol_,
        address developerAdmin,
        uint8 decimals_,
        IERC20Decimals _regularToken
    ) public initializer {
        __ERC20_init(name_, symbol_);
        __ReentrancyGuard_init();
        __AccessControl_init();
        __ERCWhitelistSignatureUpgradeable_init();
        __Pausable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, developerAdmin);
        _grantRole(MINTER_ROLE, developerAdmin);
        _grantRole(DEV_CONFIG_ROLE, developerAdmin);
        _addWhitelistSigner(_msgSender());

        regularToken = _regularToken;
        _decimals = decimals_;
    }

    function pause() public onlyRole(MANAGER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(MANAGER_ROLE) {
        _unpause();
    }

    function transferRegularTokens(address to, uint256 amount) private {
        require(amount > 0, "InvalidAmount");

        uint256 providedAllowance = IERC20Decimals(regularToken).allowance(_msgSender(), address(this));
        require(providedAllowance >= amount, "InsufficientAllowance");

        bool success = regularToken.transferFrom(_msgSender(), address(this), amount);
        require(success, "TransferFailed");
    }

    function stake(
        uint256 nonce,
        bytes calldata data,
        bytes calldata signature,
        uint256 amount
    ) public nonReentrant whenNotPaused {
        require(_verifySignature(_msgSender(), nonce, data, signature), "Invalid signature");
        transferRegularTokens(_msgSender(), amount);
        _mint(_msgSender(), amount);
        emit Staked(_msgSender(), amount);
    }

    // This function is usually used from the bridge to mint staked tokens from the lock tokens
    function adminStake(address userAddress, uint256 amount) public onlyRole(MINTER_ROLE) whenNotPaused {
        transferRegularTokens(_msgSender(), amount);
        _mint(userAddress, amount);
        emit Staked(userAddress, amount);
    }

    function unstake(
        uint256 nonce,
        bytes calldata data,
        bytes calldata signature,
        uint256 amount
    ) public nonReentrant whenNotPaused {
        require(_verifySignature(_msgSender(), nonce, data, signature), "Invalid signature");
        require(amount > 0, "InvalidAmount");
        _burn(_msgSender(), amount);
        bool success = regularToken.transfer(_msgSender(), amount);
        require(success, "TransferFailed");
        emit Unstaked(_msgSender(), amount);
    }

    function _update(address from, address to, uint256 amount) internal virtual override(ERC20Upgradeable) {
        if (from != address(0) && to != address(0)) {
            revert("TransfersNotAllowed");
        }
        super._update(from, to, amount);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    // Reserved storage space to allow for layout changes in the future.
    uint256[46] private __gap;
}
