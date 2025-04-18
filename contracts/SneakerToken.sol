// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155URIStorage.sol";

contract SneakerToken is ERC1155URIStorage {
    uint256 public _tokenIds = 0;
    address public contractOwner;
    address public marketplace;
    mapping(uint256 => address[]) public sneakerOwners;
    mapping(uint256 => mapping(address => bool)) private isSneakerOwner;
    mapping(uint256 => uint256) public maxShares;

    event MintSNKT(
        address to,
        uint256 tokenId,
        uint256 amount,
        string metadataURI
    );
    event TransferSNKT(
        address from,
        address to,
        uint256 tokenId,
        uint256 amount
    );
    event BurnSNKT(address owner, uint256 tokenId, uint256 amount);

    constructor() ERC1155("") {
        contractOwner = msg.sender;
    }

    modifier onlyOwner() {
        require(
            msg.sender == contractOwner,
            "Caller is not the owner of the contract"
        );
        _;
    }

    modifier sneakerOwner(uint256 tokenId) {
        require(
            balanceOf(msg.sender, tokenId) > 0,
            "Caller does not own this sneaker"
        );
        _;
    }

    modifier validToken(uint256 tokenId) {
        require(
            tokenId != 0 && tokenId <= _tokenIds,
            "This is not a valid token"
        );
        _;
    }

    function setMarketplace(address _marketplace) public onlyOwner {
        marketplace = _marketplace;
    }

    function mintSneakerToken(
        address to,
        uint256 amount,
        string memory metadataURI
    ) public onlyOwner returns (uint256) {
        _tokenIds++;
        uint256 newTokenId = _tokenIds;
        _mint(to, newTokenId, amount, "");
        _setURI(newTokenId, metadataURI);
        maxShares[newTokenId] = amount;
        sneakerOwners[newTokenId].push(to);
        isSneakerOwner[newTokenId][to] = true;
        emit MintSNKT(to, newTokenId, amount, metadataURI);
        return newTokenId;
    }

    function transferSneakerToken(
        address to,
        uint256 tokenId,
        uint256 amount
    ) public sneakerOwner(tokenId) validToken(tokenId) {
        require(
            balanceOf(msg.sender, tokenId) >= amount,
            "Insufficent balance to sell"
        );
        safeTransferFrom(msg.sender, to, tokenId, amount, "");
        if (!isSneakerOwner[tokenId][to]) {
            sneakerOwners[tokenId].push(to);
            isSneakerOwner[tokenId][to] = true;
        }
        if (balanceOf(msg.sender, tokenId) == 0) {
            isSneakerOwner[tokenId][msg.sender] = false;
        }
        emit TransferSNKT(msg.sender, to, tokenId, amount);
    }

    function transferToMarket(
        address to,
        uint256 tokenId,
        uint256 amount,
        address originalOwner
    ) public {
        require(
            balanceOf(originalOwner, tokenId) >= amount,
            "Insufficient balance to transfer to market"
        );
        safeTransferFrom(originalOwner, to, tokenId, amount, "");
        if (!isSneakerOwner[tokenId][to]) {
            sneakerOwners[tokenId].push(to);
            isSneakerOwner[tokenId][to] = true;
        }
        if (balanceOf(originalOwner, tokenId) == 0) {
            isSneakerOwner[tokenId][originalOwner] = false;
        }
    }

    function burnSneakerToken(
        uint256 tokenId,
        uint256 amount
    ) public validToken(tokenId) {
        // Allow marketplace to burn tokens on behalf of owners
        if (msg.sender != marketplace) {
            require(
                balanceOf(msg.sender, tokenId) > 0,
                "Caller does not own this sneaker"
            );
            _burn(msg.sender, tokenId, amount);
        } else {
            // For marketplace, we need to check the balance of the original owner
            address owner = sneakerOwners[tokenId][0]; // Get the first owner
            
            // To print out these values, you can use the `emit` keyword to log events, as Solidity does not support console.log directly.
            emit BurnSNKT(owner, tokenId, balanceOf(owner, tokenId));
            emit BurnSNKT(owner, tokenId, amount);
            require(
                balanceOf(owner, tokenId) >= amount,
                "Insufficient amount to burn"
            );
            _burn(owner, tokenId, amount);
        }
        emit BurnSNKT(msg.sender, tokenId, amount);
    }

    function isOwnerOfSneaker(
        uint256 tokenId,
        address _address
    ) public view validToken(tokenId) returns (bool) {
        return isSneakerOwner[tokenId][_address];
    }

    function getSneakerMetadata(
        uint256 tokenId
    ) public view validToken(tokenId) returns (string memory) {
        return uri(tokenId);
    }

    function splitSneakerToken(
    uint256 tokenId,
    uint256 shares,
    address owner
    ) public validToken(tokenId) sneakerOwner(tokenId) {
        require(shares > 1, "Shares must be greater than 1");
        require(
            balanceOf(owner, tokenId) == 1,
            "Only a single token can be split into shares"
        );

        // Burn the original token
        _burn(owner, tokenId, 1);

        // Mint fractional shares
        _mint(owner, tokenId, shares, "");

        // Update the maxShares mapping to reflect the new share count
        maxShares[tokenId] = shares;

        emit MintSNKT(owner, tokenId, shares, uri(tokenId));
    }
}
