// db.js
const { MongoClient } = require("mongodb");

let client;
let db;

async function getCollection(name) {
  if (!client) {
    client = new MongoClient(process.env.DB_URI, {
      // optional but helps in serverless
      serverSelectionTimeoutMS: 5000, // wait max 5s for server
    });
    await client.connect();  // establish connection first
    db = client.db("electronicsDB");
    console.log("✅ MongoDB connected");
  }
  return db.collection(name);
}

module.exports = { getCollection };