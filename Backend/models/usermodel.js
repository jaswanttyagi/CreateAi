const mongoose = require("mongoose");

const conversationHistorySchema = new mongoose.Schema(
    {
        role: {
            type: String,
            enum: ["user", "assistant"],
            required: true,
        },
        text: {
            type: String,
            required: true,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: false }
);

const memorySchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
        },
        label: {
            type: String,
            required: true,
        },
        kind: {
            type: String,
            default: "note",
        },
        value: {
            type: String,
            required: true,
        },
        keywords: {
            type: [String],
            default: [],
        },
        source: {
            type: String,
            default: "user",
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
        updatedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: false }
);

const userSchema = new mongoose.Schema({
    name:{
        type:String,
        required : true,
    },
    email:{
        type:String,
        required : true,
        unique:true,
    },
    password:{
        type: String,
        required:true,
    },
    assistantName : {
        type : String,
    },
    assistantImage:{
        type:String,
    },
    replyMode: {
        type: String,
        enum: ["fact", "funny", "savage"],
        default: "funny",
    },
    history : [
        {type : String}
    ],
    conversationHistory: [conversationHistorySchema],
    memories: [memorySchema]


} , {timestamps : true})

const User = mongoose.model("User" , userSchema);
module.exports = User;
