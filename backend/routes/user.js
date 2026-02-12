const express = require('express');
const router = express.Router();
const zod = require("zod");
const { UserModel, AccountModel } = require('../db');
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config");
const { authMiddleware } = require("../middleware");

const signupBody = zod.object({
    email: zod.string().email(),
    username: zod.string().min(3).max(30),
    firstName: zod.string().max(50),
    lastName: zod.string().max(50),
    password: zod.string().min(8),
});

router.post("/signup", async (req, res) => {
    const parsed = signupBody.safeParse(req.body);
    if (!parsed.success) {
        return res.status(411).json({ message: "Invalid inputs", issues: parsed.error.issues });
    }

    const { email, username, firstName, lastName, password } = parsed.data;

    const existingUser = await UserModel.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
        return res.status(411).json({ message: "Email or username already taken" });
    }

    const profilePicture = `https://ui-avatars.com/api/?name=${encodeURIComponent(firstName)}+${encodeURIComponent(lastName)}&background=random&color=fff&bold=true`;

    const user = await UserModel.create({ email, username, password, firstName, lastName, profilePicture });
    const userId = user._id;

    await AccountModel.create({ userId: userId, balance: 1 + Math.random() * 10000 });

    res.json({ message: "User created successfully" });
});

const signinBody = zod.object({
    email: zod.string().email(),
	password: zod.string()
});

router.post("/signin", async (req, res) => {
    const { success } = signinBody.safeParse(req.body);
    if (!success) {
        return res.status(411).json({ message: "Incorrect inputs" });
    }

    const user = await UserModel.findOne({ email: req.body.email });

    if (user && await user.comparePassword(req.body.password)) {
        const token = jwt.sign({ userId: user._id }, JWT_SECRET);

        res.cookie('token', token, {
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production', 
            sameSite: 'lax', 
            maxAge: 24 * 60 * 60 * 1000 
        });

        res.json({ message: "Logged in successfully" });
        return;
    }
    
    res.status(411).json({ message: "Error while logging in" });
});

router.post("/logout", (req, res) => {
    res.clearCookie('token');
    res.json({ message: "Logged out" });
});

router.get("/profile", authMiddleware, async (req, res) => {
    const user = await UserModel.findById(req.userId).select('-password');
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
});

const updateBody = zod.object({
	password: zod.string().min(8).optional(),
    firstName: zod.string().max(50).optional(),
    lastName: zod.string().max(50).optional(),
    profilePicture: zod.string().url().optional(),
});

router.put("/", authMiddleware, async (req, res) => {
    const { success } = updateBody.safeParse(req.body);
    if (!success) {
        return res.status(411).json({ message: "Error while updating information" });
    }

    const user = await UserModel.findById(req.userId);
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    const { firstName, lastName, password, profilePicture } = req.body;
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (password) user.password = password;
    if (profilePicture) user.profilePicture = profilePicture;

    await user.save();
	
    res.json({ message: "Updated successfully" });
});

router.get("/bulk", authMiddleware, async (req, res) => {
    const filter = req.query.filter || "";
    const users = await UserModel.find({
        _id: { "$ne": req.userId },
        $or: [{
            firstName: { "$regex": filter, "$options": "i" }
        }, {
            lastName: { "$regex": filter, "$options": "i" }
        }]
    });

    res.json({
        user: users.map(user => ({
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            _id: user._id,
            profilePicture: user.profilePicture
        }))
    });
});

router.get("/details/:userId", authMiddleware, async (req, res) => {
    try {
        const otherUserId = req.params.userId;
        const loggedInUserId = req.userId;

        const user = await UserModel.findById(otherUserId).select('-password');
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const transactions = await TransactionModel.find({
            $or: [
                { fromUserId: loggedInUserId, toUserId: otherUserId },
                { fromUserId: otherUserId, toUserId: loggedInUserId }
            ]
        }).sort({ timestamp: -1 });

        const processedTransactions = transactions.map(tx => ({
            ...tx.toObject(),
            type: tx.fromUserId.toString() === loggedInUserId ? 'debit' : 'credit'
        }));

        res.json({ user, transactions: processedTransactions });

    } catch (error) {
        console.error("Error fetching user details:", error);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;