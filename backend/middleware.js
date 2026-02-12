const { JWT_SECRET } = require("./config");
const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
    const token = req.cookies.token; //

    if (!token) {
        return res.status(403).json({ message: "Not authenticated" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } 
    catch (err) {
        return res.status(403).json({ message: "Invalid token" });
    }
};

module.exports = {
    authMiddleware
}