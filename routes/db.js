// db.js
const { MongoClient } = require("mongodb");
require("dotenv").config();

const client = new MongoClient(process.env.DB_URI);
let dbInstance = null;

async function getCollection(name) {
  if (!dbInstance) await client.connect();
  dbInstance = client.db("electronicsDB");
  return dbInstance.collection(name);
}

module.exports = { getCollection };