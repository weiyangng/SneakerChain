const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SneakerMarketplace", function () {
    let SneakerToken;
    let SneakerMarketplace;
    let sneakerToken;
    let marketplace;
    let owner;
    let addr1;
    let addr2;
    let commissionFee = 5; // 5% commission fee

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();

        // Deploy SneakerToken contract
        SneakerToken = await ethers.getContractFactory("SneakerToken");
        sneakerToken = await SneakerToken.deploy();
        await sneakerToken.waitForDeployment();

        // Deploy SneakerMarketplace contract
        SneakerMarketplace = await ethers.getContractFactory("SneakerMarketplace");
        marketplace = await SneakerMarketplace.deploy(sneakerToken.target, commissionFee);
        await marketplace.waitForDeployment();

        // Approve marketplace for all addresses
        await sneakerToken.setApprovalForAll(marketplace.target, true);
        await sneakerToken.connect(addr1).setApprovalForAll(marketplace.target, true);
        await sneakerToken.connect(addr2).setApprovalForAll(marketplace.target, true);
    });

    async function mintSneaker(to, amount, metadata) {
        const tx = await sneakerToken.mintSneakerToken(to, amount, metadata);
        const receipt = await tx.wait();
        const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'MintSNKT');
        return event.args[1]; // tokenId is the second argument in the event
    }

    describe("Listing Sneakers", function () {
        it("Should allow owner to list sneakers", async function () {
            // Mint a sneaker token first
            const tokenId = await mintSneaker(
                addr1.address,
                100,
                "ipfs://QmPandaDunksMetadata"
            );

            // List the sneaker
            await marketplace.connect(addr1).listSneaker(tokenId, 50, ethers.parseEther("1.0"));
            
            const listing = await marketplace.getListing(tokenId);
            expect(listing.seller).to.equal(addr1.address);
            expect(listing.price).to.equal(ethers.parseEther("1.0"));
            expect(listing.shareAmt).to.equal(50);
        });

        it("Should not allow non-owners to list sneakers", async function () {
            // Mint a sneaker token to owner
            const tokenId = await mintSneaker(
                owner.address,
                100,
                "ipfs://QmTestMetadata"
            );

            // Try to list from addr1
            await expect(
                marketplace.connect(addr1).listSneaker(tokenId, 50, ethers.parseEther("1.0"))
            ).to.be.revertedWith("Only owners can list their tokens");
        });

        it("Should not allow listing with zero price", async function () {
            const tokenId = await mintSneaker(
                owner.address,
                100,
                "ipfs://QmTestMetadata"
            );

            await expect(
                marketplace.listSneaker(tokenId, 50, 0)
            ).to.be.revertedWith("Price must be greater than 0");
        });
    });

    describe("Purchasing Sneakers", function () {
        it("Should allow purchase of listed sneakers", async function () {
            // Mint and list a sneaker
            const tokenId = await mintSneaker(
                owner.address,
                100,
                "ipfs://QmTestMetadata"
            );
            await marketplace.listSneaker(tokenId, 50, ethers.parseEther("1.0"));

            // Purchase the sneaker
            const amount = 25;
            const pricePerShare = ethers.parseEther("1.0");
            const totalPrice = pricePerShare * BigInt(amount);
            const commission = (totalPrice * BigInt(commissionFee)) / BigInt(100);
            await marketplace.connect(addr1).purchaseSneaker(tokenId, amount, {
                value: totalPrice + commission
            });

            // Check balances
            const buyerBalance = await sneakerToken.balanceOf(addr1.address, tokenId);
            expect(buyerBalance).to.equal(amount);
        });

        it("Should not allow purchase with insufficient funds", async function () {
            const tokenId = await mintSneaker(
                owner.address,
                100,
                "ipfs://QmTestMetadata"
            );
            await marketplace.listSneaker(tokenId, 50, ethers.parseEther("1.0"));

            const amount = 25;
            const pricePerShare = ethers.parseEther("1.0");
            const totalPrice = pricePerShare * BigInt(amount);
            const commission = (totalPrice * BigInt(commissionFee)) / BigInt(100);

            await expect(
                marketplace.connect(addr1).purchaseSneaker(tokenId, amount, {
                    value: totalPrice + commission - BigInt(1) // Send one wei less than required
                })
            ).to.be.revertedWith("Insufficent funds to purchase this sneaker");
        });

        it("Should handle partial purchases correctly", async function () {
            // Mint and list a sneaker with 100 shares
            const tokenId = await mintSneaker(
                owner.address,
                100,
                "ipfs://QmTestMetadata"
            );
            await marketplace.listSneaker(tokenId, 100, ethers.parseEther("1.0"));

            // First purchase: 25 shares
            const firstAmount = 25;
            const pricePerShare = ethers.parseEther("1.0");
            const firstTotalPrice = pricePerShare * BigInt(firstAmount);
            const firstCommission = (firstTotalPrice * BigInt(commissionFee)) / BigInt(100);
            await marketplace.connect(addr1).purchaseSneaker(tokenId, firstAmount, {
                value: firstTotalPrice + firstCommission
            });

            // Check first buyer's balance
            const firstBuyerBalance = await sneakerToken.balanceOf(addr1.address, tokenId);
            expect(firstBuyerBalance).to.equal(firstAmount);

            // Check remaining shares in listing
            const listingAfterFirstPurchase = await marketplace.getListing(tokenId);
            expect(listingAfterFirstPurchase.shareAmt).to.equal(75);

            // Second purchase: 50 shares
            const secondAmount = 50;
            const secondTotalPrice = pricePerShare * BigInt(secondAmount);
            const secondCommission = (secondTotalPrice * BigInt(commissionFee)) / BigInt(100);
            await marketplace.connect(addr2).purchaseSneaker(tokenId, secondAmount, {
                value: secondTotalPrice + secondCommission
            });

            // Check second buyer's balance
            const secondBuyerBalance = await sneakerToken.balanceOf(addr2.address, tokenId);
            expect(secondBuyerBalance).to.equal(secondAmount);

            // Check final remaining shares in listing
            const finalListing = await marketplace.getListing(tokenId);
            expect(finalListing.shareAmt).to.equal(25);

            // Verify the listing is still active
            expect(finalListing.price).to.equal(ethers.parseEther("1.0"));
            expect(finalListing.seller).to.equal(owner.address);
        });
    });

    describe("Bidding", function () {
        it("Should allow placing initial bid", async function () {
            const tokenId = await mintSneaker(
                owner.address,
                100,
                "ipfs://QmTestMetadata"
            );
            await marketplace.listSneaker(tokenId, 50, ethers.parseEther("1.0"));

            await marketplace.connect(addr1).placeBid(
                tokenId,
                25,
                ethers.parseEther("1.1")
            );

            const bid = await marketplace.currentBid(tokenId);
            expect(bid.bidder).to.equal(addr1.address);
            expect(bid.bidPrice).to.equal(ethers.parseEther("1.1"));
        });

        it("Should not allow bid lower than current bid", async function () {
            const tokenId = await mintSneaker(
                owner.address,
                100,
                "ipfs://QmTestMetadata"
            );
            await marketplace.listSneaker(tokenId, 50, ethers.parseEther("1.0"));
            await marketplace.connect(addr1).placeBid(
                tokenId,
                25,
                ethers.parseEther("1.1")
            );

            await expect(
                marketplace.connect(addr2).placeBid(
                    tokenId,
                    25,
                    ethers.parseEther("1.0")
                )
            ).to.be.revertedWith("Bid must be higher than current bid price");
        });
    });

    describe("Listing Management", function () {
        it("Should allow seller to unlist sneakers", async function () {
            const tokenId = await mintSneaker(
                owner.address,
                100,
                "ipfs://QmTestMetadata"
            );
            await marketplace.listSneaker(tokenId, 50, ethers.parseEther("1.0"));
            
            // Check listing exists before unlisting
            const listingBefore = await marketplace.getListing(tokenId);
            expect(listingBefore.price).to.equal(ethers.parseEther("1.0"));
            
            await marketplace.unlistSneaker(tokenId);
            
            // Verify the listing is removed from active listings
            const activeListings = await marketplace.getAllListings();
            const isStillActive = activeListings.some(listing => listing.price > 0);
            expect(isStillActive).to.be.false;
        });

        it("Should not allow non-seller to unlist sneakers", async function () {
            const tokenId = await mintSneaker(
                owner.address,
                100,
                "ipfs://QmTestMetadata"
            );
            await marketplace.listSneaker(tokenId, 50, ethers.parseEther("1.0"));
            
            await expect(
                marketplace.connect(addr1).unlistSneaker(tokenId)
            ).to.be.revertedWith("Only seller can unlist");
        });
    });
}); 