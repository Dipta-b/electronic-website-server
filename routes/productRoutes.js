const express = require('express');
const router = express.Router();
const verifyToken = require('../auth/verifyToken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const verifyAdminOrSuperAdmin = require('../auth/verifyAdminOrSuperadmin');
require('dotenv').config();

const uri = process.env.DB_URI;
const client = new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1 } });
const dbName = 'electronicsDB';
const collectionName = 'electronics';

let collection;

async function initCollection() {
    if (!collection) {
        await client.connect();
        collection = client.db(dbName).collection(collectionName);
        console.log(' Product collection initialized');
    }
}
initCollection();

// ================= Routes =================

// GET all products (public)
router.get('/', async (req, res) => {
    try {
        const products = await collection.find().toArray();
        res.json(products);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// GET all active offers
router.get('/activeOffers', async (req, res) => {
  try {

    const offers = await collection.find({
      offerActive: true,
      $expr: {
        $gt: [
          { $toDate: "$offerEnd" },
          new Date()
        ]
      }
    })
    .sort({ createdAt: -1 })
    .toArray();

    res.json(offers);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

//category based products
router.get('/category/:category', async (req, res) => {
    const { category } = req.params;
    try {
        const products = await collection.find({ category: category.toLocaleLowerCase() }).toArray();
        res.json(products);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
})


// GET single product by ID (public)
router.get('/:id', async (req, res) => {
    try {
        const product = await collection.findOne({ _id: new ObjectId(req.params.id) });
        if (!product) return res.status(404).json({ message: "Product not found" });
        res.json(product);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});




// CREATE product (admin/superadmin)
router.post('/', verifyToken, verifyAdminOrSuperAdmin, async (req, res) => {
    try {
        const product = {
            ...req.body,
            createdAt: new Date(),
            offerActive: req.body.offerPrice && req.body.offerEnd ? true : false
        };
        const result = await collection.insertOne(product);
        res.status(201).json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// UPDATE product (admin/superadmin)
router.put('/:id', verifyToken, verifyAdminOrSuperAdmin, async (req, res) => {
    try {
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

// DELETE product (admin/superadmin)
router.delete('/:id', verifyToken, verifyAdminOrSuperAdmin, async (req, res) => {
    try {
        const result = await collection.deleteOne({ _id: new ObjectId(req.params.id) });
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;