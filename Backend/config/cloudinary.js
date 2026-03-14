const cloud = require("cloudinary").v2;
const fs = require("fs");
require("./env");

const uploadToCloudinary = async (filepath) => {
    cloud.config({
        cloud_name: process.env.CLOUD_NAME,
        api_key: process.env.API_KEY,
        api_secret: process.env.API_SECRET,
    });

    // Startup initialization path: configure Cloudinary and exit.
    if (!filepath) {
        return null;
    }

    try {
        const uploadResult = await cloud.uploader.upload(filepath);
        return uploadResult.secure_url;
    } catch (err) {
        console.log("Error uploading to cloudinary:", err);
        throw err;
    } finally {
        // Cleanup local temp file only when a valid path exists.
        if (typeof filepath === "string" && filepath && fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }
    }
};

module.exports.uploadToCloudinary = uploadToCloudinary;
