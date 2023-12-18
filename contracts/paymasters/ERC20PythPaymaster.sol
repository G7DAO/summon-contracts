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

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
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
import "@openzeppelin/contracts/security/Pausable.sol";
import "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";

error AllowanceTooLow(uint256 requiredAllowance);

contract ERC20PythPaymaster is IPaymaster, Pausable, AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEV_CONFIG_ROLE = keccak256("DEV_CONFIG_ROLE");

    mapping(address => bool) public allowedRecipients;

    address public allowedERC20Token;
    bytes32 public USDCPriceId;
    bytes32 public ETHPriceId;
    uint public pythNetworkCheckAge = 1000;
    uint private PRICE_FOR_PAYING_FEES = 1;
    bool public USE_PYTH = false;

    IPyth public pyth;
    event LatestETHPriceUsed(uint price);
    event LatestUSDCPriceUsed(uint price);

    modifier onlyBootloader() {
        require(msg.sender == BOOTLOADER_FORMAL_ADDRESS, "Only bootloader can call this method");
        _;
    }

    constructor(address _erc20USDC, bytes32 _USDCPriceId, bytes32 _ETHPriceId, address _pythOracle) {
        allowedERC20Token = _erc20USDC;
        USDCPriceId = _USDCPriceId;
        ETHPriceId = _ETHPriceId;
        pyth = IPyth(_pythOracle);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(DEV_CONFIG_ROLE, msg.sender);
    }

    function setPriceFeeds(bytes32 _USDCPriceId, bytes32 _ETHPriceId) public onlyRole(DEV_CONFIG_ROLE) whenNotPaused {
        USDCPriceId = _USDCPriceId;
        ETHPriceId = _ETHPriceId;
    }

    function setUsePyth(bool _usePyth) public onlyRole(DEV_CONFIG_ROLE) whenNotPaused {
        require(_usePyth != USE_PYTH, "No change");
        USE_PYTH = _usePyth;
    }

    function setPythNetworkCheckAge(uint _pythNetworkCheckAge) public onlyRole(DEV_CONFIG_ROLE) whenNotPaused {
        require(_pythNetworkCheckAge > 0, "pythNetworkCheckAge must be greater than 0");
        require(_pythNetworkCheckAge != pythNetworkCheckAge, "No change");
        pythNetworkCheckAge = _pythNetworkCheckAge;
    }

    function updatePrice(bytes[] calldata updateData, bytes32 priceId) public whenNotPaused returns (uint) {
        uint updateFee = pyth.getUpdateFee(updateData);
        pyth.updatePriceFeeds{ value: updateFee }(updateData);
        PythStructs.Price memory currentPrice = pyth.getPrice(priceId);
        return uint(uint64(currentPrice.price));
    }

    function updateETHPrice(bytes[] calldata updateData) public payable returns (uint) {
        uint price = updatePrice(updateData, ETHPriceId);
        emit LatestETHPriceUsed(price);
        return price;
    }

    function updateUSDCPrice(bytes[] calldata updateData) public payable returns (uint) {
        uint price = updatePrice(updateData, USDCPriceId);
        emit LatestUSDCPriceUsed(price);
        return price;
    }

    function _unsafeETHPrice() public view returns (uint) {
        PythStructs.Price memory pythPrice = pyth.getPriceUnsafe(ETHPriceId);
        return uint(uint64(pythPrice.price));
    }

    function _unsafeUSDCPrice() public view returns (uint) {
        PythStructs.Price memory pythPrice = pyth.getPriceUnsafe(USDCPriceId);
        return uint(uint64(pythPrice.price));
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

            uint256 providedAllowance = IERC20(token).allowance(userAddress, address(this));
            uint256 requiredETH = _transaction.gasLimit * _transaction.maxFeePerGas;

            if (USE_PYTH) {
                uint256 ETHUSDPrice = _unsafeETHPrice();
                uint256 USDCUSDPrice = _unsafeUSDCPrice();

                // Calculate the required ERC20 tokens to be sent to the paymaster
                // (Equal to the value of requiredETH)
                uint256 requiredERC20 = (requiredETH * ETHUSDPrice) / USDCUSDPrice;

                require(providedAllowance >= requiredERC20, "Min paying allowance too low");

                // Note, that while the minimal amount of ETH needed is tx.gasPrice * tx.gasLimit,
                // neither paymaster nor account are allowed to access this context variable.
                try IERC20(token).transferFrom(userAddress, address(this), requiredERC20) {} catch (
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
                try IERC20(token).transferFrom(userAddress, address(this), amount) {} catch (
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
    }

    function withdrawERC20(address _to, uint256 _amount) external onlyRole(MANAGER_ROLE) {
        // send paymaster funds to the owner
        IERC20 token = IERC20(allowedERC20Token);
        uint256 balance = token.balanceOf(address(this));
        require(balance >= _amount, "Not enough funds");
        token.transfer(_to, _amount);
    }

    receive() external payable {}
}
