const express = require("express");
const userRouter = express.Router();

const { getCurrentuser } = require("../Controllers/userController");
const { updateAssistant } = require("../Controllers/userController");
const { deleteAccount } = require("../Controllers/userController");
const { askToassistant } = require("../Controllers/userController");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const isAuth = require("../middleware/isAuth");

 userRouter.get("/currentUser" ,isAuth,getCurrentuser);
 userRouter.post("/updateAssistant" , isAuth , upload.single("assistantImage") ,updateAssistant);
 userRouter.post("/askToassistant" , isAuth , askToassistant);
 userRouter.delete("/deleteAccount" , isAuth , deleteAccount);

module.exports = userRouter;
