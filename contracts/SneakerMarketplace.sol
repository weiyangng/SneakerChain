// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./SneakerToken.sol";

contract SneakerMarketplace {
    SneakerToken sneakerTokenContract;
    uint256 public commissionFee;
    address public _owner;

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
        delete listings[tokenId];
    }

    function purchaseSneaker(uint256 tokenId) public payable virtual {}

    function getSneaker(
        uint256 sneakerId
    ) public view returns (string memory name, uint256 price, address owner) {}

    // function getAllSneakers()
    //     public
    //     view
    //     virtual
    //     returns (
    //         uint256[] memory ids,
    //         string[] memory names,
    //         uint256[] memory prices,
    //         address[] memory owners
    //     )
    // {
    //     uint256 length = nextSneakerId;
    //     ids = new uint256[](length);
    //     names = new string[](length);
    //     prices = new uint256[](length);
    //     owners = new address[](length);

    //     for (uint256 i = 0; i < length; i++) {
    //         Sneaker storage sneaker = sneakers[i];
    //         ids[i] = sneaker.id;
    //         names[i] = sneaker.name;
    //         prices[i] = sneaker.price;
    //         owners[i] = sneaker.owner;
    //     }

    //     return (ids, names, prices, owners);
    // }
}
