const express = require("express");
const fs = require("fs");
const path = require("path");
const userRouter = express.Router();

const { getCurrentuser } = require("../Controllers/userController");
const { updateAssistant } = require("../Controllers/userController");
const { deleteAccount } = require("../Controllers/userController");
const { askToassistant } = require("../Controllers/userController");
const multer = require("multer");
const isAuth = require("../middleware/isAuth");

const uploadDirectory = path.resolve(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

const upload = multer({ dest: uploadDirectory });

 userRouter.get("/currentUser" ,isAuth,getCurrentuser);
 userRouter.post("/updateAssistant" , isAuth , upload.single("assistantImage") ,updateAssistant);
 userRouter.post("/askToassistant" , isAuth , askToassistant);
 userRouter.delete("/deleteAccount" , isAuth , deleteAccount);

module.exports = userRouter;
