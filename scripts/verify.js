const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Using deployer account:", deployer.address);

    const contractAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // Replace with your deployed contract address
    const UserAuthentication = await hre.ethers.getContractFactory("UserAuthentication");
    const userAuth = UserAuthentication.attach(contractAddress);

    const [ids, names, prices, owners] = await userAuth.getAllSneakers();
    console.log("Sneaker IDs:", ids);
    console.log("Sneaker Names:", names);
    console.log("Sneaker Prices:", prices);
    console.log("Sneaker Owners:", owners);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});