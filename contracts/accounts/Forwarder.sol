// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

// @author summon Team - https://summon.xyz
// @contributors: [@ogarciarevett]
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


/// @title Forwarder
/// @notice This contract handles deposits of native tokens, forwarding deposits to a parent address
contract Forwarder is
    AccessControl,
    Pausable,
    ReentrancyGuard
{
    /*//////////////////////////////////////////////////////////////
                               STATE-VARS
    //////////////////////////////////////////////////////////////*/
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    address public parentAddress;
    mapping(address => uint256) public deposits;
    uint256 public minDeposit = 0.00001 ether;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/
    event ForwarderDeposited(address indexed user, address indexed payer, uint256 value, address indexed parentAddress);
    event ParentAddressUpdated(address newParentAddress);
    event MinDepositUpdated(uint256 newMinDeposit);

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
   //////////////////////////////////////////////////////////////*/
    modifier validDeposit() {
        if(msg.value < minDeposit) revert InvalidAmount();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/
    error ForwardFailed();
    error InvalidParentAddress();
    error InsufficientBalance();
    error InvalidAmount();
    error InvalidMinDeposit();

    /// @notice Constructs the Forwarder contract
    /// @param _parentAddress The address to which deposits will be forwarded
    /// @param _admin The address that will be granted admin roles
    constructor(address _parentAddress, address _admin) {
        if (_parentAddress == address(0)) revert InvalidParentAddress();
        parentAddress = _parentAddress;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(PAUSER_ROLE, _admin);
    }

    /*//////////////////////////////////////////////////////////////
                           EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    /// @notice Allows a user to withdraw their balance
    function deposit() external payable nonReentrant whenNotPaused validDeposit {
        _handleDeposit(msg.sender, msg.value);
    }

    /// @notice Allows a user to withdraw their balance
    /// @param user The address of the user that will receive the deposit
    function depositTo(address user) external payable nonReentrant whenNotPaused validDeposit {
        _handleDeposit(user, msg.value);
    }

    /// @notice Updates the parent address to which deposits are forwarded
    /// @param newParentAddress The new parent address
    function updateParentAddress(address newParentAddress) external onlyRole(ADMIN_ROLE) {
        if (newParentAddress == address(0)) revert InvalidParentAddress();
        parentAddress = newParentAddress;
        emit ParentAddressUpdated(newParentAddress);
    }

    /// @notice Updates the minimum deposit amount
    /// @param newMinDeposit The new minimum deposit amount
    function updateMinDeposit(uint256 newMinDeposit) external onlyRole(ADMIN_ROLE) {
        if (newMinDeposit == 0) revert InvalidMinDeposit();
        minDeposit = newMinDeposit;
        emit MinDepositUpdated(newMinDeposit);
    }

    /// @notice Pauses the contract
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Unpauses the contract
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /// @notice Handles incoming native token transfers
    receive() external payable whenNotPaused validDeposit {
        _handleDeposit(msg.sender, msg.value);
    }

    /// @notice Allows deposits on behalf of a specified user
    fallback() external payable whenNotPaused validDeposit {
        _handleDeposit(msg.sender, msg.value);
    }

    /*//////////////////////////////////////////////////////////////
                           INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    /// @notice Handles deposits, updating balances and forwarding funds
    /// @param user that will receive the deposit
    /// @param amount The amount of native tokens being deposited
    function _handleDeposit(address user, uint256 amount) internal {
        (bool success, ) = parentAddress.call{value: amount}("");
        if (!success) revert ForwardFailed();
        emit ForwarderDeposited(user, msg.sender, amount, parentAddress);
    }
}