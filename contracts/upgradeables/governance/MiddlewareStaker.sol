// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721, IERC721ReceiverUpgradeable } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC1155, IERC1155ReceiverUpgradeable } from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

interface IStaker {
    function NATIVE_TOKEN_TYPE() external view returns (uint256);
    function ERC20_TOKEN_TYPE() external view returns (uint256);
    function ERC721_TOKEN_TYPE() external view returns (uint256);
    function ERC1155_TOKEN_TYPE() external view returns (uint256);

    function stakeNative(uint256 poolID) external payable returns (uint256 positionTokenID);
    function stakeERC20(uint256 poolID, uint256 amount) external returns (uint256 positionTokenID);
    function stakeERC721(uint256 poolID, uint256 tokenID) external returns (uint256 positionTokenID);
    function stakeERC1155(uint256 poolID, uint256 amount) external returns (uint256 positionTokenID);

    function initiateUnstake(uint256 positionTokenID) external;
    function unstake(uint256 positionTokenID) external;
}

contract MiddlewareStaker is Initializable, AccessControlUpgradeable, IERC721ReceiverUpgradeable, IERC1155ReceiverUpgradeable {
    using SafeERC20 for IERC20;

    IStaker public stakerContract;
    uint256 public constant NATIVE_TOKEN_TYPE = 1;
    uint256 public constant ERC20_TOKEN_TYPE = 20;
    uint256 public constant ERC721_TOKEN_TYPE = 721;
    uint256 public constant ERC1155_TOKEN_TYPE = 1155;

    bytes32 public constant STAKER_ROLE = keccak256("STAKER_ROLE");

    struct PositionInfo {
        address user;
        uint256 poolID;
        uint256 amount;
        uint256 tokenID; // For ERC721 and ERC1155
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
            tokenID: 0,
            tokenType: ERC20_TOKEN_TYPE,
            tokenAddress: tokenAddress
        });
        // Keep track of user's positions
        userPositions[msg.sender].push(positionTokenID);
    }

    // Function to stake ERC721 tokens
    function stakeERC721(uint256 poolID, uint256 tokenID, address tokenAddress) external onlyRole(STAKER_ROLE) {
        // Transfer the ERC721 token from the STAKER_ROLE address to the middleware contract
        IERC721(tokenAddress).safeTransferFrom(msg.sender, address(this), tokenID);
        // Approve the Staker contract to transfer the token if necessary
        IERC721(tokenAddress).approve(address(stakerContract), tokenID);
        // Stake the token in the Staker contract
        uint256 positionTokenID = stakerContract.stakeERC721(poolID, tokenID);
        // Store position info
        positions[positionTokenID] = PositionInfo({
            user: msg.sender,
            poolID: poolID,
            amount: 1, // ERC721 tokens represent 1 token
            tokenID: tokenID,
            tokenType: ERC721_TOKEN_TYPE,
            tokenAddress: tokenAddress
        });
        // Keep track of user's positions
        userPositions[msg.sender].push(positionTokenID);
    }

    // Function to stake ERC1155 tokens
    function stakeERC1155(uint256 poolID, uint256 amount, address tokenAddress, uint256 tokenID) external onlyRole(STAKER_ROLE) {
        // Transfer the ERC1155 tokens from the STAKER_ROLE address to the middleware contract
        IERC1155(tokenAddress).safeTransferFrom(msg.sender, address(this), tokenID, amount, "");
        // Stake the tokens in the Staker contract
        uint256 positionTokenID = stakerContract.stakeERC1155(poolID, amount);
        // Store position info
        positions[positionTokenID] = PositionInfo({
            user: msg.sender,
            poolID: poolID,
            amount: amount,
            tokenID: tokenID,
            tokenType: ERC1155_TOKEN_TYPE,
            tokenAddress: tokenAddress
        });
        // Keep track of user's positions
        userPositions[msg.sender].push(positionTokenID);
    }

    // Function to stake Native tokens
    function stakeNative(uint256 poolID) external payable onlyRole(STAKER_ROLE) {
        // Stake the native tokens in the Staker contract
        uint256 positionTokenID = stakerContract.stakeNative{value: msg.value}(poolID);
        // Store position info
        positions[positionTokenID] = PositionInfo({
            user: msg.sender,
            poolID: poolID,
            amount: msg.value,
            tokenID: 0,
            tokenType: NATIVE_TOKEN_TYPE,
            tokenAddress: address(0)
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

        // Depending on the token type, transfer tokens back to the STAKER_ROLE address
        if (position.tokenType == ERC20_TOKEN_TYPE) {
            IERC20(position.tokenAddress).safeTransfer(msg.sender, position.amount);
        } else if (position.tokenType == ERC721_TOKEN_TYPE) {
            IERC721(position.tokenAddress).safeTransferFrom(address(this), msg.sender, position.tokenID);
        } else if (position.tokenType == ERC1155_TOKEN_TYPE) {
            IERC1155(position.tokenAddress).safeTransferFrom(address(this), msg.sender, position.tokenID, position.amount, "");
        } else if (position.tokenType == NATIVE_TOKEN_TYPE) {
            payable(msg.sender).transfer(position.amount);
        }

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

    // Implement IERC721ReceiverUpgradeable interface
    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return IERC721ReceiverUpgradeable.onERC721Received.selector;
    }

    // Implement IERC1155ReceiverUpgradeable interface
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure override returns (bytes4) {
        return IERC1155ReceiverUpgradeable.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
    external
    pure
    override
    returns (bytes4)
    {
        return IERC1155ReceiverUpgradeable.onERC1155BatchReceived.selector;
    }

    // Implement supportsInterface for ERC1155Receiver
    function supportsInterface(bytes4 interfaceId) public view override(AccessControlUpgradeable, IERC165) returns (bool) {
        return interfaceId == type(IERC1155ReceiverUpgradeable).interfaceId ||
        interfaceId == type(IERC721ReceiverUpgradeable).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    // Allow the contract to receive Ether
    receive() external payable {}
}
