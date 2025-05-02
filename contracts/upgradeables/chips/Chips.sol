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

import {
    ReentrancyGuardUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {
    UUPSUpgradeable
} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {
    ERCWhitelistSignatureUpgradeable
} from "../ercs/ERCWhitelistSignatureUpgradeable.sol";

contract Chips is
    IChips,
    Initializable,
    AccessControlUpgradeable,
    ERCWhitelistSignatureUpgradeable,
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
        address[] users,
        uint256[] amounts
    );
    event WithdrawAllAdmin(address indexed admin, address[] users);
    event RetrieveBuyIn(
        address indexed game,
        address indexed user,
        uint256 amount
    );
    event DistributeChips(
        address indexed game,
        address[] users,
        uint256[] amounts
    );
    event ExchangeRateSet(
        address indexed admin,
        uint256 numerator,
        uint256 denominator
    );
    event PlaysBought(
        address indexed player,
        uint256 indexed gameNumber,
        uint256 indexed numPlays
    );
    event Payout(
        address[] players,
        address[] winners,
        uint256 winnerPrize
    );

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
    error WrongFunction();

    error InsufficientChipBalance(address player, uint256 balanceRequired);
    error TotalChipsInPlayExceeded(
        uint256 totalChipsInPlay,
        uint256 totalSupply
    );
    error TreasuryAddressNotSet();

    bytes32 public constant DEV_CONFIG_ROLE = keccak256("DEV_CONFIG_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant READABLE_ROLE = keccak256("READABLE_ROLE");
    bytes32 public constant GAME_SERVER_ROLE = keccak256("GAME_SERVER_ROLE");

    IERC20 public token;
    mapping(address => uint256) public _balances;
    uint256 public _totalSupply;
    uint8 private _decimals;

    uint256 public numeratorExchangeRate;
    uint256 public denominatorExchangeRate;

    address public treasury;
    uint256 public totalChipsInPlay;
    uint256 public defaultPlayCost;

    // @dev Initializes the contract
    // @param _token The address of the token to use for the chips
    // @param _isPaused Whether the contract is paused
    // @param _devWallet The address of the developer wallet
    // @param _treasury The address of the treasury
    // @param _defaultPlayCost The default play cost
    function initialize(
        address _token,
        bool _isPaused,
        address _devWallet,
        address _treasury,
        uint256 _defaultPlayCost
    ) public initializer {
        __ReentrancyGuard_init();
        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();
        __ERCWhitelistSignatureUpgradeable_init();

        if (_devWallet == address(0)) {
            revert AddressIsZero();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, _devWallet);
        _grantRole(DEV_CONFIG_ROLE, _devWallet);
        _grantRole(MANAGER_ROLE, _devWallet);
        _setRoleAdmin(MANAGER_ROLE, DEV_CONFIG_ROLE);
        _setRoleAdmin(READABLE_ROLE, MANAGER_ROLE);

        _addWhitelistSigner(_devWallet);
        token = IERC20(_token);
        treasury = _treasury;
        defaultPlayCost = _defaultPlayCost;
        _decimals = IERC20Metadata(_token).decimals();

        // @dev Default exchange rate is 1:1
        numeratorExchangeRate = 1;
        denominatorExchangeRate = 1;

        emit ExchangeRateSet(
            _devWallet,
            numeratorExchangeRate,
            denominatorExchangeRate
        );

        if (_isPaused) _pause();
    }

    // @dev Deposits the chips to the user
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
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 amountInChips = _parseCurrencyToChips(amount);
        _mintChips(msg.sender, amountInChips);
        emit Deposit(msg.sender, amountInChips);
    }

    // @dev Withdraws the chips from the user
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
        uint256 amountInChips = _verifyContractChainIdAndDecode(data);
        _burnChips(msg.sender, amountInChips);
        uint256 amountInTokens = _parseChipsToCurrency(amountInChips);
        token.safeTransfer(msg.sender, amountInTokens);
        emit Withdraw(msg.sender, amountInTokens);
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
            uint256 amountInChips = _parseCurrencyToChips(amounts[i]);
            _mintChips(users[i], amountInChips);
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
            if (balance > 0) {
                _burnChips(users[i], balance);
                uint256 amountInTokens = _parseChipsToCurrency(balance);
                token.safeTransfer(users[i], amountInTokens);
            }
        }
        emit WithdrawAllAdmin(_msgSender(), users);
    }

    function payout(
        uint256 _betAmount,
        uint256 _feePercentage,
        address[] calldata _players,
        address[] calldata _winners
    ) external onlyRole(GAME_SERVER_ROLE) whenNotPaused nonReentrant {
        uint256 totalPrizePool = _betAmount * _players.length;
        uint256 feeAmount = totalPrizePool * _feePercentage / 100 ether;
        uint256 winnerPrize = totalPrizePool - feeAmount;

        if (_winners.length > 1) {
            // If there are multiple winners, distribute the prize pool equally
            winnerPrize = winnerPrize / _winners.length;
        }

        // Burn the chips - aka buy in
        for (uint256 i = 0; i < _players.length; i++) {
            _burnChips(_players[i], _betAmount);
        }

        // Mint the chips - aka payout
        for (uint256 i = 0; i < _winners.length; i++) {
            _mintChips(_winners[i], winnerPrize);
        }

        if (treasury != address(0)) {
            uint256 feeAmountInTokens = _parseChipsToCurrency(feeAmount);
            token.safeTransfer(treasury, feeAmountInTokens);
        }

        emit Payout(_players, _winners, winnerPrize);
    }

    function _mintChips(address _to, uint256 _amount) internal {
        _balances[_to] += _amount;
        _totalSupply += _amount;
    }

    function _burnChips(address _from, uint256 _amount) internal {
        if (_balances[_from] < _amount) {
            revert ChipInsufficientBalance(_from, _balances[_from], _amount);
        }
        _balances[_from] -= _amount;
        _totalSupply -= _amount;
    }

    // @dev Pauses the contract
    function pause() external onlyRole(MANAGER_ROLE) {
        _pause();
    }

    // @dev Unpauses the contract
    function unpause() external onlyRole(MANAGER_ROLE) {
        _unpause();
    }

    // @dev Sets the exchange rate
    // @param _numerator The numerator of the exchange rate
    // @param _denominator The denominator of the exchange rate
    function setExchangeRate(
        uint256 _numerator,
        uint256 _denominator
    ) external onlyRole(MANAGER_ROLE) {
        if (_numerator == 0 || _denominator == 0) {
            revert ExchangeRateCannotBeZero();
        }
        numeratorExchangeRate = _numerator;
        denominatorExchangeRate = _denominator;
        emit ExchangeRateSet(_msgSender(), _numerator, _denominator);
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

    // @dev Parses the currency to chips
    // @param currencyBalance The balance of the currency
    function _parseCurrencyToChips(
        uint256 currencyBalance
    ) internal view returns (uint256) {
        return
            (currencyBalance * numeratorExchangeRate) / denominatorExchangeRate;
    }

    // @dev Parses the chips to currency
    // @param chipsBalance The balance of the chips
    function _parseChipsToCurrency(
        uint256 chipsBalance
    ) internal view returns (uint256) {
        return (chipsBalance * denominatorExchangeRate) / numeratorExchangeRate;
    }

    // @dev Returns the balance of the user
    // @param account The address of the user to get the balance of
    function balanceOf(address account) public view returns (uint256) {
        if (
            hasRole(MANAGER_ROLE, _msgSender()) ||
            hasRole(READABLE_ROLE, _msgSender()) ||
            _msgSender() == account
        ) {
            return _balances[account];
        } else {
            revert NotAuthorized(_msgSender());
        }
    }

    // @dev Returns the total supply of the chips
    function totalSupply() external view returns (uint256) {
        return _totalSupply;
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

    // @dev Authorizes the upgrade
    // @param newImplementation The address of the new implementation
    function _authorizeUpgrade(
        address newImplementation
    ) internal view override onlyRole(DEV_CONFIG_ROLE) {
        // The onlyRole modifier already checks for the manager role
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

    // Reserved storage space to allow for layout changes in the future.
    uint256[50] private __gap;
}
