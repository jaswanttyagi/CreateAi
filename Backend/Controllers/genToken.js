const jwt = require('jsonwebtoken')
require('../config/env')

module.exports.genToken = (UserId)=>{
    try{
        const token = jwt.sign(
            { userId: UserId.toString() },
            process.env.JWT_SECRET_KEY,
            { expiresIn : "7h" }
        );
        return token;
    }catch(err){
        console.log("Error generating token: ", err);
        return null;
    }
}
