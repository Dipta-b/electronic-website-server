const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
app.use(cors({
    origin: "http://localhost:5173", // your React dev server
    credentials: true,               // allow cookies
}));

const cookieParser = require("cookie-parser");
app.use(cookieParser());
const productRoutes = require('./routes/productRoutes')


app.use(express.json());
require('dotenv').config();


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const verifySuperAdmin = require('./auth/superAdmin');
const verifyToken = require('./auth/verifyToken');
const verifyAdmin = require('./auth/admin');
const verifyAdminOrSuperAdmin = require('./auth/verifyAdminOrSuperadmin');
const router = require('./routes/cart');
const { router:sortRouter } = require('./routes/sortSearch');
const searchRouter = require('./routes/sortSearch');
const uri = process.env.DB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        const electronicsCollection = client.db('electronicsDB').collection('electronics');
        const usersCollection = client.db('electronicsDB').collection('users');

app.use('/search',searchRouter);
        //pending users
        app.get('/users/pending', verifyToken, async (req, res) => {
            if (["admin", "superadmin"].includes(req.user.role)) {
                try {
                    const pendingUsers = await usersCollection.find({ status: "pending" }).toArray();
                    res.json(pendingUsers);
                } catch (err) {
                    console.error(err);
                    res.status(500).json({ message: "Server error" });
                }
            }

            else {
                return res.status(403).json({ message: "Access denied" })
            }

        });




        //User registration
        app.post('/api/auth/register', async (req, res) => {
            try {
                const { name, email, password, role, image } = req.body;

                const existingUser = await usersCollection.findOne({ email });
                if (existingUser) {
                    return res.status(400).json({ message: 'User already exists' });
                }

                const hashedPassword = await bcrypt.hash(password, 10);

                const newUser = {
                    name,
                    email,
                    password: hashedPassword,
                    role: "user",              // ✅ always user by default
                    requestedRole: role || "user", // what they selected
                    status: "pending",         // waiting for approval
                    image: image || "",
                    createdAt: new Date()
                };

                const result = await usersCollection.insertOne(newUser);

                res.status(201).json({
                    id: result.insertedId,
                    name,
                    email,
                    requestedRole: newUser.requestedRole,
                    status: newUser.status,
                    image: newUser.image
                });


            } catch (error) {
                console.error(error);
                res.status(500).json({ message: "Server error" });
            }
        });

        //user login

        // ==================== SIGN IN ====================
        app.post('/api/auth/login', async (req, res) => {
            try {
                const { email, password } = req.body;

                // 1️⃣ Check if user exists
                const user = await usersCollection.findOne({ email });
                if (!user) {
                    return res.status(404).json({ message: "User not found" });
                }

                // 2️⃣ Check password
                const isMatch = await bcrypt.compare(password, user.password);
                if (!isMatch) {
                    return res.status(401).json({ message: "Invalid password" });
                }



                // 4️⃣ Generate JWT token
                const token = jwt.sign(
                    { id: user._id, role: user.role },
                    process.env.JWT_SECRET,
                    { expiresIn: "7d" }
                );

                // 5️⃣ Send token in HTTP-only cookie
                res.cookie('token', token, {
                    httpOnly: true,
                    secure: false, // set true in production with HTTPS
                    sameSite: "lax"
                });

                // 6️⃣ Return user info (without password)
                res.json({
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    requestedRole: user.requestedRole,
                    status: user.status,
                    image: user.image
                });

            } catch (error) {
                console.error(error);
                res.status(500).json({ message: "Server error" });
            }
        });


        // GET CURRENT USER (for reload persistence)
        app.get("/api/auth/me", async (req, res) => {
            try {
                const token = req.cookies.token;

                if (!token) {
                    return res.status(401).json({ message: "Not authenticated" });
                }

                const decoded = jwt.verify(token, process.env.JWT_SECRET);

                const user = await usersCollection.findOne(
                    { _id: new ObjectId(decoded.id) },
                    { projection: { password: 0 } } // remove password
                );

                if (!user) {
                    return res.status(404).json({ message: "User not found" });
                }

                res.json(user);
            } catch (error) {
                res.status(401).json({ message: "Invalid token" });
            }
        });

        // ==================== LOGOUT ====================
        app.post('/api/auth/logout', (req, res) => {
            try {
                res.clearCookie('token', { httpOnly: true, sameSite: "strict" });
                res.json({ message: "Logged out successfully" });
            } catch (error) {
                console.error(error);
                res.status(500).json({ message: "Server error" });
            }
        });


        //get all pending users
        app.get('/users/pending', verifyToken, async (req, res) => {
            try {
                // Allow only admin or superadmin
                if (!["admin", "superadmin"].includes(req.user.role)) {
                    return res.status(403).json({ message: "Access denied" });
                }

                const pendingUsers = await usersCollection.find({ status: "pending" }).toArray();
                res.json(pendingUsers);
            } catch (err) {
                console.error(err);
                res.status(500).json({ message: "Server error" });
            }
        });
        //
        // 
        // app.get('/api/users', verifyToken, async (req, res) => {
        //   try {
        //     // Only allow users with admin or superadmin roles
        //     if (!["admin", "superadmin"].includes(req.user.role)) {
        //       return res.status(403).json({ message: "Access denied" });
        //     }

        //     const users = await usersCollection
        //       .find({}, { projection: { password: 0 } }) // remove password
        //       .toArray();

        //     res.json(users);
        //   } catch (err) {
        //     console.error(err);
        //     res.status(500).json({ message: "Server error" });
        //   }
        // });

        //make admin

        //



        app.patch('/users/approve/:id', verifyToken, verifyAdminOrSuperAdmin, async (req, res) => {
            try {
                const { id } = req.params;


                const userToApprove = await usersCollection.findOne({
                    _id
                        : new ObjectId(id), status: "pending"
                })
                if (!userToApprove) {
                    return res
                        .status(404)
                        .json({ message: "Pending user not found or already approved" });
                }
                const newRole = "admin"

                await usersCollection.updateOne(
                    { _id: userToApprove._id },
                    {
                        $set: {
                            role: newRole,
                            status: "approved"
                        },
                    }
                )
                res.json({ message: `${userToApprove.name} is now ${newRole}` });
            } catch (error) {
                console.error(error);
                res.status(500).json({ message: "Server error" });
            }
        })

        //reject for admin
        app.delete("/users/reject/:id", verifyToken, async (req, res) => {
            try {
                // ✅ Manual role check inside the route
                if (!["admin", "superadmin"].includes(req.user.role)) {
                    return res.status(403).json({ message: "Access denied" });
                }

                const { id } = req.params;

                const userToReject = await usersCollection.findOne({ _id: new ObjectId(id) });
                if (!userToReject) return res.status(404).json({ message: "User not found" });

                await usersCollection.deleteOne({ _id: userToReject._id });

                res.json({ message: `${userToReject.name} rejected and removed successfully` });
            } catch (err) {
                console.error(err);
                res.status(500).json({ message: "Server error" });
            }
        });


        //all admins
        app.get('/users/admins', verifyToken, async (req, res) => {
            try {

                if (req.user.role === "users") {
                    return res.status(403).json({ message: "Access denied" });
                }

                const admins = await usersCollection
                    .find({ role: "admin" }, { projection: { password: 0 } }) // only admins
                    .toArray();

                res.json(admins);
            } catch (err) {
                console.error(err);
                res.status(500).json({ message: "Server error" });
            }
        });

        //make a admin to user
        app.patch('/users/demote/:id', verifyToken, verifySuperAdmin, async (req, res) => {
            try {
                const { id } = req.params;



                const adminUser = await usersCollection.findOne({ _id: new ObjectId(id), role: "admin" });
                if (!adminUser) return res.status(404).json({ message: "Admin not found" });

                await usersCollection.updateOne(
                    { _id: adminUser._id },
                    { $set: { role: "user" } }
                );

                res.json({ message: `${adminUser.name} has been demoted to user` });
            } catch (err) {
                console.error(err);
                res.status(500).json({ message: "Server error" });
            }
        });


        //search sort pagination
     


        //super admin seeding code
        async function seedSuperAdmin() {
            const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
            const superAdminPassword = process.env.SUPER_ADMIN_PASS;
            const existingUser = await usersCollection.findOne({ email: superAdminEmail });

            if (!existingUser) {
                // ✅ Create the super admin directly
                const hashedPassword = await bcrypt.hash(superAdminPassword, 10); // set default password

                await usersCollection.insertOne({
                    name: "Dipta Banik",
                    email: superAdminEmail,
                    password: hashedPassword,
                    role: "superadmin",
                    requestedRole: "superadmin",
                    status: "approved",
                    image: "",
                    createdAt: new Date()
                });

                console.log("✅ Super Admin created and seeded!");
                return;
            }

            if (existingUser.role === "superadmin") {
                console.log("Super Admin already exists");
                return;
            }

            await usersCollection.updateOne(
                { email: superAdminEmail },
                {
                    $set: {
                        role: "superadmin",
                        requestedRole: "superadmin",
                        status: "approved"
                    }
                }
            );

            console.log("✅ Super Admin seeded from existing user");
        }

        // seedSuperAdmin()


    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.log);






app.use('/products', productRoutes);
app.use('/cart', router)


app.get('/', (req, res) => {
    res.send('Server is for Electronics Dipta');
})

app.listen(port, () => {
    console.log(`lsitening on port ${port}`)
})