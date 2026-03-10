require('dotenv').config();
const { MongoClient } = require('mongodb');

async function test() {
  try {
    const client = new MongoClient(process.env.DB_URI);
    await client.connect();
    console.log("✅ MongoDB connected");
    const db = client.db("electronicsDB");
    const products = await db.collection("electronics").find().toArray();
    console.log(products);
    await client.close();
  } catch (err) {
    console.error("❌ Connection failed:", err);
  }
}

test();