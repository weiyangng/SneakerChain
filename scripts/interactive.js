const hre = require("hardhat");
const readlineSync = require("readline-sync");
const { listSneaker, buySneaker } = require("./sneaker");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Using deployer account:", deployer.address);

    const contractAddress = readlineSync.question("Enter the deployed contract address: ");
    const UserAuthentication = await hre.ethers.getContractFactory("UserAuthentication");
    const userAuth = UserAuthentication.attach(contractAddress);

    let loggedIn = false;

    while (true) {
        console.log("\n1. Register User");
        console.log("2. Login User");
        if (loggedIn) {
            console.log("3. Logout User");
            console.log("4. List Sneaker");
            console.log("5. Buy Sneaker");
        }
        console.log("6. Exit");

        const choice = readlineSync.question("Enter your choice: ");

        try {
            switch (choice) {
                case "1":
                    const username = readlineSync.question("Enter username: ");
                    const password = readlineSync.question("Enter password: ");
                    await userAuth.registerUser(deployer.address, username, password);
                    console.log("User registered successfully.");
                    break;
                case "2":
                    const loginUsername = readlineSync.question("Enter username: ");
                    const loginPassword = readlineSync.question("Enter password: ");
                    const loginSuccess = await userAuth.loginUser(deployer.address, loginUsername, loginPassword);
                    if (loginSuccess) {
                        loggedIn = true;
                        console.log("User logged in successfully.");
                    } else {
                        console.log("Login failed.");
                    }
                    break;
                case "3":
                    if (loggedIn) {
                        await userAuth.logoutUser(deployer.address);
                        loggedIn = false;
                        console.log("User logged out successfully.");
                    } else {
                        console.log("Invalid choice. Please try again.");
                    }
                    break;
                case "4":
                    if (loggedIn) {
                        await listSneaker(userAuth, deployer);
                    } else {
                        console.log("Invalid choice. Please try again.");
                    }
                    break;
                case "5":
                    if (loggedIn) {
                        await buySneaker(userAuth, deployer);
                    } else {
                        console.log("Invalid choice. Please try again.");
                    }
                    break;
                case "6":
                    process.exit(0);
                default:
                    console.log("Invalid choice. Please try again.");
            }
        } catch (error) {
            console.error("An error occurred:", error.message);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});