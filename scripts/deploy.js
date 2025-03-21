async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const UserAuthentication = await ethers.getContractFactory("UserAuthentication");
    const userAuth = await UserAuthentication.deploy();
    await userAuth.waitForDeployment();

    console.log("UserAuthentication deployed to:", await userAuth.getAddress());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });