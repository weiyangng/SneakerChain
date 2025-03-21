// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./SneakerMarketplace.sol";

contract UserAuthentication is SneakerMarketplace {
    struct User {
        string username;
        string password;
        bool isRegistered;
    }

    mapping(address => User) private users;
    mapping(address => bool) private loggedInUsers;

    event UserRegistered(address indexed user, string username);
    event UserLoggedIn(address indexed user);
    event UserLoggedOut(address indexed user);

    function registerUser(address user, string memory username, string memory password) public {
        require(!users[user].isRegistered, "User already registered");
        users[user] = User(username, password, true);
        emit UserRegistered(user, username);
    }

    function loginUser(address user, string memory username, string memory password) public returns (bool) {
        require(users[user].isRegistered, "User not registered");
        require(keccak256(abi.encodePacked(users[user].username)) == keccak256(abi.encodePacked(username)), "Invalid username");
        require(keccak256(abi.encodePacked(users[user].password)) == keccak256(abi.encodePacked(password)), "Invalid password");
        loggedInUsers[user] = true;
        emit UserLoggedIn(user);
        return true;
    }

    function logoutUser(address user) public {
        require(users[user].isRegistered, "User not registered");
        require(loggedInUsers[user], "User not logged in");
        loggedInUsers[user] = false;
        emit UserLoggedOut(user);
    }

    function isRegistered(address user) public view returns (bool) {
        return users[user].isRegistered;
    }

    function getUserProfile(address user) public view returns (string memory username) {
        require(users[user].isRegistered, "User not registered");
        return users[user].username;
    }

    function addSneaker(string memory name, uint256 price) public override {
        require(loggedInUsers[msg.sender], "User not logged in");
        super.addSneaker(name, price);
    }

    function purchaseSneaker(uint256 sneakerId) public payable override {
        require(loggedInUsers[msg.sender], "User not logged in");
        super.purchaseSneaker(sneakerId);
    }
}