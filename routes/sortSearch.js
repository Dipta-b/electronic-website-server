// routes/searchInput.js
const express = require("express");
const router = express.Router();
const Fuse = require("fuse.js");
const { getCollection } = require("./db");

// /search?name=abc&minPrice=0&maxPrice=1000
router.get("/", async (req, res) => {
  try {
    const { name = "", minPrice = 0, maxPrice = 1000000 } = req.query;
    const collection = await getCollection("electronics");

    let query = {};
    if (name.trim()) {
      const lowerName = name.toLowerCase();
      const categories = ["mobile", "laptop", "electronics", "accessories"];
      if (categories.includes(lowerName)) query.category = lowerName;
      else query.name = { $regex: name, $options: "i" };
    }

    let products = await collection.find(query).toArray();
    products = products.map((p) => ({ ...p, price: Number(p.price) }));

    const min = Number(minPrice);
    const max = Number(maxPrice);
    products = products.filter((p) => p.price >= min && p.price <= max);

    if (!products.length && name) {
      const allProducts = await collection.find({}).toArray();
      const fuse = new Fuse(allProducts, { keys: ["name", "category"], threshold: 0.4 });
      products = fuse
        .search(name)
        .map((r) => ({ ...r.item, price: Number(r.item.price) }))
        .filter((p) => p.price >= min && p.price <= max);
    }

    res.json({ products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;