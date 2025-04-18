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

        // Set marketplace address in SneakerToken
        await sneakerToken.setMarketplace(marketplace.target);

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
        it("Should allow owner to list sneakers (non-fractional)", async function () {
            const tokenId = await mintSneaker(
                addr1.address,
                1,
                "ipfs://QmPandaDunksMetadata"
            );

            await marketplace.connect(addr1).listSneaker(tokenId, 1, ethers.parseEther("1.0"), false);
            
            const listing = await marketplace.getListing(tokenId);
            expect(listing.seller).to.equal(addr1.address);
            expect(listing.price).to.equal(ethers.parseEther("1.0"));
            expect(listing.shareAmt).to.equal(1);
            expect(listing.isFractional).to.be.false;
        });

        it("Should allow owner to list sneakers (fractional)", async function () {
            const tokenId = await mintSneaker(
                addr1.address,
                1,
                "ipfs://QmPandaDunksMetadata"
            );

            // List the sneaker as fractional - the marketplace will handle the transfer and split
            await marketplace.connect(addr1).listSneaker(tokenId, 1, ethers.parseEther("1.0"), true);
            
            const listing = await marketplace.getListing(tokenId);
            expect(listing.seller).to.equal(addr1.address);
            expect(listing.price).to.equal(ethers.parseEther("1.0"));
            expect(listing.shareAmt).to.equal(100); // Should be 100 after splitting
            expect(listing.isFractional).to.be.true;
        });

        it("Should not allow non-owners to list sneakers", async function () {
            const tokenId = await mintSneaker(
                owner.address,
                1,
                "ipfs://QmTestMetadata"
            );

            await expect(
                marketplace.connect(addr1).listSneaker(tokenId, 1, ethers.parseEther("1.0"), false)
            ).to.be.revertedWith("Only owners can list their tokens");
        });

        it("Should not allow listing with zero price", async function () {
            const tokenId = await mintSneaker(
                owner.address,
                1,
                "ipfs://QmTestMetadata"
            );

            await expect(
                marketplace.listSneaker(tokenId, 1, 0, false)
            ).to.be.revertedWith("Price must be greater than 0");
        });
    });

    describe("Purchasing Sneakers", function () {
        it("Should allow purchase of listed sneakers", async function () {
            const tokenId = await mintSneaker(
                owner.address,
                1,
                "ipfs://QmTestMetadata"
            );
            await marketplace.listSneaker(tokenId, 1, ethers.parseEther("1.0"), false);

            const totalPrice = ethers.parseEther("1.0");
            const commission = (totalPrice * BigInt(commissionFee)) / BigInt(100);
            
            await marketplace.connect(addr1).purchaseSneaker(tokenId, 1, {
                value: totalPrice + commission
            });

            const buyerBalance = await sneakerToken.balanceOf(addr1.address, tokenId);
            expect(buyerBalance).to.equal(1);
        });

        it("Should allow purchase of fractional shares", async function () {
            const tokenId = await mintSneaker(
                owner.address,
                1,
                "ipfs://QmTestMetadata"
            );

            // List the sneaker as fractional - the marketplace will handle the transfer and split
            await marketplace.listSneaker(tokenId, 1, ethers.parseEther("1.0"), true);

            const amount = 50; // Buying 50% of the shares
            const totalPrice = (ethers.parseEther("1.0") * BigInt(amount)) / BigInt(100);
            const commission = (totalPrice * BigInt(commissionFee)) / BigInt(100);
            
            await marketplace.connect(addr1).purchaseSneaker(tokenId, amount, {
                value: totalPrice + commission
            });

            const buyerBalance = await sneakerToken.balanceOf(addr1.address, tokenId);
            expect(buyerBalance).to.equal(amount);
        });

        it("Should not allow purchase with insufficient funds", async function () {
            const tokenId = await mintSneaker(
                owner.address,
                1,
                "ipfs://QmTestMetadata"
            );
            await marketplace.listSneaker(tokenId, 1, ethers.parseEther("1.0"), false);

            const totalPrice = ethers.parseEther("1.0");
            const commission = (totalPrice * BigInt(commissionFee)) / BigInt(100);

            await expect(
                marketplace.connect(addr1).purchaseSneaker(tokenId, 1, {
                    value: totalPrice + commission - BigInt(1)
                })
            ).to.be.revertedWith("Insufficient funds to purchase this sneaker");
        });
    });

    describe("Bidding", function () {
        it("Should allow placing initial bid", async function () {
            const tokenId = await mintSneaker(
                owner.address,
                1,
                "ipfs://QmTestMetadata"
            );
            await marketplace.listSneaker(tokenId, 1, ethers.parseEther("1.0"), false);

            await marketplace.connect(addr1).placeBid(
                tokenId,
                1,
                ethers.parseEther("1.1")
            );

            const bid = await marketplace.currentBid(tokenId);
            expect(bid.bidder).to.equal(addr1.address);
            expect(bid.bidPrice).to.equal(ethers.parseEther("1.1"));
        });

        it("Should not allow bid lower than current bid", async function () {
            const tokenId = await mintSneaker(
                owner.address,
                1,
                "ipfs://QmTestMetadata"
            );
            await marketplace.listSneaker(tokenId, 1, ethers.parseEther("1.0"), false);
            
            await marketplace.connect(addr1).placeBid(
                tokenId,
                1,
                ethers.parseEther("1.1")
            );

            await expect(
                marketplace.connect(addr2).placeBid(
                    tokenId,
                    1,
                    ethers.parseEther("1.0")
                )
            ).to.be.revertedWith("Bid must be higher than current bid price");
        });
    });

    describe("Finalising Bids", function () {
        it("Should allow the seller to finalize a bid", async function () {
            const tokenId = await mintSneaker(
                owner.address,
                1,
                "ipfs://QmTestMetadata"
            );
            await marketplace.listSneaker(tokenId, 1, ethers.parseEther("1.0"), false);
        
            await marketplace.connect(addr1).placeBid(
                tokenId,
                1,
                ethers.parseEther("1.2")
            );
        
            await marketplace.finaliseBid(tokenId);
        
            const bidderBalance = await sneakerToken.balanceOf(addr1.address, tokenId);
            expect(bidderBalance).to.equal(1);
        });
    
        it("Should not allow non-sellers to finalize a bid", async function () {
            const tokenId = await mintSneaker(
                owner.address,
                1,
                "ipfs://QmTestMetadata"
            );
            await marketplace.listSneaker(tokenId, 1, ethers.parseEther("1.0"), false);
    
            await marketplace.connect(addr1).placeBid(
                tokenId,
                1,
                ethers.parseEther("1.2")
            );
    
            await expect(
                marketplace.connect(addr1).finaliseBid(tokenId)
            ).to.be.revertedWith("Only the seller can finalize the bid");
        });
    });

    describe("Redeeming Sneakers", function () {
        it("Should allow owner to redeem non-fractional sneaker", async function () {
            // Mint a non-fractional sneaker token
            const tx = await sneakerToken.mintSneakerToken(owner.address, 1, "ipfs://metadata");
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'MintSNKT');
            const tokenId = event.args[1]; // tokenId is the second argument in the event
        
            // List the sneaker on the marketplace
            await marketplace.listSneaker(tokenId, 1, ethers.parseEther("1.0"), false);
        
            // Purchase the sneaker
            const totalPrice = ethers.parseEther("1.0");
            const commission = (totalPrice * BigInt(commissionFee)) / BigInt(100);
            await marketplace.connect(addr1).purchaseSneaker(tokenId, 1, {
                value: totalPrice + commission
            });
        
            // Verify the buyer has the token
            const buyerBalance = await sneakerToken.balanceOf(addr1.address, tokenId);
            expect(buyerBalance).to.equal(1);
        
            // Redeem the sneaker
            await marketplace.connect(addr1).redeemSneaker(tokenId);
            
            // Verify the token was burned
            const finalBalance = await sneakerToken.balanceOf(addr1.address, tokenId);
            expect(finalBalance).to.equal(0);
        });

        it("Should not allow redeeming fractional sneakers", async function () {
            // Mint a sneaker token
            const tx = await sneakerToken.mintSneakerToken(owner.address, 1, "ipfs://QmTestMetadata");
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'MintSNKT');
            const tokenId = event.args[1]; // tokenId is the second argument in the event

            await marketplace.listSneaker(tokenId, 1, ethers.parseEther("1.0"), true);
            
            // Purchase some shares
            const amount = 50;
            const totalPrice = (ethers.parseEther("1.0") * BigInt(amount)) / BigInt(100);
            const commission = (totalPrice * BigInt(commissionFee)) / BigInt(100);
            await marketplace.connect(addr1).purchaseSneaker(tokenId, amount, {
                value: totalPrice + commission
            });

            // Verify the buyer has the shares
            const buyerBalance = await sneakerToken.balanceOf(addr1.address, tokenId);
            expect(buyerBalance).to.equal(amount);

            await expect(
                marketplace.connect(addr1).redeemSneaker(tokenId)
            ).to.be.revertedWith("Fractional shares cannot be redeemed");
        });
    });
}); 