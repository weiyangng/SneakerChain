// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./SneakerToken.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "hardhat/console.sol";

contract SneakerMarketplace is IERC1155Receiver {
    SneakerToken sneakerTokenContract;
    uint256 public commissionFee;
    address public _owner;
    uint256[] public activeListingIds;

    struct Listing {
        address seller;
        uint256 price;
        uint256 shareAmt;
        bool bidProcess;
        uint256 bidEndTime;
        bool isFractional;
    }

    struct Bid {
        address bidder;
        uint256 bidAmount;
        uint256 bidPrice;
        uint256 timestamp;
    }

    mapping(uint256 => Listing) public listings;
    mapping(uint256 => Bid) public currentBid;
    mapping(uint256 => bool) public isBiddingActive;
    mapping(uint256 => uint256) public bidEndTime;
    mapping(uint256 => Bid[]) public bids;

    event SneakerListed(
        uint256 tokenId,
        address seller,
        uint256 amount,
        uint256 price
    );
    event SneakerPurchased(
        uint256 tokenId,
        address buyer,
        address seller,
        uint256 amount,
        uint256 price
    );
    event InitialBidSubmitted(
        uint256 tokenId,
        address bidder,
        uint256 bidAmount,
        uint256 bidPrice
    );
    event BidAccepted(
        uint256 tokenId,
        address bidder,
        uint256 bidAmount,
        uint256 bidPrice,
        uint256 expiry
    );
    event BidPlaced(
        uint256 tokenId,
        address newBidder,
        uint256 bidAmount,
        uint256 newBidPrice
    );
    event BidSucceeded(
        uint256 tokenId,
        address winningBidder,
        uint256 amount,
        uint256 finalBidPrice
    );

    event SneakerRedeemed(
        uint256 tokenId, 
        address redeemer
    );

    constructor(SneakerToken sneakerTokenAddress, uint256 fee) {
        sneakerTokenContract = sneakerTokenAddress;
        commissionFee = fee;
        _owner = msg.sender;
    }

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external pure returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId;
    }

    function listSneaker(
        uint256 tokenId,
        uint256 amount,
        uint256 price,
        bool isFractional
    ) public {
        require(price > 0, "Price must be greater than 0");
        require(amount > 0, "Must list at least one share");
        require(
            sneakerTokenContract.isOwnerOfSneaker(tokenId, msg.sender),
            "Only owners can list their tokens"
        );

        if (isFractional) {
            require(amount == 1, "Only one token can be split into shares");
            // First transfer the token to the marketplace
            sneakerTokenContract.transferToMarket(address(this), tokenId, amount, msg.sender);
            // Then split it into 100 shares
            sneakerTokenContract.splitSneakerToken(tokenId, 100, address(this));
            amount = 100; // Update amount to reflect the fractional shares
        } else {
            require(amount == 1, "Only one token can be listed as non-fractional");
            // Transfer sneaker to the marketplace
            sneakerTokenContract.transferToMarket(address(this), tokenId, amount, msg.sender);
        }

        // Create the listing
        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            shareAmt: amount,
            bidProcess: false,
            bidEndTime: 0,
            isFractional: isFractional
        });

        activeListingIds.push(tokenId);

        emit SneakerListed(tokenId, msg.sender, amount, price);
    }

    function unlistSneaker(uint256 tokenId) public {
        Listing memory listing = listings[tokenId];
        require(listing.seller == msg.sender, "Only seller can unlist");
        require(listing.price > 0, "This listing does not exist");
        sneakerTokenContract.transferSneakerToken(
            listing.seller,
            tokenId,
            listing.shareAmt
        );
        for (uint256 i = 0; i < activeListingIds.length; i++) {
            if (activeListingIds[i] == tokenId) {
                activeListingIds[i] = activeListingIds[
                    activeListingIds.length - 1
                ];
                activeListingIds.pop();
                break;
            }
        }
        delete listings[tokenId];
    }

    function purchaseSneaker(uint256 tokenId, uint256 amount) public payable {
        Listing memory listing = listings[tokenId];
        uint256 totalPrice;

        require(listing.price > 0, "This listing does not exist");
        require(amount <= listing.shareAmt, "Insufficient sneaker shares remaining");

        // Calculate total price based on whether it's fractional or not
        if (listing.isFractional) {
            // For fractional shares, price is per 100 shares, so we need to calculate the portion
            totalPrice = (listing.price * amount) / 100;
        } else {
            totalPrice = listing.price * amount;
        }

        require(
            msg.value >= totalPrice + ((totalPrice * commissionFee) / 100),
            "Insufficient funds to purchase this sneaker"
        );

        address payable seller = payable(listing.seller);
        seller.transfer(totalPrice);

        // Transfer shares to the buyer
        sneakerTokenContract.transferSneakerToken(msg.sender, tokenId, amount);

        // Update or remove the listing
        if (amount < listing.shareAmt) {
            listings[tokenId].shareAmt -= amount;
        } else {
            for (uint256 i = 0; i < activeListingIds.length; i++) {
                if (activeListingIds[i] == tokenId) {
                    activeListingIds[i] = activeListingIds[activeListingIds.length - 1];
                    activeListingIds.pop();
                    break;
                }
            }
            delete listings[tokenId];
        }

        emit SneakerPurchased(tokenId, msg.sender, seller, amount, totalPrice);
    }

    //  Solidity does not support time based functions so this is only a simulation of how the function would work
    function placeBid(uint256 tokenId, uint256 amount, uint256 price) public payable {
        Listing memory listing = listings[tokenId];
        require(listing.price > 0, "This listing does not exist");
        require(
            price > currentBid[tokenId].bidPrice,
            "Bid must be higher than current bid price"
        );
        
        // Store the current bid
        uint256 previousBidPrice = currentBid[tokenId].bidPrice;

        currentBid[tokenId] = Bid(
            msg.sender,
            amount,
            price,
            block.timestamp
        );

        if (previousBidPrice == 0) {
            emit InitialBidSubmitted(tokenId, msg.sender, amount, price);
        } else {
            emit BidPlaced(tokenId, msg.sender, amount, price);
        }
    }

    function checkValue(uint256 tokenId) public view returns (uint256) {
        Listing memory listing = listings[tokenId];
        require(listing.price > 0, "This listing does not exist");
        return listing.price;
    }

    function checkAvailableShareAmount(
        uint256 tokenId
    ) public view returns (uint256) {
        Listing memory listing = listings[tokenId];
        require(listing.price > 0, "This listing does not exist");
        return listing.shareAmt;
    }

    function getListing(uint256 tokenId) public view returns (Listing memory) {
        Listing memory listing = listings[tokenId];
        require(listing.price > 0, "This listing does not exist");
        return listing;
    }

    function getAllListings() public view returns (Listing[] memory) {
        Listing[] memory result = new Listing[](activeListingIds.length);
        for (uint256 i = 0; i < activeListingIds.length; i++) {
            uint256 tokenId = activeListingIds[i];
            result[i] = listings[tokenId];
        }
        return result;
    }

    function finaliseBid(uint256 tokenId) public {
    Listing memory listing = listings[tokenId];
    Bid memory winningBid = currentBid[tokenId];

    require(listing.price > 0, "This listing does not exist");
    require(listing.seller == msg.sender, "Only the seller can finalize the bid");
    require(winningBid.bidPrice > 0, "No active bid to finalize");

    // Transfer sneaker shares to the winning bidder first
    sneakerTokenContract.transferSneakerToken(
        winningBid.bidder,
        tokenId,
        winningBid.bidAmount
    );

    // Update the listing or remove it if all shares are sold
    if (winningBid.bidAmount < listing.shareAmt) {
        listings[tokenId].shareAmt -= winningBid.bidAmount;
    } else {
        // Remove the listing from active listings
        for (uint256 i = 0; i < activeListingIds.length; i++) {
            if (activeListingIds[i] == tokenId) {
                activeListingIds[i] = activeListingIds[activeListingIds.length - 1];
                activeListingIds.pop();
                break;
            }
        }
        delete listings[tokenId];
    }

    // Clear the current bid
    delete currentBid[tokenId];

    emit BidSucceeded(
        tokenId,
        winningBid.bidder,
        winningBid.bidAmount,
        winningBid.bidPrice
    );
}

function redeemSneaker(uint256 tokenId) public {
    Listing memory listing = listings[tokenId];
    require(!listing.isFractional, "Fractional shares cannot be redeemed");
    
    // Check if the caller has a balance of the token
    uint256 balance = sneakerTokenContract.balanceOf(msg.sender, tokenId);
    require(balance == 1, "You must own exactly 1 token to redeem the sneaker");

    // Burn the token to redeem the physical sneaker
    sneakerTokenContract.burnSneakerToken(tokenId, 1);

    emit SneakerRedeemed(tokenId, msg.sender);
}

function getHighestBid(uint256 tokenId) public view returns (Bid memory highest) {
    Bid[] memory tokenBids = bids[tokenId];
    require(tokenBids.length > 0, "No bids for this token");

    highest = tokenBids[0];
    for (uint256 i = 1; i < tokenBids.length; i++) {
        if (tokenBids[i].bidPrice > highest.bidPrice) {
            highest = tokenBids[i];
        }
    }
}
}
