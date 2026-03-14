const fs = require("fs");
const express = require("express");
const cors = require("cors");
const path = require("path");
const cookieParser = require("cookie-parser");
const app = express();
require("./config/env");
const db = require("./config/database");
const { uploadToCloudinary } = require("./config/cloudinary");
const authRoutes = require("./routes/route");
const userRouter = require("./routes/userroute");
const {
  corsOptionsDelegate,
  getMissingEnvVars,
  isProduction,
  port,
} = require("./config/runtime");

const frontendDistPath = path.resolve(__dirname, "..", "frontend", "dist");
const audioDirectoryPath = path.join(__dirname, "audio");

if (isProduction) {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");
app.use(cors(corsOptionsDelegate));
app.options("*", cors(corsOptionsDelegate));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/audio", express.static(audioDirectoryPath));
app.use("/api/auth", authRoutes);
app.use("/api/user", userRouter);

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use((error, _req, res, next) => {
  if (error?.message?.includes("CORS")) {
    return res.status(403).json({ message: error.message });
  }

  return next(error);
});

const serveFrontend = () => {
  if (!fs.existsSync(frontendDistPath)) {
    console.warn(
      `Frontend build was not found at ${frontendDistPath}. API routes will stay available until the frontend is built.`
    );
    app.get("/", (_req, res) => {
      res.status(200).json({
        message: "CerateAI backend is running.",
        health: "/api/health",
      });
    });
    return;
  }

  app.use(express.static(frontendDistPath));
  app.get(/^\/(?!api|audio).*/, (_req, res) => {
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
};

const startServer = async () => {
  const missingEnvVars = getMissingEnvVars();

  if (missingEnvVars.length > 0) {
    console.error(
      `Missing required environment variables: ${missingEnvVars.join(", ")}`
    );
    process.exit(1);
  }

  try {
    await db();
    await uploadToCloudinary();
    serveFrontend();

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
