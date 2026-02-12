require('dotenv').config();
const express = require("express");
const rootRouter = require('./routes/index');
const cors = require('cors');
const cookieParser = require('cookie-parser'); //

const app = express();

app.use(cors({
    origin: "http://localhost:5173", 
    credentials: true
}));

app.use(cookieParser());
app.use(express.json());

app.use("/api/v1", rootRouter);

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});