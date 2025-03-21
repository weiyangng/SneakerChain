const readlineSync = require("readline-sync");

async function listSneaker(userAuth, deployer) {
    const sneakerName = readlineSync.question("Enter sneaker name: ");
    const sneakerPrice = readlineSync.question("Enter sneaker price (in wei): ");
    await userAuth.addSneaker(sneakerName, sneakerPrice);
    console.log("Sneaker added successfully.");
}

async function buySneaker(userAuth, deployer) {
    const sneakers = await userAuth.getAllSneakers();
    console.log("Available Sneakers:");
    sneakers.forEach((sneaker, index) => {
        console.log(`${index + 1}. ${sneaker.name} - ${sneaker.price} wei`);
    });

    const sneakerIndex = readlineSync.question("Enter the number of the sneaker you want to buy: ");
    const sneaker = sneakers[sneakerIndex - 1];
    await userAuth.purchaseSneaker(sneaker.id, { value: sneaker.price });
    console.log("Sneaker purchased successfully.");
}

module.exports = {
    listSneaker,
    buySneaker
};