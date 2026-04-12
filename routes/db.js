// db.js
const { MongoClient } = require("mongodb");

let client;
let db;

async function getCollection(name) {
  if (!db) {
    try {
      if (!process.env.DB_URI) throw new Error("DB_URI environment variable is missing!");
      client = new MongoClient(process.env.DB_URI, {
        serverSelectionTimeoutMS: 5000,
      });
      await client.connect();
      db = client.db("electronicsDB");
      console.log("✅ MongoDB connected");
    } catch (error) {
      client = null;
      db = null;
      throw error;
    }
  }
  return db.collection(name);
}

module.exports = { getCollection };