// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

// MMMMNkc. .,oKWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
// MWXd,.      .cONMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
// Wx'           .cKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
// x.              ;KMMMMMMMMMMMMWKxlcclxKWMMMMMMMMWKxlc::::::::ckWMMXd:cOMMMMMMMMKo:oKMMWkccxWMWKdccccccccccccoKMM0l:l0MMMMMMMMMWkc:dXMMMXkoc::::::clxKW
// '                lNMMMMMMMMMMNd.  ..  .dNMMMMMMNd.  ..........oWMM0'  oWMMMMMMMk. .kMMN:  :XMNl   .''''''''';OMMX:  ,0MMMMMMMWk.  oNMWk'  ........  .o
// .                :XMMMMMMMMMWd. .o00l. .dWMMMMWx. .o0KKXKKXXXXNMMM0'  oNWWWWWWWk. .kMMN:  :NMNc  .kNNNNNNNNNNWMMM0,  :XMMMMMM0,  cXMMO.  c0KKKKXK0o.
// , .lkxo.  ;dkx,  oWMMMMMMMMWk.  oNMMNo. .kWMMMWl  ;KMMMMMMMMMMMMMM0'  .',',,,,,.  .kMMN:  :NMNc   ,:;;;;;;dXMMMMMMO.  lNMMMMK:  ;KMMMd. .OMMMMMMMMX;
// :  :KWX: .xMWx. .kMMMMMMMMM0'  cXMMMMXc  ,0MMMWl  ;KMMMMMMMMMMMMMM0'  .',,'',,,.  .kMMN:  :NMNc   ',,;;,;;oXMMMMMMWx. .dWMMNc  'OMMMMd. .OMMMMMMMMX;
// l   ,0WO:oXWd.  .OMMMMMMMMK;  ;KMMMMMMK;  :KMMWd. .o0KKXXKKKXXNMMM0'  oNWWWWWWWx. .kMMN:  :XMNc  .kNNNNNNNNWWWMMMMMNo. .dK0l. .xWMMMMO. .c0KKKXXK0o.
// o    dWMWWMK,   '0MMMMMMMXc  'OMMMMMMMMO'  cNMMNd.  ..........oWMM0'  oWMMMMMMMk. .kMMN:  :XMNl   .,,,,,,,,,:0MMMMMMNo.  ..  'xWMMMMMWx'   .......  .o
// O'   :XMMMMk.   cXMMMMMMMKo:cOWMMMMMMMMWOc:oKMMMWKxlc::::::::ckWMMXd:cOMMMMMMMMKo:oKMMWkc:xWMWKoc:::::::::::lKMMMMMMMWKdlcclxXWMMMMMMMMXkoc::::::clxKW
// WO;  'OMMMWl  .oXMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
// MMNx'.dWMMK;.:0WMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
// MMMM0cdNMM0cdNMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM

import {
    ExecutionResult,
    PAYMASTER_VALIDATION_SUCCESS_MAGIC,
    IPaymaster
} from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymaster.sol";
import { IPaymasterFlow } from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymasterFlow.sol";
import {
    TransactionHelper,
    Transaction
} from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";
import "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";
import { AggregatorV3Interface } from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "../interfaces/IERC20Decimals.sol";

error AllowanceTooLow(uint256 requiredAllowance);

