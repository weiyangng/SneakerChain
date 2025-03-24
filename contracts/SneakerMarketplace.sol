// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SneakerMarketplace {
    struct Sneaker {
        uint256 id;
        string name;
        uint256 price;
        address owner;
    }

    mapping(uint256 => Sneaker) private sneakers;
    uint256 private nextSneakerId;

    event SneakerAdded(uint256 indexed sneakerId, string name, uint256 price, address indexed owner);
    event SneakerPurchased(uint256 indexed sneakerId, address indexed buyer, address indexed seller, uint256 price);

    function addSneaker(string memory name, uint256 price) public virtual {
        sneakers[nextSneakerId] = Sneaker(nextSneakerId, name, price, msg.sender);
        emit SneakerAdded(nextSneakerId, name, price, msg.sender);
        nextSneakerId++;
    }

    function purchaseSneaker(uint256 sneakerId) public payable virtual {
        Sneaker storage sneaker = sneakers[sneakerId];
        require(sneaker.owner != address(0), "Sneaker does not exist");
        require(msg.value == sneaker.price, "Incorrect price");
        require(sneaker.owner != msg.sender, "Cannot purchase your own sneaker");

        address seller = sneaker.owner;
        sneaker.owner = msg.sender;

        payable(seller).transfer(msg.value);

        emit SneakerPurchased(sneakerId, msg.sender, seller, sneaker.price);
    }

    function getSneaker(uint256 sneakerId) public view returns (string memory name, uint256 price, address owner) {
        Sneaker storage sneaker = sneakers[sneakerId];
        require(sneaker.owner != address(0), "Sneaker does not exist");
        return (sneaker.name, sneaker.price, sneaker.owner);
    }

    function getAllSneakers() public view virtual returns (uint256[] memory ids, string[] memory names, uint256[] memory prices, address[] memory owners) {
        uint256 length = nextSneakerId;
        ids = new uint256[](length);
        names = new string[](length);
        prices = new uint256[](length);
        owners = new address[](length);

        for (uint256 i = 0; i < length; i++) {
            Sneaker storage sneaker = sneakers[i];
            ids[i] = sneaker.id;
            names[i] = sneaker.name;
            prices[i] = sneaker.price;
            owners[i] = sneaker.owner;
        }

        return (ids, names, prices, owners);
    }
}