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
    ERCWhitelistSignatureUpgradeable
} from "../ercs/ERCWhitelistSignatureUpgradeable.sol";

contract Chips is
    IChips,
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

    bytes32 public constant DEV_CONFIG_ROLE = keccak256("DEV_CONFIG_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant READABLE_ROLE = keccak256("READABLE_ROLE");
    bytes32 public constant GAME_SERVER_ROLE = keccak256("GAME_SERVER_ROLE");

    address public token;
    mapping(address => uint256) public balances;
    uint256 public totalSupply;

    uint256 public numeratorExchangeRate;
    uint256 public denominatorExchangeRate;
    uint256 public tokenDecimals;

    uint256 public collectedFees;

    // @dev Initializes the contract
    // @param _token The address of the token to use for the chips
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

        if (_devWallet == address(0)) {
            revert AddressIsZero();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, _devWallet);
        _grantRole(DEV_CONFIG_ROLE, _devWallet);
        _grantRole(MANAGER_ROLE, _devWallet);
        _setRoleAdmin(MANAGER_ROLE, DEV_CONFIG_ROLE);
        _setRoleAdmin(READABLE_ROLE, MANAGER_ROLE);

        _addWhitelistSigner(_devWallet);
        token = _token;
        tokenDecimals = IERC20Metadata(_token).decimals();

        // @dev Default exchange rate is 1:1
        _setExchangeRate(1, 1);

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
        _deposit(msg.sender, amount);
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
        _withdraw(msg.sender, amountInChips);
    }

    // @dev Deposits the chips to the user
    // @param users The addresses of the users to deposit the chips to
    // @param amounts The amounts of chips to deposit to the users
    function adminDeposit(
        address[] memory users,
        uint256[] memory amounts
    ) external onlyRole(MANAGER_ROLE) nonReentrant {
        if (users.length != amounts.length) {
            revert ArrayLengthMismatch();
        }
        for (uint256 i = 0; i < users.length; i++) {
            _deposit(users[i], amounts[i]);
        }
    }

    // @dev Withdraws all the chips from the user
    // @param users The addresses of the users to withdraw the chips from
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

    function payout(
        uint256 _betAmount,
        uint256 _feePercentage,
        address[] calldata _players,
        address[] calldata _winners
    ) external onlyRole(GAME_SERVER_ROLE) whenNotPaused nonReentrant {
        uint256 totalPrizePool = _betAmount * _players.length;
        collectedFees += totalPrizePool * _feePercentage / (100 * 10 ** tokenDecimals);
        uint256 winnerPrize = totalPrizePool - collectedFees;

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

        emit Payout(_players, _winners, winnerPrize, collectedFees);
    }

    function _deposit(address _to, uint256 _amount) internal {
        IERC20(token).safeTransferFrom(msg.sender, address(this), _amount);
        uint256 amountInChips = _parseCurrencyToChips(_amount);
        _mintChips(_to, amountInChips);
        emit Deposit(_to, amountInChips);
    }

    function _withdraw(address _to, uint256 _amount) internal {
        _burnChips(_to, _amount);
        uint256 amountInTokens = _parseChipsToCurrency(_amount);
        IERC20(token).safeTransfer(_to, amountInTokens);
        emit Withdraw(_to, amountInTokens);
    }

    function _mintChips(address _to, uint256 _amount) internal {
        balances[_to] += _amount;
        totalSupply += _amount;
    }

    function _burnChips(address _from, uint256 _amount) internal {
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
    function withdrawFees(address _to) external onlyRole(DEV_CONFIG_ROLE) {
        IERC20(token).safeTransfer(_to, collectedFees);
        delete collectedFees; // @dev hack to get some gas back by freeing up storage
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

    function _setExchangeRate(uint256 _numerator, uint256 _denominator) internal {
        if (_numerator == 0 || _denominator == 0) {
            revert ExchangeRateCannotBeZero();
        }
        numeratorExchangeRate = _numerator;
        denominatorExchangeRate = _denominator;
        emit ExchangeRateSet(_numerator, _denominator);
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
            return balances[account];
        } else {
            revert NotAuthorized(_msgSender());
        }
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

    // Reserved storage space to allow for layout changes in the future.
    uint256[50] private __gap;
}
