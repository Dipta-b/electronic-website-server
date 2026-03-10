// routes/productRoutes.js
const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const verifyToken = require("../auth/verifyToken");
const verifyAdminOrSuperAdmin = require("../auth/verifyAdminOrSuperadmin");
const { getCollection } = require("./db");

// GET all products
router.get("/", async (req, res) => {
  try {
    const collection = await getCollection("electronics");
    const products = await collection.find().toArray();
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET active offers
router.get("/activeOffers", async (req, res) => {
  try {
    const collection = await getCollection("electronics");
    const offers = await collection
      .find({
        offerActive: true,
        $expr: { $gt: [{ $toDate: "$offerEnd" }, new Date()] },
      })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(offers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET category products
router.get("/category/:category", async (req, res) => {
  try {
    const collection = await getCollection("electronics");
    const { category } = req.params;
    const products = await collection
      .find({ category: category.toLowerCase() })
      .toArray();
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET product by ID
router.get("/:id", async (req, res) => {
  try {
    const collection = await getCollection("electronics");
    const product = await collection.findOne({ _id: new ObjectId(req.params.id) });
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// CREATE product (admin/superadmin)
router.post("/", verifyToken, verifyAdminOrSuperAdmin, async (req, res) => {
  try {
    const collection = await getCollection("electronics");
    const product = {
      ...req.body,
      createdAt: new Date(),
      offerActive: req.body.offerPrice && req.body.offerEnd ? true : false,
    };
    const result = await collection.insertOne(product);
    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// UPDATE product
router.put("/:id", verifyToken, verifyAdminOrSuperAdmin, async (req, res) => {
  try {
    const collection = await getCollection("electronics");
    const result = await collection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: req.body }
    );
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE product
router.delete("/:id", verifyToken, verifyAdminOrSuperAdmin, async (req, res) => {
  try {
    const collection = await getCollection("electronics");
    const result = await collection.deleteOne({ _id: new ObjectId(req.params.id) });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;