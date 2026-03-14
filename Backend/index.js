const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
require('./config/env');
const db = require('./config/database');
const {uploadToCloudinary} = require('./config/cloudinary');
const authRoutes = require('./routes/route');
const cookieParser = require('cookie-parser');
const userRouter = require('./routes/userroute');
const { default: geminiResponse } = require('./gemini');

const port = process.env.PORT
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}))
app.use(cookieParser());
app.use(express.json());
app.use("/audio", express.static(path.join(__dirname, "audio")));
app.use("/api/auth" , authRoutes);
app.use("/api/user" , userRouter);

db();
uploadToCloudinary();

app.get("/", async (req, res) => {
    const prompt = req.query.prompt;

    if (!prompt) {
        return res.send("Hello world");
    }

    try {
        const data = await geminiResponse(prompt);
        return res.json(data);
    } catch (error) {
        return res.status(500).json({
            message: "Failed to get Gemini response",
            error: error.response?.data || error.message
        });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})
