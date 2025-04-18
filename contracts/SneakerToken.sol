// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155URIStorage.sol";

contract SneakerToken is ERC1155URIStorage {
    uint256 public _tokenIds = 0;
    address public contractOwner;

    mapping(uint256 => address[]) public sneakerOwners;
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
        _tokenIds++;
        uint256 newTokenId = _tokenIds;
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
        address[] storage owners = sneakerOwners[tokenId];
        bool alreadyOwns = false;
        for (uint i = 0; i < owners.length; i++) {
            if (owners[i] == to) {
                alreadyOwns = true;
            }
        }
        if (!alreadyOwns) {
            owners.push(to);
        }
        sneakerOwners[tokenId].push(to);
        if (balanceOf(msg.sender, tokenId) == 0) {
            uint256 len = owners.length;
            for (uint256 i = 0; i < len; i++) {
                if (owners[i] == msg.sender) {
                    // 2) Swap with last element (if not already last)
                    if (i != len - 1) {
                        owners[i] = owners[len - 1];
                    }
                    // 3) Pop the last element
                    owners.pop();
                    break;
                }
            }
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
    }

    function burnSneakerToken(
        uint256 tokenId,
        uint256 amount
    ) public sneakerOwner(tokenId) validToken(tokenId) {
        _burn(msg.sender, tokenId, amount);
        delete (sneakerOwners[tokenId]);
        delete (maxShares[tokenId]);
        emit BurnSNKT(msg.sender, tokenId, amount);
    }

    function isOwnerOfSneaker(
        uint256 tokenId,
        address account
    ) public view validToken(tokenId) returns (bool) {
        address[] storage owners = sneakerOwners[tokenId];
        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == account) {
                return true;
            }
        }
        return false;
    }

    function isSoleOwner(
        uint256 tokenId,
        address account
    ) public view validToken(tokenId) returns (bool) {
        if (
            sneakerOwners[tokenId].length == 1 &&
            sneakerOwners[tokenId][0] == account
        ) {
            return true;
        } else {
            return false;
        }
    }

    function getMaxShares(
        uint256 tokenId
    ) public view validToken(tokenId) returns (uint256) {
        return maxShares[tokenId];
    }

    function getSneakerMetadata(
        uint256 tokenId
    ) public view validToken(tokenId) returns (string memory) {
        return uri(tokenId);
    }
}
