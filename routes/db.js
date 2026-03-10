// db.js
const { MongoClient } = require("mongodb");
let client;
let db;

async function getCollection(name) {
  if (!client) {
    client = new MongoClient(process.env.DB_URI);
    await client.connect();
    db = client.db("electronicsDB");
    console.log("✅ Connected!");
  }
  return db.collection(name);
}

module.exports = { getCollection };