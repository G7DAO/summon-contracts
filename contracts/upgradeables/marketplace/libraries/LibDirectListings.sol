// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.11;

import {LibStorage} from "./LibStorage.sol";
import {IPlatformFee} from "../../../interfaces/IPlatformFee.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CurrencyTransferLib} from "../../../libraries/CurrencyTransferLib.sol";
import {IDirectListings} from "../../../interfaces/IMarketplace.sol";
import {RoyaltyPaymentsLogic} from "../../../ercs/extensions/RoyaltyPayments.sol";

/**
 * @author Daniel Lima <karacurt>(https://github.com/karacurt)
 */
library LibDirectListings {
    /// @dev The max bps of the contract. So, 10_000 == 100 %
    uint64 private constant MAX_BPS = 10_000;

    /// @dev Transfers tokens listed for sale in a direct or auction listing.
    function transferListingTokens(address _to, uint256 _quantity, IDirectListings.Listing memory _listing) internal {
        if (_listing.tokenType == IDirectListings.TokenType.ERC1155) {
            IERC1155(_listing.assetContract).safeTransferFrom(address(this), _to, _listing.tokenId, _quantity, "");
        } else if (_listing.tokenType == IDirectListings.TokenType.ERC721) {
            IERC721(_listing.assetContract).safeTransferFrom(address(this), _to, _listing.tokenId, "");
        }
    }

    /// @dev Pays out stakeholders in a sale.
    function payout(
        address _payer,
        address _payee,
        address _currencyToUse,
        uint256 _totalPayoutAmount,
        IDirectListings.Listing memory _listing,
        address _nativeTokenWrapper
    ) internal {
        uint256 amountRemaining;

        // Payout platform fee
        {
            (address platformFeeRecipient, uint16 platformFeeBps) = IPlatformFee(address(this)).getPlatformFeeInfo();
            uint256 platformFeeCut = (_totalPayoutAmount * platformFeeBps) / MAX_BPS;

            // Transfer platform fee
            CurrencyTransferLib.transferCurrencyWithWrapper(
                _currencyToUse,
                _payer,
                platformFeeRecipient,
                platformFeeCut,
                _nativeTokenWrapper
            );

            amountRemaining = _totalPayoutAmount - platformFeeCut;
        }

        // Payout royalties
        {
            // Get royalty recipients and amounts
            (address payable[] memory recipients, uint256[] memory amounts) = RoyaltyPaymentsLogic(address(this))
                .getRoyalty(_listing.assetContract, _listing.tokenId, _totalPayoutAmount);

            uint256 royaltyRecipientCount = recipients.length;

            if (royaltyRecipientCount != 0) {
                uint256 royaltyCut;
                address royaltyRecipient;

                for (uint256 i = 0; i < royaltyRecipientCount;) {
                    royaltyRecipient = recipients[i];
                    royaltyCut = amounts[i];

                    // Check payout amount remaining is enough to cover royalty payment
                    require(amountRemaining >= royaltyCut, "fees exceed the price");

                    // Transfer royalty
                    CurrencyTransferLib.transferCurrencyWithWrapper(
                        _currencyToUse,
                        _payer,
                        royaltyRecipient,
                        royaltyCut,
                        _nativeTokenWrapper
                    );

                    unchecked {
                        amountRemaining -= royaltyCut;
                        ++i;
                    }
                }
            }
        }

        // Distribute price to token owner
        CurrencyTransferLib.transferCurrencyWithWrapper(
            _currencyToUse,
            _payer,
            _payee,
            amountRemaining,
            _nativeTokenWrapper
        );
    }
}