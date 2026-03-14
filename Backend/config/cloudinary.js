const cloud = require("cloudinary").v2;
const fs = require("fs");
require("./env");

const hasCloudinaryCredentials = () =>
    Boolean(process.env.CLOUD_NAME && process.env.API_KEY && process.env.API_SECRET);

const uploadToCloudinary = async (filepath) => {
    if (!hasCloudinaryCredentials()) {
        if (!filepath) {
            console.warn(
                "Cloudinary credentials are missing. Custom assistant image uploads will stay unavailable until CLOUD_NAME, API_KEY, and API_SECRET are set."
            );
            return null;
        }

        throw new Error(
            "Cloudinary credentials are missing. Set CLOUD_NAME, API_KEY, and API_SECRET before uploading custom assistant images."
        );
    }

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
