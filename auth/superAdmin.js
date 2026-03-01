const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const uri = process.env.DB_URI;
const client = new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1 } });
const dbName = 'electronicsDB';

const verifySuperAdmin = async (req, res, next) => {
    try {
        await client.connect();
        const usersCollection = client.db(dbName).collection('users');

        const user = await usersCollection.findOne({ _id: new ObjectId(req.user.id) });

        if (!user || user.role !== 'superadmin') {
            return res.status(403).json({ message: "Super Admin only from middleware" });
        }

        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = verifySuperAdmin;




