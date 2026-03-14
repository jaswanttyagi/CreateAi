const express = require("express");
const { Login, Logout, signUp } = require("../Controllers/auth");
const router = express.Router();

router.post("/signup" , signUp);
router.post("/login" , Login)
router.get("/logout" , Logout);

module.exports = router;