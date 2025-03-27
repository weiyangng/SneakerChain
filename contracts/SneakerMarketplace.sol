// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./SneakerToken.sol";

contract SneakerMarketplace {
    SneakerToken sneakerTokenContract;
    uint256 public commissionFee;
    address _owner;
    mapping(uint256 => uint256) listPrice;

    event SneakerAdded(uint256 tokenId, address seller, uint256 price);
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

    function listSneaker(uint256 tokenId, uint256 price) public {}

    function purchaseSneaker(uint256 sneakerId) public payable virtual {}

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
