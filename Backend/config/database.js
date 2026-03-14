const mongoose = require("mongoose");
require("./env");

const connectDB = async(req , res)=>{
    try{
        await mongoose.connect(process.env.MONGO_URL , {})
        console.log("Connected to database successfully");

    }catch(err){
        console.log("Error connecting to database: ", err);
    }
}

module.exports = connectDB;
