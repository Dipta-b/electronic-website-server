// index.js
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const Fuse = require("fuse.js");

// Middleware imports (create these files if you haven't)
// verifyToken.js, verifyAdminOrSuperadmin.js, verifySuperAdmin.js
const verifyToken = require("./auth/verifyToken");
const verifyAdminOrSuperAdmin = require("./auth/verifyAdminOrSuperadmin");
const verifySuperAdmin = require("./auth/superAdmin");
const productRoutes = require('./routes/productRoutes')
const router = require('./routes/cart')


const app = express();
const port = process.env.PORT || 5000;

// ------------------ MIDDLEWARE ------------------
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: "https://electronic-website-client.vercel.app", 
    credentials: true,
  })
);

// ------------------ DATABASE ------------------
const client = new MongoClient(process.env.DB_URI, {
  serverApi: { version: ServerApiVersion.v1 },
});
let db;
let productsCollection;
let usersCollection;
let cartCollection;

async function initDB() {
  if (!db) await client.connect();
  db = client.db("electronicsDB");
  productsCollection = db.collection("electronics");
  usersCollection = db.collection("users");
  cartCollection = db.collection("carts");
  console.log("✅ MongoDB Connected");
}
initDB();

// ------------------ AUTH ROUTES ------------------

// REGISTER
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, role, image } = req.body;
    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      name,
      email,
      password: hashedPassword,
      role: "user",
      requestedRole: role || "user",
      status: "pending",
      image: image || "",
      createdAt: new Date(),
    };

    const result = await usersCollection.insertOne(newUser);
    res.status(201).json({ id: result.insertedId, ...newUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// LOGIN
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await usersCollection.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid password" });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });

   res.cookie("token", token, {
  httpOnly: true,
  secure: true,
  sameSite: "none",
});

    res.json({ id: user._id, name: user.name, email: user.email, role: user.role, status: user.status, image: user.image });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET CURRENT USER
app.get("/api/auth/me", async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: "Not authenticated" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await usersCollection.findOne({ _id: new ObjectId(decoded.id) }, { projection: { password: 0 } });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: "Invalid token" });
  }
});

// LOGOUT
app.post("/api/auth/logout", (req, res) => {
res.clearCookie("token", {
  httpOnly: true,
  secure: true,
  sameSite: "none",
});
  res.json({ message: "Logged out successfully" });
});

// ------------------ USERS MANAGEMENT ------------------

// GET PENDING USERS
app.get("/users/pending", verifyToken, async (req, res) => {
  try {
    if (!["admin", "superadmin"].includes(req.user.role)) return res.status(403).json({ message: "Access denied" });
    const pendingUsers = await usersCollection.find({ status: "pending" }).toArray();
    res.json(pendingUsers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// APPROVE USER
app.patch("/users/approve/:id", verifyToken, verifyAdminOrSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await usersCollection.findOne({ _id: new ObjectId(id), status: "pending" });
    if (!user) return res.status(404).json({ message: "User not found or already approved" });

    await usersCollection.updateOne({ _id: user._id }, { $set: { role: "admin", status: "approved" } });
    res.json({ message: `${user.name} approved as admin` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// REJECT USER
app.delete("/users/reject/:id", verifyToken, async (req, res) => {
  try {
    if (!["admin", "superadmin"].includes(req.user.role)) return res.status(403).json({ message: "Access denied" });
    const { id } = req.params;
    await usersCollection.deleteOne({ _id: new ObjectId(id) });
    res.json({ message: "User rejected" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------ PRODUCTS ROUTES ------------------
app.get("/products", async (req, res) => {
  try {
    const products = await productsCollection.find().toArray();
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/products/activeOffers", async (req, res) => {
  try {
    const offers = await productsCollection
      .find({ offerActive: true, $expr: { $gt: [{ $toDate: "$offerEnd" }, new Date()] } })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(offers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/products/category/:category", async (req, res) => {
  try {
    const { category } = req.params;
    const products = await productsCollection.find({ category: category.toLowerCase() }).toArray();
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/products/:id", async (req, res) => {
  try {
    const product = await productsCollection.findOne({ _id: new ObjectId(req.params.id) });
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
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




// Admin routes for products
// app.post("/products", verifyToken, verifyAdminOrSuperAdmin, async (req, res) => {
//   try {
//     const product = { ...req.body, createdAt: new Date(), offerActive: req.body.offerPrice && req.body.offerEnd ? true : false };
//     const result = await productsCollection.insertOne(product);
//     res.status(201).json(result);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// app.put("/products/:id", verifyToken, verifyAdminOrSuperAdmin, async (req, res) => {
//   try {
//     const result = await productsCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: req.body });
//     res.json(result);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// app.delete("/products/:id", verifyToken, verifyAdminOrSuperAdmin, async (req, res) => {
//   try {
//     const result = await productsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
//     res.json(result);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

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





// ------------------ CART ROUTES ------------------
app.get("/cart", verifyToken, async (req, res) => {
  try {
    const cart = await cartCollection.findOne({ userEmail: req.user.email });
    res.json(cart ? cart.items : []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/cart", verifyToken, async (req, res) => {
  try {
    const items = req.body.items || [];
    await cartCollection.updateOne({ userEmail: req.user.email }, { $set: { items, updatedAt: new Date() } }, { upsert: true });
    res.json({ message: "Cart updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/cart", verifyToken, async (req, res) => {
  try {
    await cartCollection.deleteOne({ userEmail: req.user.email });
    res.json({ message: "Cart cleared" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------ SEARCH ROUTE ------------------
app.get("/search", async (req, res) => {
  try {
    const { name = "", minPrice = 0, maxPrice = 1000000 } = req.query;
    let query = {};

    if (name.trim()) {
      const lowerName = name.toLowerCase();
      const categories = ["mobile", "laptop", "electronics", "accessories"];
      if (categories.includes(lowerName)) query.category = lowerName;
      else query.name = { $regex: name, $options: "i" };
    }

    let products = await productsCollection.find(query).toArray();
    products = products.map((p) => ({ ...p, price: Number(p.price) }));

    const min = Number(minPrice);
    const max = Number(maxPrice);
    products = products.filter((p) => p.price >= min && p.price <= max);

    if (!products.length && name) {
      const allProducts = await productsCollection.find({}).toArray();
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


app.use('/products', productRoutes);
app.use('/cart', router)

// ------------------ DEFAULT ROUTE ------------------
app.get("/", (req, res) => res.send("Electronics API running"));

// ------------------ START SERVER ------------------
app.listen(port, () => console.log(`Server running on port ${port}`));