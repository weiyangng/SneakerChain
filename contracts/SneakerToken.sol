// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155URIStorage.sol";

contract SneakerToken is ERC1155URIStorage {
    uint256 public _tokenIds = 0;
    address public contractOwner;
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

    function mintSneakerToken(
        address to,
        uint256 amount,
        string memory metadataURI
    ) public onlyOwner returns (uint256) {
        uint256 newTokenId = _tokenIds++;
        _mint(to, newTokenId, amount, "");
        _setURI(newTokenId, metadataURI);
        maxShares[newTokenId] = amount;
        sneakerOwners[newTokenId].push(to);
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
        emit TransferSNKT(msg.sender, to, tokenId, amount);
    }

    function transferToMarket(
        address to,
        uint256 tokenId,
        uint256 amount
    ) public sneakerOwner(tokenId) validToken(tokenId) {
        require(
            balanceOf(msg.sender, tokenId) >= amount,
            "Insufficient balance to transfer to market"
        );
        safeTransferFrom(msg.sender, to, tokenId, amount, "");
    }

    function burnSneakerToken(
        uint256 tokenId,
        uint256 amount
    ) public sneakerOwner(tokenId) validToken(tokenId) {
        require(
            balanceOf(msg.sender, tokenId) >= amount,
            "Insufficient amount to burn"
        );
        _burn(msg.sender, tokenId, amount);
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
}
