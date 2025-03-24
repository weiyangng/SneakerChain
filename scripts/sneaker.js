const readlineSync = require("readline-sync");

async function listSneaker(userAuth, deployer) {
    const sneakerName = readlineSync.question("Enter sneaker name: ");
    const sneakerPrice = readlineSync.question("Enter sneaker price (in wei): ");
    await userAuth.addSneaker(sneakerName, sneakerPrice);
    console.log("Sneaker added successfully.");
}

async function buySneaker(userAuth, deployer) {
    const [ids, names, prices, owners] = await userAuth.getAllSneakers();
    console.log("Available Sneakers:");
    for (let i = 0; i < ids.length; i++) {
        console.log(`${i + 1}. ${names[i]} - ${prices[i]} wei`);
    }

    const sneakerIndex = readlineSync.question("Enter the number of the sneaker you want to buy: ");
    const sneakerId = ids[sneakerIndex - 1];
    const sneakerPrice = prices[sneakerIndex - 1];
    await userAuth.purchaseSneaker(sneakerId, { value: sneakerPrice });
    console.log("Sneaker purchased successfully.");
}

module.exports = {
    listSneaker,
    buySneaker
};