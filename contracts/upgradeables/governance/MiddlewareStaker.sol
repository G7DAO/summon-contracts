// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

interface IStaker {
    function ERC20_TOKEN_TYPE() external view returns (uint256);
    function stakeERC20(uint256 poolID, uint256 amount) external returns (uint256 positionTokenID);
    function initiateUnstake(uint256 positionTokenID) external;
    function unstake(uint256 positionTokenID) external;
}

contract MiddlewareStaker is Initializable, AccessControlUpgradeable {
    using SafeERC20 for IERC20;

    IStaker public stakerContract;
    uint256 public constant ERC20_TOKEN_TYPE = 20;

    bytes32 public constant STAKER_ROLE = keccak256("STAKER_ROLE");

    struct PositionInfo {
        address user;
        uint256 poolID;
        uint256 amount;
        uint256 tokenType;
        address tokenAddress;
    }

    // Map positionTokenID to PositionInfo
    mapping(uint256 => PositionInfo) public positions;

    // Map user address to array of position IDs
    mapping(address => uint256[]) public userPositions;

    // Upgradeable contracts cannot have constructors. Use an initializer instead.
    function initialize(address _stakerContract, address admin) public initializer {
        __AccessControl_init();
        stakerContract = IStaker(_stakerContract);
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        _setupRole(STAKER_ROLE, admin);
    }

    // Function to stake ERC20 tokens
    function stakeERC20(uint256 poolID, uint256 amount, address tokenAddress) external onlyRole(STAKER_ROLE) {
        IERC20 token = IERC20(tokenAddress);
        // Transfer tokens from STAKER_ROLE address to middleware contract
        token.safeTransferFrom(msg.sender, address(this), amount);
        // Approve Staker contract to spend tokens
        token.safeApprove(address(stakerContract), amount);
        // Stake tokens in Staker contract
        uint256 positionTokenID = stakerContract.stakeERC20(poolID, amount);
        // Store position info
        positions[positionTokenID] = PositionInfo({
            user: msg.sender,
            poolID: poolID,
            amount: amount,
            tokenType: ERC20_TOKEN_TYPE,
            tokenAddress: tokenAddress
        });
        // Keep track of user's positions
        userPositions[msg.sender].push(positionTokenID);
    }

    // Function to initiate unstake
    function initiateUnstake(uint256 positionTokenID) external onlyRole(STAKER_ROLE) {
        PositionInfo storage position = positions[positionTokenID];
        require(position.user == msg.sender, "Not your position");
        stakerContract.initiateUnstake(positionTokenID);
    }

    // Function to unstake
    function unstake(uint256 positionTokenID) external onlyRole(STAKER_ROLE) {
        PositionInfo storage position = positions[positionTokenID];
        require(position.user == msg.sender, "Not your position");
        stakerContract.unstake(positionTokenID);

        // Transfer tokens back to the STAKER_ROLE address
        IERC20(position.tokenAddress).safeTransfer(msg.sender, position.amount);

        // Remove position from user's positions
        _removeUserPosition(msg.sender, positionTokenID);
        delete positions[positionTokenID];
    }

    // Helper function to remove position from user's positions
    function _removeUserPosition(address user, uint256 positionTokenID) internal {
        uint256[] storage positionsArray = userPositions[user];
        for (uint256 i = 0; i < positionsArray.length; i++) {
            if (positionsArray[i] == positionTokenID) {
                positionsArray[i] = positionsArray[positionsArray.length - 1];
                positionsArray.pop();
                break;
            }
        }
    }

    // Implement supportsInterface for AccessControlUpgradeable
    function supportsInterface(bytes4 interfaceId) public view override(AccessControlUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
