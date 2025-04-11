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

contract Game is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ERC2981Upgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    IERC20 public token;
    IChips public chips;
    address public treasury;
    uint256 public playCost;

    // Game ID -> Player address -> play balance
    mapping(uint256 => mapping(address => uint256)) public playBalance;

    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    constructor() {
        _disableInitializers();
    }

    function initialize(address _token, address _chips, address _treasury, uint256 _playCost, bool _isPaused) public initializer {
        __ReentrancyGuard_init();
        __Pausable_init();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(GAME_ROLE, DEFAULT_ADMIN_ROLE);

        token = IERC20(_token);
        chips = IChips(_chips);
        treasury = _treasury;
        playCost = _playCost;
        if (_isPaused) _pause();
    }

    function buyPlays(
        address _player,
        uint256 _gameNumber,
        uint256 _numPlays
    ) external onlyRole(GAME_ROLE) whenNotPaused {
        uint256 buyinAmount = _numPlays * playCost;
        
        uint256 initialBalance = chips.balanceOf(_player);
        require(initialBalance > buyinAmount, "Game.buyPlays: insufficient chip balance");
        
        chips.retrieveBuyIn(_player, buyinAmount);
        
        uint256 finalBalance = chips.balanceOf(_player);
        require(initialBalance - buyinAmount == finalBalance, "Game.buyPlays: unable to confirm payment");

        playBalance[_gameNumber][_player] += _numPlays;
    }

    function payout(
        address[] calldata _players,
        uint256[] calldata _rawPrizeValues
    ) external onlyRole(GAME_ROLE) whenNotPaused {
        require(
            _players.length == _rawPrizeValues.length,
            "Game.payout: incongruent number of players and prizes"
        );

        uint256[] memory netPrizes = new uint256[](_players.length);
        uint256 totalRake = 0;

        for (uint256 i = 0; i < _players.length; i++) {
            uint256 rake = (_rawPrizeValues[i] * 10) / 100; // 10% rake
            uint256 prize = _rawPrizeValues[i] - rake;

            totalRake += rake;
            netPrizes[i] = prize;
        }

        // Send the net prizes to players
        chips.distributeChips(_players, netPrizes);

        // Send the rake to treasury
        if (totalRake > 0) {
            // Do we ever want to burn the rake?
            require(treasury != address(0), "Treasury address not set");
            token.transfer(treasury, totalRake);
        }
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
        override(AccessControlUpgradeable, ERC2981Upgradeable)
        returns (bool)
    {
        return
            AccessControlUpgradeable.supportsInterface(interfaceId) ||
            ERC2981Upgradeable.supportsInterface(interfaceId);
    }
}
