const express = require('express');
const { authMiddleware } = require('../middleware');
const { RequestModel, AccountModel, TransactionModel } = require('../db');
const { default: mongoose } = require('mongoose');
const zod = require("zod"); 
const router = express.Router();

const createRequestSchema = zod.object({
    toUserId: zod.string(),
    amount: zod.number().min(1) 
});

const actionRequestSchema = zod.object({
    requestId: zod.string(),
    action: zod.enum(['accepted', 'rejected'])
});

router.post("/create", authMiddleware, async (req, res) => {
    const { success } = createRequestSchema.safeParse(req.body);
    if (!success) {
        return res.status(400).json({ message: "Invalid request data" });
    }

    const { toUserId, amount } = req.body;

    if (toUserId === req.userId) {
        return res.status(400).json({ message: "Cannot request money from yourself" });
    }

    try {
        await RequestModel.create({
            fromUserId: req.userId,
            toUserId: toUserId,
            amount: amount,
            status: 'pending'
        });

        res.json({ message: "Request sent successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error sending request" });
    }
});

router.get("/pending", authMiddleware, async (req, res) => {
    try {
        const requests = await RequestModel.find({
            toUserId: req.userId,
            status: 'pending'
        }).populate('fromUserId', 'firstName lastName');

        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: "Error fetching requests" });
    }
});

router.post("/action", authMiddleware, async (req, res) => {
    const { success } = actionRequestSchema.safeParse(req.body);
    if (!success) {
        return res.status(400).json({ message: "Invalid action inputs" });
    }

    const { requestId, action } = req.body;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const request = await RequestModel.findOne({ 
            _id: requestId, 
            toUserId: req.userId, 
            status: 'pending' 
        }).session(session);

        if (!request) {
            await session.abortTransaction();
            return res.status(404).json({ message: "Request not found or already processed" });
        }

        if (action === 'rejected') {
            request.status = 'rejected';
            await request.save({ session });
            await session.commitTransaction();
            return res.json({ message: "Request rejected" });
        }

        const amount = request.amount;
        const toUser = request.fromUserId;
        const fromUser = req.userId;

        const fromAccount = await AccountModel.findOneAndUpdate(
            { userId: fromUser, balance: { $gte: amount } },
            { $inc: { balance: -amount } },
            { session, new: true }
        );

        if (!fromAccount) {
            await session.abortTransaction();
            return res.status(400).json({ message: "Insufficient balance" });
        }

        await AccountModel.findOneAndUpdate(
            { userId: toUser },
            { $inc: { balance: amount } },
            { session, new: true }
        );

        await TransactionModel.create([{
            fromUserId: fromUser,
            toUserId: toUser,
            amount: amount,
            timestamp: new Date()
        }], { session });

        request.status = 'accepted';
        await request.save({ session });

        await session.commitTransaction();
        res.json({ message: "Request approved and money sent!" });

    } catch (error) {
        await session.abortTransaction();
        console.error("Transaction Error:", error);
        res.status(500).json({ message: "Transaction failed" });
    } finally {
        session.endSession();
    }
});

module.exports = router;