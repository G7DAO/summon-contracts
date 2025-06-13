// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IGUnits } from "../../interfaces/IGUnits.sol";
import { LibGUnits } from "../../libraries/LibGUnits.sol";
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

import {
    ReentrancyGuardUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import {
    ERCWhitelistSignatureUpgradeable
} from "../ercs/ERCWhitelistSignatureUpgradeable.sol";

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
    event FundsReleased(address indexed user, uint256 amount);
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

    bytes32 public constant DEV_CONFIG_ROLE = keccak256("DEV_CONFIG_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant READABLE_ROLE = keccak256("READABLE_ROLE");
    bytes32 public constant GAME_SERVER_ROLE = keccak256("GAME_SERVER_ROLE");
    bytes32 public constant LIVE_OPS_ROLE = keccak256("LIVE_OPS_ROLE");
    bytes32 public constant THIRD_PARTY_ROLE = keccak256("THIRD_PARTY_ROLE");

    address public token;
    mapping(address => uint256) private balances;
    uint256 public totalSupply;

    uint256 public numeratorExchangeRate;
    uint256 public denominatorExchangeRate;

    uint256 private collectedFees;

    // Locked funds tracking
    // user => total locked amount
    mapping(address => uint256) private lockedFunds;

    uint256 public decimals;

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
        _setRoleAdmin(THIRD_PARTY_ROLE, DEV_CONFIG_ROLE);

        _addWhitelistSigner(_devWallet);
        token = _token;
        decimals = IERC20Metadata(token).decimals();

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
        _withdraw(msg.sender, msg.sender, amountInGUnits);
    }

    // @dev Withdraws the g-units from the user to a specific recipient
    // @param data The data to withdraw (includes recipient address)
    // @param nonce The nonce of the withdraw
    // @param signature The signature of the withdraw
    function withdrawTo(
        bytes calldata data,
        uint256 nonce,
        bytes calldata signature,
        address to
    )
        external
        whenNotPaused
        signatureCheck(_msgSender(), nonce, data, signature)
        nonReentrant
    {
        uint256 amountInGUnits = _verifyContractChainIdAndDecode(data);
        _withdraw(msg.sender, to, amountInGUnits);
    }

    // @dev Withdraws all the g-units from the user
    function withdrawAll() external whenNotPaused nonReentrant {
        _withdraw(_msgSender(), _msgSender(), balances[_msgSender()]);
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
            !hasRole(GAME_SERVER_ROLE, _msgSender()) &&
            !hasRole(MANAGER_ROLE, _msgSender())
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

    function thirdPartyDeposit(
        address _to,
        uint256 _amount
    ) external whenNotPaused nonReentrant onlyRole(THIRD_PARTY_ROLE) {
        _deposit(_to, _amount);
    }

    // @dev Withdraws all the g-units from the user
    // @param users The addresses of the users to withdraw the g-units from
    function withdrawAllAdmin(
        address[] memory users
    ) external onlyRole(MANAGER_ROLE) whenPaused nonReentrant {
        for (uint256 i = 0; i < users.length; i++) {
            uint256 balance = balances[users[i]];
            if (balance > 0) {
                _withdraw(users[i], users[i], balance);
            }
        }
    }

    // @dev Admin function to withdraw g-units on behalf of users to specific recipients
    // @param users The addresses of the users whose g-units to withdraw
    // @param recipients The addresses to send the withdrawn funds to
    // @param amounts The amounts of g-units to withdraw
    function adminWithdrawTo(
        address[] memory users,
        address[] memory recipients,
        uint256[] memory amounts
    ) external nonReentrant {
        if (
            !hasRole(LIVE_OPS_ROLE, _msgSender()) &&
            !hasRole(MANAGER_ROLE, _msgSender())
        ) {
            revert NotAuthorized(_msgSender());
        }
        if (
            users.length != recipients.length || users.length != amounts.length
        ) {
            revert ArrayLengthMismatch();
        }
        for (uint256 i = 0; i < users.length; i++) {
            if (recipients[i] == address(0)) revert AddressIsZero();
            _withdraw(users[i], recipients[i], amounts[i]);
        }
    }

    // @dev Admin function to withdraw all g-units on behalf of users to specific recipients
    // @param users The addresses of the users whose g-units to withdraw
    // @param recipients The addresses to send the withdrawn funds to
    function adminWithdrawAllTo(
        address[] memory users,
        address[] memory recipients
    ) external nonReentrant {
        if (
            !hasRole(LIVE_OPS_ROLE, _msgSender()) &&
            !hasRole(MANAGER_ROLE, _msgSender())
        ) {
            revert NotAuthorized(_msgSender());
        }
        if (users.length != recipients.length) {
            revert ArrayLengthMismatch();
        }
        for (uint256 i = 0; i < users.length; i++) {
            if (recipients[i] == address(0)) revert AddressIsZero();
            uint256 balance = balances[users[i]];
            if (balance > 0) {
                _withdraw(users[i], recipients[i], balance);
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

            if (lockedAmount < currentPayout.buyInAmount) {
                revert InsufficientUnlockedBalance(
                    currentPayout.player,
                    currentPayout.buyInAmount,
                    lockedAmount
                );
            }

            lockedFunds[currentPayout.player] -= currentPayout.buyInAmount;
            emit FundsReleased(currentPayout.player, currentPayout.buyInAmount);

            if (currentPayout.isWinner) {
                _mintGUnits(currentPayout.player, currentPayout.amount);
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

    function _withdraw(address _from, address _to, uint256 _amount) internal {
        // _amount is the amount of GUnits the user wants to withdraw from their LIQUID balance
        uint256 liquidBalance = balances[_from];
        if (liquidBalance < _amount) {
            revert InsufficientUnlockedBalance(_from, _amount, liquidBalance);
        }

        _burnGUnits(_from, _amount); // Decreases balances[_from] and totalSupply
        uint256 amountInTokens = _parseGUnitsToCurrency(_amount);
        IERC20(token).safeTransfer(_to, amountInTokens);
        emit Withdraw(_from, amountInTokens);
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
    // @param _previousTokenRecipient The address to send the previous token to
    function setToken(
        address _newToken
    ) external whenPaused onlyRole(DEV_CONFIG_ROLE) {
        if (_newToken == address(0)) {
            revert AddressIsZero();
        }

        if (totalSupply > 0) {
            _rebalanceGUnitDecimals(_newToken);
        }

        token = _newToken;
        decimals = IERC20Metadata(_newToken).decimals();
        emit TokenSet(_newToken);
    }

    function _rebalanceGUnitDecimals(address _newToken) internal {
        uint8 _newDecimals = IERC20Metadata(_newToken).decimals();
        if (_newDecimals == decimals) return;
        uint256 _requiredNewTokenAmount;

        // Calculate the amount needed in the new token to back all G-Units
        if (_newDecimals > decimals) {
            _requiredNewTokenAmount =
                totalSupply *
                (10 ** (_newDecimals - decimals));
        } else {
            _requiredNewTokenAmount =
                totalSupply /
                (10 ** (decimals - _newDecimals));
        }

        // Require the admin to deposit the new token
        IERC20(_newToken).safeTransferFrom(
            msg.sender,
            address(this),
            _requiredNewTokenAmount
        );
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

    // @dev Parses the g-units to currency
    // @param _gUnitsAmount The amount of g-units to parse to currency
    function parseGUnitsToCurrency(
        uint256 _gUnitsAmount
    ) external view returns (uint256) {
        if (
            !hasRole(READABLE_ROLE, _msgSender()) &&
            !hasRole(LIVE_OPS_ROLE, _msgSender()) &&
            !hasRole(GAME_SERVER_ROLE, _msgSender()) &&
            !hasRole(THIRD_PARTY_ROLE, _msgSender())
        ) {
            revert NotAuthorized(_msgSender());
        }
        return _parseGUnitsToCurrency(_gUnitsAmount);
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

        if (userBalance < amount) {
            revert InsufficientUnlockedBalance(user, amount, userBalance);
        }

        lockedFunds[user] += amount;
        balances[user] -= amount;

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
            revert InsufficientUnlockedBalance(user, amount, locked);
        }
        lockedFunds[user] -= amount;
        balances[user] += amount;
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
            hasRole(GAME_SERVER_ROLE, _msgSender()) ||
            hasRole(LIVE_OPS_ROLE, _msgSender()) ||
            hasRole(READABLE_ROLE, _msgSender())
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

    // Reserved storage space to allow for layout changes in the future.
    uint256[46] private __gap;
}
