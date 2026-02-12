const express = require('express');
const userRouter = require("./user");
const accountRouter = require("./account");
const requestRouter = require("./request");

const router = express.Router();

router.use("/user", userRouter);
router.use("/account", accountRouter);
router.use("/request", requestRouter);

module.exports = router;