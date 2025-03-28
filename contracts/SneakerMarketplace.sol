// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./SneakerToken.sol";

contract SneakerMarketplace {
    SneakerToken sneakerTokenContract;
    uint256 public commissionFee;
    address public _owner;
    uint256[] public activeListingIds;

    struct Listing {
        address seller;
        uint256 price;
        uint256 shareAmt;
    }
    mapping(uint256 => Listing) public listings;

    event SneakerListed(uint256 tokenId, address seller, uint256 price);
    event SneakerPurchased(
        uint256 tokenId,
        address buyer,
        address seller,
        uint256 price
    );

    constructor(SneakerToken sneakerTokenAddress, uint256 fee) {
        sneakerTokenContract = sneakerTokenAddress;
        commissionFee = fee;
        _owner = msg.sender;
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
        sneakerTokenContract.transferToMarket(address(this), tokenId, amount);
        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            shareAmt: amount
        });
        activeListingIds.push(tokenId);
        emit SneakerListed(tokenId, msg.sender, price);
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
        delete listings[tokenId];
        emit SneakerPurchased(tokenId, msg.sender, seller, totalPrice);
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
