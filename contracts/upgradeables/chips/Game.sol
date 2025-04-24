// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IChips } from "../../interfaces/IChips.sol";
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

contract Game is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    IChips public chips;
    address public treasury;
    uint256 public defaultPlayCost;

    // Game ID -> play cost
    mapping(uint256 => uint256) public playCost;
    // Game ID -> Player address -> play balance
    mapping(uint256 => mapping(address => uint256)) public playBalance;
    // Game ID -> total game value
    mapping(uint256 => uint256) public totalGameValue;
    // Game ID -> current game value
    mapping(uint256 => uint256) public currentGameValue;

    bytes32 public constant GAME_SERVER_ROLE = keccak256("GAME_SERVER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    event PlaysBought(address indexed player, uint256 indexed gameNumber, uint256 indexed numPlays);
    event RakeCollected(uint256 indexed gameNuber, uint256 indexed rakeValue);
    event ValueDistributed(uint256 indexed gameNumber, uint256 indexed value);

    error InsufficientChipBalance(address player, uint256 balanceRequired);
    error PlayCostCannotBeChanged(uint256 gameNumber, uint256 value);
    error IncongruentArrayValues(uint256 gameNumber, uint256 playerLength, uint256 prizeLength);
    error TreasuryAddressNotSet();

    function initialize(address _chips, address _treasury, uint256 _defaultPlayCost, bool _isPaused) public initializer {
        __ReentrancyGuard_init();
        __Pausable_init();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(GAME_SERVER_ROLE, DEFAULT_ADMIN_ROLE);

        _grantRole(MANAGER_ROLE, msg.sender);
        _setRoleAdmin(MANAGER_ROLE, MANAGER_ROLE);
        _setRoleAdmin(GAME_SERVER_ROLE, MANAGER_ROLE);

        chips = IChips(_chips);
        treasury = _treasury;
        defaultPlayCost = _defaultPlayCost;
        if (_isPaused) _pause();
    }

    function buyPlays(
        address _player,
        uint256 _gameNumber,
        uint256 _numPlays
    ) external onlyRole(GAME_SERVER_ROLE) whenNotPaused nonReentrant {
        uint256 gamePlayCost = _getPlayCost(_gameNumber);
        uint256 buyinAmount = _numPlays * gamePlayCost;
        
        uint256 initialBalance = chips.balanceOf(_player);
        if (initialBalance < buyinAmount) {
            revert InsufficientChipBalance(_player, buyinAmount);
        }
        
        chips.retrieveBuyIn(_player, buyinAmount);
        totalGameValue[_gameNumber] += buyinAmount;
        currentGameValue[_gameNumber] += buyinAmount;

        playBalance[_gameNumber][_player] += _numPlays;
        emit PlaysBought(_player, _gameNumber, _numPlays);
    }
        
    function payout(
        uint256 _gameNumber,
        address[] calldata _players,
        uint256[] calldata _prizeValues,
        uint256 _rake
    ) external onlyRole(GAME_SERVER_ROLE) whenNotPaused nonReentrant {
        if (_players.length != _prizeValues.length) {
            revert IncongruentArrayValues(_gameNumber, _players.length, _prizeValues.length);
        }
        if (treasury == address(0)) {
            revert TreasuryAddressNotSet();
        }

        address[] memory receipients = new address[](_players.length + 1);
        for (uint256 i = 0; i < _players.length; i++) {
            receipients[i] = _players[i];
        }
        receipients[_players.length] = treasury; // add the new value at the end

        uint256[] memory payoutValues = new uint256[](_prizeValues.length + 1);
        for (uint256 i = 0; i < _prizeValues.length; i++) {
            payoutValues[i] = _prizeValues[i];
        }

        // Calculate net value of prizes
        uint256 valueDistributed;
        for (uint256 i = 0; i < payoutValues.length; i++) {
            valueDistributed += payoutValues[i];
        }

        payoutValues[_prizeValues.length] = _rake; // add the new value at the end

        // Distribute net prizes to players
        chips.distributeChips(receipients, payoutValues);
        emit RakeCollected(_gameNumber, _rake);

        currentGameValue[_gameNumber] -= valueDistributed;
        emit ValueDistributed(_gameNumber, valueDistributed);
    }

    function _getPlayCost(uint256 _gameNumber) internal view returns(uint256) {
        return (playCost[_gameNumber] > 0 ? playCost[_gameNumber] : defaultPlayCost);
    }

    function getPlayCost(uint256 _gameNumber) external view returns(uint256) {
        return _getPlayCost(_gameNumber);
    }

    function setPlayCost(uint256 _gameNumber, uint256 _playCost) external onlyRole(MANAGER_ROLE) {
        if (totalGameValue[_gameNumber] > 0) {
            revert PlayCostCannotBeChanged(_gameNumber, _playCost);
        }
        playCost[_gameNumber] = _playCost;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(AccessControlUpgradeable)
        returns (bool)
    {
        return
            AccessControlUpgradeable.supportsInterface(interfaceId);
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {

    }
}
