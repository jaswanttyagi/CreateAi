const jwt = require('jsonwebtoken');
require('../config/env');

const clearAuthCookie = (res) => {
    res.clearCookie("token", {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
    });
};

const isAuth = async(req , res , next)=>{
      try{
        const token = req.cookies.token;
        if(!token || typeof token !== "string"){
            clearAuthCookie(res);
            return res.status(401).json({message : "Unauthorized"});
        }

        const verifyToken = jwt.verify(token , process.env.JWT_SECRET_KEY);
        if(!verifyToken?.userId){
            clearAuthCookie(res);
            return res.status(401).json({message : "Unauthorized"});
        }
        req.userId = verifyToken.userId;
        next();
      }catch(err){
        clearAuthCookie(res);
        console.log("Auth verification failed:", err.message);
        return res.status(401).json({message : "Unauthorized"});
      }  
}
module.exports = isAuth;
