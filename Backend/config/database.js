const mongoose = require("mongoose");
require("./env");

const connectDB = async () => {
    if (!process.env.MONGO_URL) {
        throw new Error("MONGO_URL is missing");
    }

    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log("Connected to database successfully");
    } catch (err) {
        console.log("Error connecting to database: ", err);
        throw err;
    }
};

module.exports = connectDB;
