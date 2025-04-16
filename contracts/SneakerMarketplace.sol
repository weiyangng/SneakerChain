// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./SneakerToken.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

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
        uint256 price
    ) public {
        require(price > 0, "Price must be greater than 0");
        require(amount > 0, "Must list at least one share");
        require(
            sneakerTokenContract.isOwnerOfSneaker(tokenId, msg.sender),
            "Only owners can list their tokens"
        );
        sneakerTokenContract.transferToMarket(address(this), tokenId, amount, msg.sender);
        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            shareAmt: amount,
            bidProcess: false,
            bidEndTime: 0
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
        uint256 totalPrice = listing.price * amount;
        require(listing.price > 0, "This listing does not exist");
        require(
            amount <= listing.shareAmt,
            "Insufficent sneaker shares remaining"
        );
        require(
            msg.value >= totalPrice + ((totalPrice * commissionFee) / 100),
            "Insufficent funds to purchase this sneaker"
        );
        address payable seller = payable(listing.seller);
        seller.transfer(totalPrice);
        sneakerTokenContract.transferSneakerToken(msg.sender, tokenId, amount);
        if (amount < listing.shareAmt) {
            listings[tokenId].shareAmt -= amount;
        } else {
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
        emit SneakerPurchased(tokenId, msg.sender, seller, amount, totalPrice);
    }

    //  need to implement 3 minute rule for last minute bids
    function placeBid(uint256 tokenId, uint256 amount, uint256 price) public {
        Listing memory listing = listings[tokenId];
        require(listing.price > 0, "This listing does not exist");
        require(
            price > currentBid[tokenId].bidPrice,
            "Bid must be higher than current bid price"
        );
        
        // Store the current bid
        currentBid[tokenId] = Bid(
            msg.sender,
            amount,
            price,
            block.timestamp
        );

        // Emit appropriate event based on whether this is the first bid
        if (currentBid[tokenId].bidPrice == price) {
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
}