contract ERC20ChainlinkPaymaster is IPaymaster, Pausable, AccessControl {
    AggregatorV3Interface internal erc20DataFeed;
    AggregatorV3Interface internal ethDataFeed;
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEV_CONFIG_ROLE = keccak256("DEV_CONFIG_ROLE");

    mapping(address => bool) public allowedRecipients;

    address public allowedERC20Token;
    uint8 public tokenDecimals;
    address public ERC20FeedId;
    address public ETHFeedId;
    uint public PRICE_FOR_PAYING_FEES;
    bool public USE_CHAINLINK;

    event LatestETHPriceUsed(uint price);
    event LatestUSDCPriceUsed(uint price);

    modifier onlyBootloader() {
        require(msg.sender == BOOTLOADER_FORMAL_ADDRESS, "Only bootloader can call this method");
        _;
    }

    constructor(address _erc20Token, address _ERC20FeedId, address _ETHFeedId, uint _fixedPrice, bool _useChainlink) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(DEV_CONFIG_ROLE, msg.sender);
        allowedERC20Token = _erc20Token;
        ERC20FeedId = _ERC20FeedId;
        ETHFeedId = _ETHFeedId;
        erc20DataFeed = AggregatorV3Interface(_ERC20FeedId);
        ethDataFeed = AggregatorV3Interface(_ETHFeedId);
        PRICE_FOR_PAYING_FEES = _fixedPrice;
        USE_CHAINLINK = _useChainlink;
        tokenDecimals = IERC20Decimals(_erc20Token).decimals();
    }

    function getChainlinkERC20DataFeedLatestAnswer() public view returns (int) {
        // prettier-ignore
        (
            /* uint80 roundID */,
            int answer,
            /*uint startedAt*/,
            /*uint timeStamp*/,
            /*uint80 answeredInRound*/
        ) = erc20DataFeed.latestRoundData();
        return answer;
    }

    function getChainlinkETHDataFeedLatestAnswer() public view returns (int) {
        // prettier-ignore
        (
            /* uint80 roundID */,
            int answer,
            /*uint startedAt*/,
            /*uint timeStamp*/,
            /*uint80 answeredInRound*/
        ) = ethDataFeed.latestRoundData();
        return answer;
    }

    function validateAndPayForPaymasterTransaction(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    ) external payable onlyBootloader whenNotPaused returns (bytes4 magic, bytes memory context) {
        // check the target and function of the transaction: _transaction

        address recipient = address(uint160(_transaction.to));

        require(allowedRecipients[recipient], "Invalid recipient");

        // By default we consider the transaction as accepted.
        magic = PAYMASTER_VALIDATION_SUCCESS_MAGIC;
        require(_transaction.paymasterInput.length >= 4, "The standard paymaster input must be at least 4 bytes long");

        bytes4 paymasterInputSelector = bytes4(_transaction.paymasterInput[0:4]);

        if (paymasterInputSelector == IPaymasterFlow.approvalBased.selector) {
            // While the transaction data consists of address, uint256 and bytes data,
            // the data is not needed for this paymaster
            (address token, uint256 amount, bytes memory data) = abi.decode(
                _transaction.paymasterInput[4:],
                (address, uint256, bytes)
            );

            // Verify if token is the correct one
            require(token == allowedERC20Token, "Invalid token");

            // We verify that the user has provided enough allowance
            address userAddress = address(uint160(_transaction.from));

            uint256 providedAllowance = IERC20Decimals(token).allowance(userAddress, address(this));
            // Gas cost in wei (18 decimals)
            uint256 requiredETH = _transaction.gasLimit * _transaction.maxFeePerGas;

            if (USE_CHAINLINK) {
                uint256 ETHUSDPrice = uint256(getChainlinkETHDataFeedLatestAnswer());
                uint256 ERC20USDPrice = uint256(getChainlinkERC20DataFeedLatestAnswer());

                ETHUSDPrice = ETHUSDPrice * 1e10;
                ERC20USDPrice = ERC20USDPrice * 1e10;

                // Calculate the required ERC20 tokens to be sent to the paymaster
                // (Equal to the value of requiredETH)
                uint256 requiredERC20 = (requiredETH * ETHUSDPrice / ERC20USDPrice) / 1e12;

                // Convert from wei (18 decimals) to the ERC20 token's decimals
                uint256 decimalFactor = 18 - uint256(tokenDecimals);

                // Adjust for token decimals
                requiredERC20 = requiredERC20 / (10**decimalFactor);

                require(providedAllowance >= requiredERC20, "Min paying allowance too low");

                // Note, that while the minimal amount of ETH needed is tx.gasPrice * tx.gasLimit,
                // neither paymaster nor account are allowed to access this context variable.
                try IERC20Decimals(token).transferFrom(userAddress, address(this), requiredERC20) {} catch (
                    bytes memory revertReason
                ) {
                    if (requiredERC20 > amount) {
                        revert("Not the required amount of tokens sent");
                    }
                    if (revertReason.length <= 4) {
                        revert("Failed to transferFrom from users' account");
                    } else {
                        assembly {
                            revert(add(0x20, revertReason), mload(revertReason))
                        }
                    }
                }
            } else {
                require(providedAllowance >= PRICE_FOR_PAYING_FEES, "Min paying allowance too low");

                // Note, that while the minimal amount of ETH needed is tx.gasPrice * tx.gasLimit,
                // neither paymaster nor account are allowed to access this context variable.
                try IERC20Decimals(token).transferFrom(userAddress, address(this), amount) {} catch (
                    bytes memory revertReason
                ) {
                    if (revertReason.length <= 4) {
                        revert("Failed to transferFrom from users' account");
                    } else {
                        assembly {
                            revert(add(0x20, revertReason), mload(revertReason))
                        }
                    }
                }
            }

            // The bootloader never returns any data, so it can safely be ignored here.
            (bool success, ) = payable(BOOTLOADER_FORMAL_ADDRESS).call{ value: requiredETH }("");

            require(success, "Failed to transfer funds to the bootloader");
        } else {
            revert("Unsupported paymaster flow");
        }
    }

    function postTransaction(
        bytes calldata _context,
        Transaction calldata _transaction,
        bytes32,
        bytes32,
        ExecutionResult _txResult,
        uint256 _maxRefundedGas
    ) external payable onlyBootloader whenNotPaused {
        // Refunds are not supported yet.
    }

    function pause() public onlyRole(MANAGER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(MANAGER_ROLE) {
        _unpause();
    }

    function setPriceFeeds(address _ERC20FeedId, address _ETHFeedId) public onlyRole(DEV_CONFIG_ROLE) whenNotPaused {
        ERC20FeedId = _ERC20FeedId;
        ETHFeedId = _ETHFeedId;
        erc20DataFeed = AggregatorV3Interface(_ERC20FeedId);
        ethDataFeed = AggregatorV3Interface(_ETHFeedId);
    }

    function addRecipient(address _recipient) public onlyRole(DEV_CONFIG_ROLE) {
        require(_recipient != address(0), "NonAddressZero");
        allowedRecipients[_recipient] = true;
    }

    function removeRecipient(address _recipient) public onlyRole(DEV_CONFIG_ROLE) {
        require(_recipient != address(0), "NonAddressZero");
        allowedRecipients[_recipient] = false;
    }

    function withdrawETH(address payable _to) external onlyRole(MANAGER_ROLE) {
        // send paymaster funds to the owner
        uint256 balance = address(this).balance;
        (bool success, ) = _to.call{ value: balance }("");
        require(success, "Failed to withdraw funds from paymaster.");
    }

    function updateErc20Allowed(address _erc20USDC) external onlyRole(DEV_CONFIG_ROLE) {
        allowedERC20Token = _erc20USDC;
        tokenDecimals = IERC20Decimals(_erc20USDC).decimals();
    }

    function setUseChainLink(bool _useChainlink) external onlyRole(DEV_CONFIG_ROLE) {
        require(_useChainlink != USE_CHAINLINK, "Already set");
        USE_CHAINLINK = _useChainlink;
    }

    function withdrawERC20(address _to, uint256 _amount) external onlyRole(MANAGER_ROLE) {
        // send paymaster funds to the owner
        IERC20Decimals token = IERC20Decimals(allowedERC20Token);
        uint256 balance = token.balanceOf(address(this));
        require(balance >= _amount, "Not enough funds");
        token.transfer(_to, _amount);
    }

    receive() external payable {}
}
