
// index.js
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");

// Auth middlewares
const verifyToken = require("./auth/verifyToken");
const verifyAdminOrSuperAdmin = require("./auth/verifyAdminOrSuperadmin");
const verifySuperAdmin = require("./auth/superAdmin");

// Routes
const productRoutes = require("./routes/productRoutes");
const cartRoutes = require("./routes/cart");
const { getCollection } = require("./routes/db");

require("dotenv").config();
console.log("DB_URI:", process.env.DB_URI);



(async () => {
  try {
    await getCollection("electronics");
    console.log("✅ MongoDB ready for requests");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
  }
})();

const app = express();
const port = process.env.PORT || 5000;

// ------------------ MIDDLEWARE ------------------
app.use(express.json());
app.use(cookieParser());
// In your backend index.js
const allowedOrigins = [
  "http://localhost:5173", // For your local development!
  "https://electronic-website-client.vercel.app" // Your live frontend
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);


// ------------------ AUTH ROUTES ------------------

// REGISTER
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, role, image } = req.body;
    const users = await getCollection("users");
    const existingUser = await users.findOne({ email });
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

    const result = await users.insertOne(newUser);
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
    const users = await getCollection("users");
    const user = await users.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid password" });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
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
    const users = await getCollection("users");
    const user = await users.findOne({ _id: new ObjectId(decoded.id) }, { projection: { password: 0 } });
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
    const users = await getCollection("users");
    const pendingUsers = await users.find({ status: "pending" }).toArray();
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
    const users = await getCollection("users");
    const user = await users.findOne({ _id: new ObjectId(id), status: "pending" });
    if (!user) return res.status(404).json({ message: "User not found or already approved" });

    await users.updateOne({ _id: user._id }, { $set: { role: "admin", status: "approved" } });
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
    const users = await getCollection("users");
    await users.deleteOne({ _id: new ObjectId(id) });
    res.json({ message: "User rejected" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET ALL ADMINS
app.get("/users/admins", verifyToken, async (req, res) => {
  try {
    if (req.user.role === "user") return res.status(403).json({ message: "Access denied" });
    const users = await getCollection("users");
    const admins = await users.find({ role: "admin" }, { projection: { password: 0 } }).toArray();
    res.json(admins);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// DEMOTE ADMIN TO USER
app.patch("/users/demote/:id", verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const users = await getCollection("users");
    const adminUser = await users.findOne({ _id: new ObjectId(id), role: "admin" });
    if (!adminUser) return res.status(404).json({ message: "Admin not found" });

    await users.updateOne({ _id: adminUser._id }, { $set: { role: "user" } });
    res.json({ message: `${adminUser.name} has been demoted to user` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------ PRODUCT ROUTES ------------------
app.use("/products", productRoutes);

// ------------------ CART ROUTES ------------------
app.use("/cart", cartRoutes);

// ------------------ SEARCH ROUTE ------------------
const searchInputRoute = require("./routes/sortSearch");
app.use("/search", searchInputRoute);

// ------------------ DEFAULT ROUTE ------------------
app.get("/", (req, res) => res.send("Electronics API running"));

// ------------------ START SERVER ------------------
app.listen(port, () => console.log(`Server running on port ${port}`));