//
const express = require('express');
const { authMiddleware } = require('../middleware');
const { AccountModel, TransactionModel, IdempotencyModel } = require('../db');
const { default: mongoose } = require('mongoose');
const router = express.Router();

router.get('/balance', authMiddleware, async (req, res) => {
    const account = await AccountModel.findOne({ userId: req.userId });
    res.json({ balance: account.balance });
});

router.post("/transfer", authMiddleware, async (req, res) => {
    const idempotencyKey = req.headers['idempotency-key'];
    if (!idempotencyKey) {
        return res.status(400).json({ message: "Idempotency key missing" });
    }

    const existingRecord = await IdempotencyModel.findOne({ key: idempotencyKey, userId: req.userId });
    if (existingRecord) {
        return res.json(existingRecord.response);
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    const { amount, to } = req.body;

    try {
        const fromAccount = await AccountModel.findOneAndUpdate(
            { userId: req.userId, balance: { $gte: amount } },
            { $inc: { balance: -amount } },
            { session, new: true }
        );

        if (!fromAccount) {
            await session.abortTransaction();
            return res.status(400).json({ message: "Insufficient balance" });
        }

        const toAccount = await AccountModel.findOneAndUpdate(
            { userId: to },
            { $inc: { balance: amount } },
            { session, new: true }
        );

        if (!toAccount) {
            await session.abortTransaction();
            return res.status(400).json({ message: "Invalid recipient account" });
        }

        await TransactionModel.create([{
            fromUserId: req.userId,
            toUserId: to,
            amount: amount,
            timestamp: new Date()
        }], { session });

        await IdempotencyModel.create([{
            key: idempotencyKey,
            userId: req.userId,
            response: { message: "Transfer successful" }
        }], { session });

        await session.commitTransaction();
        res.json({ message: "Transfer successful" });

    } catch (error) {
        await session.abortTransaction();
        if (error.code === 11000 && error.keyPattern && error.keyPattern.key) {
             return res.status(409).json({ message: "Transaction already processing" });
        }
        console.error("Transfer failed:", error);
        res.status(500).json({ message: "Internal server error" });
    } finally {
        session.endSession();
    }
});

router.get("/transactions", authMiddleware, async (req, res) => {
    try {
        const transactions = await TransactionModel.find({
            $or: [{ fromUserId: req.userId }, { toUserId: req.userId }]
        })
        .populate('fromUserId', 'firstName lastName')
        .populate('toUserId', 'firstName lastName')
        .sort({ timestamp: -1 });

        const processedTransactions = transactions.map(tx => {
            const txObject = tx.toObject();
            txObject.type = (txObject.fromUserId._id.toString() === req.userId) ? 'debit' : 'credit';
            return txObject;
        });

        res.json({ transactions: processedTransactions });
    } catch (error) {
        res.status(500).json({ message: "Error fetching transactions" });
    }
});

module.exports = router;