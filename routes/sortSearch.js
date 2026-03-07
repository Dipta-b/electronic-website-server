const express = require("express");
const searchInput = express.Router();
const { MongoClient, ServerApiVersion } = require("mongodb");
const Fuse = require("fuse.js");

const client = new MongoClient(process.env.DB_URI, {
  serverApi: { version: ServerApiVersion.v1 },
});

const electronicsCollection = client.db("electronicsDB").collection("electronics");

searchInput.get("/", async (req, res) => {
  try {
    const { name = "", minPrice = 0, maxPrice = 1000000 } = req.query;

    let query = {};

    if (name.trim() !== "") {
      const lowerName = name.toLowerCase();
      const categories = ["mobile", "laptop", "electronics", "accessories"];

      if (categories.includes(lowerName)) {
        query.category = lowerName;
      } else {
        query.name = { $regex: name, $options: "i" };
      }
    }

    // Fetch products first
    let products = await electronicsCollection.find(query).toArray();

    // Convert price strings to numbers on-the-fly
    products = products.map((p) => ({
      ...p,
      price: Number(p.price),
    }));

    // Filter by minPrice and maxPrice
    const min = Number(minPrice);
    const max = Number(maxPrice);

    products = products.filter((p) => p.price >= min && p.price <= max);

    // Fuzzy search fallback
    if (products.length === 0 && name) {
      const allProducts = await electronicsCollection.find({}).toArray();
      const fuse = new Fuse(allProducts, {
        keys: ["name", "category"],
        threshold: 0.4,
      });
      const results = fuse.search(name);
      products = results.map((r) => ({
        ...r.item,
        price: Number(r.item.price),
      })).filter((p) => p.price >= min && p.price <= max);
    }

    res.json({ products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = searchInput;