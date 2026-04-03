// routes/cart.js
const express = require("express");
const router = express.Router();
const verifyToken = require("../auth/verifyToken");
const { getCollection } = require("./db");

// GET cart
// ✅ FIXED
router.get("/", verifyToken, async (req, res) => {
  try {
    const collection = await getCollection("carts");
    const cart = await collection.findOne({ userEmail: req.user.email });
    res.json(cart ? cart.items : []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// UPDATE cart
router.post("/", verifyToken, async (req, res) => {
  try {
    const collection = await getCollection("carts");
    const items = req.body.items || [];
    await collection.updateOne(
      { userEmail: req.user.email },
      { $set: { items, updatedAt: new Date() } },
      { upsert: true }
    );
    res.json({ message: "Cart updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// CLEAR cart
router.delete("/", verifyToken, async (req, res) => {
  try {
    const collection = await getCollection("carts");
    await collection.deleteOne({ userEmail: req.user.email });
    res.json({ message: "Cart cleared" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;