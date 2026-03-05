const express = require("express");
const router = express.Router();
const verifyToken = require("../auth/verifyToken"); // JWT auth
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const uri = process.env.DB_URI;
const client = new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1 } });
const dbName = "electronicsDB";
let collection;

async function initCollection() {
    if (!collection) {
        await client.connect();
        collection = client.db(dbName).collection("carts");
        console.log("Cart collection initialized");
    }
}
initCollection();

// Get current user's cart
router.get("/", verifyToken, async (req, res) => {
    try {
        const userEmail = req.user.email;
        const cart = await collection.findOne({ userEmail });
        res.json(cart ? cart.items : []);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// Update user's cart
router.post("/", verifyToken, async (req, res) => {
    try {
        const userEmail = req.user.email;
        const items = req.body.items || [];

        await collection.updateOne(
            { userEmail },
            { $set: { items, updatedAt: new Date() } },
            { upsert: true }
        );

        res.json({ message: "Cart updated successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// Clear user's cart
router.delete("/", verifyToken, async (req, res) => {
    try {
        const userEmail = req.user.email;
        await collection.deleteOne({ userEmail });
        res.json({ message: "Cart cleared" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;