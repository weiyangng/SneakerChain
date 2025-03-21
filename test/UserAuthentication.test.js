const { expect } = require("chai");

describe("UserAuthentication", function () {
    let UserAuthentication, userAuth, owner, addr1;

    beforeEach(async function () {
        UserAuthentication = await ethers.getContractFactory("UserAuthentication");
        [owner, addr1] = await ethers.getSigners();
        userAuth = await UserAuthentication.deploy();
        await userAuth.waitForDeployment();
    });

    it("Should register a new user", async function () {
        await userAuth.registerUser(owner.address, "username");
        const isRegistered = await userAuth.isRegistered(owner.address);
        expect(isRegistered).to.be.true;
    });

    it("Should not allow registering an already registered user", async function () {
        await userAuth.registerUser(owner.address, "username");
        await expect(userAuth.registerUser(owner.address, "username")).to.be.revertedWith("User already registered");
    });

    it("Should login a registered user", async function () {
        await userAuth.registerUser(owner.address, "username");
        const loginTx = await userAuth.loginUser(owner.address);
        await expect(loginTx).to.emit(userAuth, "UserLoggedIn").withArgs(owner.address);
    });

    it("Should not login an unregistered user", async function () {
        await expect(userAuth.loginUser(addr1.address)).to.be.revertedWith("User not registered");
    });

    it("Should get user profile", async function () {
        await userAuth.registerUser(owner.address, "username");
        const username = await userAuth.getUserProfile(owner.address);
        expect(username).to.equal("username");
    });
});