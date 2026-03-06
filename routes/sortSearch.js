const express = require('express');
const searchInput = express.Router();  // <-- changed to searchInput
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// Connect to the DB
const client = new MongoClient(process.env.DB_URI, {
  serverApi: { version: ServerApiVersion.v1 },
});

const electronicsCollection = client.db("electronicsDB").collection("electronics");

// GET products with flexible search
searchInput.get('/', async (req, res) => {
  try {
    const { name } = req.query;

    let query = {};
    const categories = ["mobile", "laptop", "accessories", "electronics"];

    if (name && name.trim() !== "") {
      const lowerName = name.toLowerCase();

      // If the search matches a category, search by category
      if (categories.includes(lowerName)) {
        query.category = lowerName;
      } else {
        // Otherwise, search by product name (case-insensitive)
        query.name = { $regex: name, $options: "i" };
      }
    }

    const products = await electronicsCollection
      .find(query)
      .sort({ createdAt: -1 }) // newest first
      .limit(50) // optional limit
      .toArray();

    res.json({ products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = searchInput;  // <-- export with the new name