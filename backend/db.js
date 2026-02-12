const mongoose = require("mongoose");
const bcrypt = require('bcryptjs');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.error("MongoDB connection error:", err));

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true, lowercase: true, minLength: 3, maxLength: 30 },
    password: { type: String, required: true, minLength: 8 },
    firstName: { type: String, required: true, trim: true, maxLength: 50 },
    lastName: { type: String, required: true, trim: true, maxLength: 50 },
    profilePicture: { type: String, default: '' }
});

userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

userSchema.methods.comparePassword = function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

const accountSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    balance: { type: Number, required: true }
});

const transactionSchema = new mongoose.Schema({
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now },
    status: { type: String, enum: ['completed', 'failed', 'pending'], default: 'completed' }
});

const idempotencySchema = new mongoose.Schema({
    key: { type: String, unique: true, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    response: { type: Object },
    timestamp: { type: Date, default: Date.now, expires: 86400 }
});

const requestSchema = new mongoose.Schema({
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Who is asking
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },   // Who needs to pay
    amount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    timestamp: { type: Date, default: Date.now }
});

const UserModel = mongoose.model('User', userSchema);
const AccountModel = mongoose.model('Account', accountSchema);
const TransactionModel = mongoose.model('Transaction', transactionSchema);
const IdempotencyModel = mongoose.model('Idempotency', idempotencySchema);
const RequestModel = mongoose.model('Request', requestSchema);

module.exports = {
	UserModel,
    AccountModel,
    TransactionModel,
    IdempotencyModel,
    RequestModel
};