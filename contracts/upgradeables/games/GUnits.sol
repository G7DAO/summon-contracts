// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IGUnits } from "../../interfaces/IGUnits.sol";
import { LibGUnits } from "../../libraries/LibGUnits.sol";
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

import {
    ReentrancyGuardUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import {
    ERCWhitelistSignatureUpgradeable
} from "../ercs/ERCWhitelistSignatureUpgradeable.sol";

// @author Game7.io Team - https://game7.io
// @contributors: [ @ogarciarevett, @karacurt, @mrk-hub]
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

contract GUnits is
    IGUnits,
    Initializable,
    AccessControlUpgradeable,
    ERCWhitelistSignatureUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event ExchangeRateSet(uint256 numerator, uint256 denominator);
    event Payout(
        address[] players,
        address[] winners,
        uint256 winnerPrize,
        uint256 collectedFees
    );
    event PayoutProcessed(
        LibGUnits.PayoutData[] payoutData,
        uint256 rakeFeeAmount
    );
    event FundsLocked(address indexed user, uint256 amount);
    event FundsUnlocked(address indexed user, uint256 amount);
    event FundsReleased(address indexed user, uint256 amount, bool returned);
    event TokenSet(address indexed newToken);
    error ChipInsufficientBalance(
        address from,
        uint256 fromBalance,
        uint256 value
    );

    error AddressIsZero();
    error NotAuthorized(address account);
    error ExchangeRateCannotBeZero();
    error ArrayLengthMismatch();
    error InvalidSeed();
    error InvalidTimestamp();
    error InsufficientUnlockedBalance(
        address user,
        uint256 requested,
        uint256 available
    );
    error NoLockedFunds(address user);
    error InvalidAmount();
    error InsufficientLockedBalance(
        address user,
        uint256 requested,
        uint256 locked
    );

    bytes32 public constant DEV_CONFIG_ROLE = keccak256("DEV_CONFIG_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant READABLE_ROLE = keccak256("READABLE_ROLE");
    bytes32 public constant GAME_SERVER_ROLE = keccak256("GAME_SERVER_ROLE");
    bytes32 public constant LIVE_OPS_ROLE = keccak256("LIVE_OPS_ROLE");

    address public token;
    mapping(address => uint256) private balances;
    uint256 public totalSupply;

    uint256 public numeratorExchangeRate;
    uint256 public denominatorExchangeRate;

    uint256 private collectedFees;

    // Locked funds tracking
    // user => total locked amount
    mapping(address => uint256) private lockedFunds;

    // @dev Initializes the contract
    // @param _token The address of the token to use for the g-units
    // @param _isPaused Whether the contract is paused
    // @param _devWallet The address of the developer wallet
    function initialize(
        address _token,
        bool _isPaused,
        address _devWallet
    ) public initializer {
        __ReentrancyGuard_init();
        __Pausable_init();
        __AccessControl_init();
        __ERCWhitelistSignatureUpgradeable_init();

        if (_devWallet == address(0) || _token == address(0)) {
            revert AddressIsZero();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, _devWallet);
        _grantRole(DEV_CONFIG_ROLE, _devWallet);
        _grantRole(MANAGER_ROLE, _devWallet);
        _grantRole(LIVE_OPS_ROLE, _devWallet);
        _setRoleAdmin(MANAGER_ROLE, DEV_CONFIG_ROLE);
        _setRoleAdmin(READABLE_ROLE, MANAGER_ROLE);
        _setRoleAdmin(LIVE_OPS_ROLE, DEV_CONFIG_ROLE);

        _addWhitelistSigner(_devWallet);
        token = _token;

        // @dev Default exchange rate is 1:1
        _setExchangeRate(1, 1);

        if (_isPaused) _pause();
    }

    // @dev Deposits the g-units to the user
    // @param data The data to deposit
    // @param nonce The nonce of the deposit
    // @param signature The signature of the deposit
    function deposit(
        bytes calldata data,
        uint256 nonce,
        bytes calldata signature
    )
        external
        whenNotPaused
        signatureCheck(_msgSender(), nonce, data, signature)
        nonReentrant
    {
        uint256 amount = _verifyContractChainIdAndDecode(data);
        _deposit(msg.sender, amount);
    }

    // @dev Withdraws the g-units from the user
    // @param data The data to withdraw
    // @param nonce The nonce of the withdraw
    // @param signature The signature of the withdraw
    function withdraw(
        bytes calldata data,
        uint256 nonce,
        bytes calldata signature
    )
        external
        whenNotPaused
        signatureCheck(_msgSender(), nonce, data, signature)
        nonReentrant
    {
        uint256 amountInGUnits = _verifyContractChainIdAndDecode(data);
        _withdraw(msg.sender, amountInGUnits);
    }

    // @dev Withdraws all the g-units from the user
    function withdrawAll() external whenNotPaused nonReentrant {
        _withdraw(_msgSender(), balances[_msgSender()]);
    }

    // @dev Deposits the g-units to the user
    // @param users The addresses of the users to deposit the g-units to
    // @param amounts The amounts of g-units to deposit to the users
    function adminDeposit(
        address[] memory users,
        uint256[] memory amounts
    ) external nonReentrant {
        if (
            !hasRole(LIVE_OPS_ROLE, _msgSender()) &&
            !hasRole(GAME_SERVER_ROLE, _msgSender())
        ) {
            revert NotAuthorized(_msgSender());
        }
        if (users.length != amounts.length) {
            revert ArrayLengthMismatch();
        }
        for (uint256 i = 0; i < users.length; i++) {
            _deposit(users[i], amounts[i]);
        }
    }

    // @dev Withdraws all the g-units from the user
    // @param users The addresses of the users to withdraw the g-units from
    function withdrawAllAdmin(
        address[] memory users
    ) external onlyRole(MANAGER_ROLE) whenPaused nonReentrant {
        for (uint256 i = 0; i < users.length; i++) {
            uint256 balance = balances[users[i]];
            if (balance > 0) {
                _withdraw(users[i], balance);
            }
        }
    }

    // @dev Pays out the winners
    // @param _payouts The payout data
    // @param _rakeFeeAmount The rake fee amount
    function adminPayout(
        LibGUnits.PayoutData[] calldata _payouts,
        uint256 _rakeFeeAmount
    ) external onlyRole(GAME_SERVER_ROLE) whenNotPaused nonReentrant {
        _processPayouts(_payouts, _rakeFeeAmount);
    }

    function _processPayouts(
        LibGUnits.PayoutData[] calldata _payouts,
        uint256 _rakeFeeAmount
    ) internal {
        collectedFees += _rakeFeeAmount;

        for (uint256 i = 0; i < _payouts.length; i++) {
            LibGUnits.PayoutData memory currentPayout = _payouts[i];

            uint256 lockedAmount = lockedFunds[currentPayout.player];

            if (currentPayout.isWinner) {
                // Winner gets locked funds back + winnings
                if (lockedAmount > 0) {
                    lockedFunds[currentPayout.player] = 0;
                    emit FundsReleased(
                        currentPayout.player,
                        lockedAmount,
                        true
                    );
                }
                _mintGUnits(currentPayout.player, currentPayout.amount);
            } else {
                // Deduct from locked funds
                if (currentPayout.amount > lockedAmount) {
                    revert InsufficientUnlockedBalance(
                        currentPayout.player,
                        currentPayout.amount,
                        lockedAmount
                    );
                }
                lockedFunds[currentPayout.player] -= currentPayout.amount;
                _burnGUnits(currentPayout.player, currentPayout.amount);
                emit FundsReleased(
                    currentPayout.player,
                    currentPayout.amount,
                    false
                );
            }
        }

        emit PayoutProcessed(_payouts, _rakeFeeAmount);
    }

    function _deposit(address _to, uint256 _amount) internal {
        IERC20(token).safeTransferFrom(msg.sender, address(this), _amount);
        uint256 amountInGUnits = _parseCurrencyToGUnits(_amount);
        _mintGUnits(_to, amountInGUnits);
        emit Deposit(_to, amountInGUnits);
    }

    function _withdraw(address _to, uint256 _amount) internal {
        // Check that user has enough unlocked funds
        uint256 totalLocked = _getTotalLockedFunds(_to);
        uint256 availableBalance = balances[_to] - totalLocked;
        if (availableBalance < _amount) {
            revert InsufficientUnlockedBalance(_to, _amount, availableBalance);
        }

        _burnGUnits(_to, _amount);
        uint256 amountInTokens = _parseGUnitsToCurrency(_amount);
        IERC20(token).safeTransfer(_to, amountInTokens);
        emit Withdraw(_to, amountInTokens);
    }

    function _mintGUnits(address _to, uint256 _amount) internal {
        balances[_to] += _amount;
        totalSupply += _amount;
    }

    function _burnGUnits(address _from, uint256 _amount) internal {
        if (balances[_from] < _amount) {
            revert ChipInsufficientBalance(_from, balances[_from], _amount);
        }
        balances[_from] -= _amount;
        totalSupply -= _amount;
    }

    // @dev Pauses the contract
    function pause() external onlyRole(DEV_CONFIG_ROLE) {
        _pause();
    }

    // @dev Unpauses the contract
    function unpause() external onlyRole(DEV_CONFIG_ROLE) {
        _unpause();
    }

    // @dev Withdraws the collected fees
    // @param _to The address to withdraw the fees to
    function withdrawFees(address _to) external onlyRole(MANAGER_ROLE) {
        IERC20(token).safeTransfer(_to, collectedFees);
        collectedFees = 0;
    }

    // @dev Sets the exchange rate
    // @param _numerator The numerator of the exchange rate
    // @param _denominator The denominator of the exchange rate
    function setExchangeRate(
        uint256 _numerator,
        uint256 _denominator
    ) external onlyRole(DEV_CONFIG_ROLE) {
        _setExchangeRate(_numerator, _denominator);
    }

    function _setExchangeRate(
        uint256 _numerator,
        uint256 _denominator
    ) internal {
        if (_numerator == 0 || _denominator == 0) {
            revert ExchangeRateCannotBeZero();
        }
        numeratorExchangeRate = _numerator;
        denominatorExchangeRate = _denominator;
        emit ExchangeRateSet(_numerator, _denominator);
    }

    // @dev Sets the token
    // @param _token The address of the token to set
    function setToken(address _token) external onlyRole(DEV_CONFIG_ROLE) {
        if (_token == address(0)) {
            revert AddressIsZero();
        }
        token = _token;
        emit TokenSet(_token);
    }

    // @dev Returns the exchange rate
    function getExchangeRate()
        external
        view
        onlyRole(READABLE_ROLE)
        returns (uint256, uint256)
    {
        return (numeratorExchangeRate, denominatorExchangeRate);
    }

    // @dev Parses the currency to g-units
    // @param currencyBalance The balance of the currency
    function _parseCurrencyToGUnits(
        uint256 currencyBalance
    ) internal view returns (uint256) {
        return
            (currencyBalance * numeratorExchangeRate) / denominatorExchangeRate;
    }

    // @dev Parses the g-units to currency
    // @param gUnitsBalance The balance of the g-units
    function _parseGUnitsToCurrency(
        uint256 gUnitsBalance
    ) internal view returns (uint256) {
        return
            (gUnitsBalance * denominatorExchangeRate) / numeratorExchangeRate;
    }

    function getCollectedFees()
        external
        view
        onlyRole(MANAGER_ROLE)
        returns (uint256)
    {
        return collectedFees;
    }

    // @dev Returns true if the contract implements the interface
    // @param interfaceId The interface id to check
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(AccessControlUpgradeable) returns (bool) {
        return AccessControlUpgradeable.supportsInterface(interfaceId);
    }

    // @dev Returns the chain id
    function getChainID() public view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }

    // @dev Verifies the contract chain id and decodes the data
    // @param data The data to verify
    function _verifyContractChainIdAndDecode(
        bytes calldata data
    ) private view returns (uint256) {
        uint256 currentChainId = getChainID();
        (
            address contractAddress,
            uint256 chainId,
            uint256 amount,
            uint256 timestamp
        ) = _decodeData(data);

        if (chainId != currentChainId || contractAddress != address(this)) {
            revert InvalidSeed();
        }
        if (timestamp < block.timestamp) {
            revert InvalidTimestamp();
        }
        return amount;
    }

    // @dev Decodes the data
    // @param _data The data to decode
    function decodeData(
        bytes calldata _data
    )
        public
        view
        onlyRole(DEV_CONFIG_ROLE)
        returns (address, uint256, uint256, uint256)
    {
        return _decodeData(_data);
    }

    function _decodeData(
        bytes calldata _data
    ) private pure returns (address, uint256, uint256, uint256) {
        (
            address contractAddress,
            uint256 chainId,
            uint256 amount,
            uint256 timestamp
        ) = abi.decode(_data, (address, uint256, uint256, uint256));
        return (contractAddress, chainId, amount, timestamp);
    }

    // @dev Locks funds for a user
    // @param user The user whose funds to lock
    // @param amount The amount to lock in g-units
    function lockFunds(
        address user,
        uint256 amount
    ) external onlyRole(GAME_SERVER_ROLE) whenNotPaused nonReentrant {
        _lockFunds(user, amount);
    }

    function lockFundsBatch(
        address[] memory users,
        uint256[] memory amounts
    ) external onlyRole(GAME_SERVER_ROLE) whenNotPaused nonReentrant {
        for (uint256 i = 0; i < users.length; i++) {
            _lockFunds(users[i], amounts[i]);
        }
    }

    function _lockFunds(address user, uint256 amount) internal {
        if (user == address(0)) revert AddressIsZero();
        if (amount == 0) revert InvalidAmount();

        uint256 userBalance = balances[user];
        uint256 totalLocked = _getTotalLockedFunds(user);
        uint256 availableBalance = userBalance - totalLocked;

        if (availableBalance < amount) {
            revert InsufficientUnlockedBalance(user, amount, availableBalance);
        }

        lockedFunds[user] = amount;

        emit FundsLocked(user, amount);
    }

    // @dev Unlocks funds for a batch of users (returns to available balance)
    // @param users The users whose funds to unlock
    // @param amounts The amounts to unlock
    function unlockFundsBatch(
        address[] memory users,
        uint256[] memory amounts
    ) external nonReentrant {
        if (
            !hasRole(LIVE_OPS_ROLE, _msgSender()) &&
            !hasRole(GAME_SERVER_ROLE, _msgSender())
        ) {
            revert NotAuthorized(_msgSender());
        }
        for (uint256 i = 0; i < users.length; i++) {
            _unlockFunds(users[i], amounts[i]);
        }
    }

    // @dev Unlocks funds for a user (returns to available balance)
    // @param user The user whose funds to unlock
    // @param amount The amount to unlock
    function unlockFunds(address user, uint256 amount) external nonReentrant {
        if (
            !hasRole(LIVE_OPS_ROLE, _msgSender()) &&
            !hasRole(GAME_SERVER_ROLE, _msgSender())
        ) {
            revert NotAuthorized(_msgSender());
        }
        _unlockFunds(user, amount);
    }

    // @dev Unlocks funds for a user (returns to available balance)
    // @param user The user whose funds to unlock
    // @param amount The amount to unlock
    function _unlockFunds(address user, uint256 amount) internal {
        uint256 locked = lockedFunds[user];
        if (locked == 0) {
            revert NoLockedFunds(user);
        }
        if (amount > locked) {
            revert InsufficientLockedBalance(user, amount, locked);
        }
        lockedFunds[user] -= amount;
        emit FundsUnlocked(user, amount);
    }

    // @dev Returns the balance of the user
    // @param account The address of the user to get the balance of
    function balanceOf(address account) public view returns (uint256) {
        if (
            hasRole(READABLE_ROLE, _msgSender()) ||
            hasRole(LIVE_OPS_ROLE, _msgSender()) ||
            hasRole(GAME_SERVER_ROLE, _msgSender()) ||
            _msgSender() == account
        ) {
            return balances[account];
        } else {
            revert NotAuthorized(_msgSender());
        }
    }

    // @dev Returns the balance of the users
    // @param accounts The addresses of the users to get the balance of
    function balanceOfBatch(
        address[] memory accounts
    ) external view returns (uint256[] memory) {
        if (
            !hasRole(GAME_SERVER_ROLE, _msgSender()) &&
            !hasRole(LIVE_OPS_ROLE, _msgSender()) &&
            !hasRole(READABLE_ROLE, _msgSender())
        ) {
            uint256[] memory batchBalances = new uint256[](accounts.length);
            for (uint256 i = 0; i < accounts.length; i++) {
                batchBalances[i] = balances[accounts[i]];
            }
            return batchBalances;
        } else {
            revert NotAuthorized(_msgSender());
        }
    }

    // @dev Gets total locked funds for a user across all sessions
    // @param user The user address
    function balanceOfLocked(address user) external view returns (uint256) {
        if (
            user == _msgSender() ||
            hasRole(READABLE_ROLE, _msgSender()) ||
            hasRole(LIVE_OPS_ROLE, _msgSender()) ||
            hasRole(GAME_SERVER_ROLE, _msgSender())
        ) {
            return _getTotalLockedFunds(user);
        }
        revert NotAuthorized(_msgSender());
    }

    function balanceOfLockedBatch(
        address[] memory users
    ) external view returns (uint256[] memory) {
        if (
            hasRole(READABLE_ROLE, _msgSender()) ||
            hasRole(LIVE_OPS_ROLE, _msgSender()) ||
            hasRole(GAME_SERVER_ROLE, _msgSender())
        ) {
            uint256[] memory totalLocked = new uint256[](users.length);
            for (uint256 i = 0; i < users.length; i++) {
                totalLocked[i] = _getTotalLockedFunds(users[i]);
            }
            return totalLocked;
        } else {
            revert NotAuthorized(_msgSender());
        }
    }

    function totalBalanceOf(address user) external view returns (uint256) {
        if (
            user == _msgSender() ||
            hasRole(READABLE_ROLE, _msgSender()) ||
            hasRole(LIVE_OPS_ROLE, _msgSender()) ||
            hasRole(GAME_SERVER_ROLE, _msgSender())
        ) {
            return balances[user] + _getTotalLockedFunds(user);
        }
        revert NotAuthorized(_msgSender());
    }

    function totalBalanceOfBatch(
        address[] memory users
    ) external view returns (uint256[] memory) {
        if (
            hasRole(READABLE_ROLE, _msgSender()) ||
            hasRole(LIVE_OPS_ROLE, _msgSender()) ||
            hasRole(GAME_SERVER_ROLE, _msgSender())
        ) {
            uint256[] memory totalBalances = new uint256[](users.length);
            for (uint256 i = 0; i < users.length; i++) {
                totalBalances[i] =
                    balances[users[i]] +
                    _getTotalLockedFunds(users[i]);
            }
            return totalBalances;
        } else {
            revert NotAuthorized(_msgSender());
        }
    }

    function _getTotalLockedFunds(
        address user
    ) internal view returns (uint256) {
        return lockedFunds[user];
    }

    // @dev Gets available (unlocked) balance for a user
    // @param user The user address
    function getAvailableBalance(address user) external view returns (uint256) {
        uint256 totalBalance = balances[user];
        uint256 totalLocked = _getTotalLockedFunds(user);
        return totalBalance > totalLocked ? totalBalance - totalLocked : 0;
    }

    // @dev Emergency function to unlock funds for users (only when paused)
    // @param user The user whose funds to unlock
    function emergencyUnlockFunds(
        address user
    ) external onlyRole(MANAGER_ROLE) whenPaused {
        uint256 locked = lockedFunds[user];
        if (locked > 0) {
            lockedFunds[user] = 0;
            emit FundsUnlocked(user, locked);
        }
    }

    // Reserved storage space to allow for layout changes in the future.
    uint256[45] private __gap;
}
