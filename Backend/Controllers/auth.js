const User  = require("../models/usermodel.js");
const { genToken } = require("./genToken.js");
const bcrypt = require("bcrypt");
const { authCookieOptions, clearAuthCookie } = require("../config/runtime");

module.exports.signUp = async(req , res)=>{
        try{
            const {name , email , password} = req.body;
            // let performing the validation of the data here
        if(!name || !email || !password){
            return res.status(400).json({message : "Please fill all the fields"});
        }

        //  checking if the same email is already present in the database or not
        const existingUser = await User.findOne({email});

         if(existingUser){
            return res.status(400).json({message : "User already exists"});
        }

        // if password length is less than 6 then we will return an error
            if(password.length < 6){
                return res.status(400).json({message : "Password should be at least 6 characters long"});
            }

        // hasing the password before saving it to the database
        const hashedPassword = await bcrypt.hash(password , 10);

        // now create the user
        const user = await User.create({
            name , email , password:hashedPassword         
        })
        // generating the token for the user

        const token = await genToken(user._id);
        if(!token){
            return res.status(500).json({message : "Could not create authentication token"});
        }
        const safeUser = await User.findById(user._id).select("-password");
        // Now parsing the token in cookies
        clearAuthCookie(res);
        res.cookie("token" , token , authCookieOptions)
        return res.status(201).json({message : "User created successfully", user: safeUser});
    }
    catch(err){
        console.log("Error in signup" , err);
    }
}


// login
module.exports.Login = async(req , res)=>{
    try{
        const { email , password} = req.body;
        // let performing the validation of the data here
        if(!email || !password){
            return res.status(400).json({message : "Please fill all the fields"});
        }

        //  checking if the same email is already present in the database or not
        const user = await User.findOne({email});

         if(!user){
            return res.status(400).json({message : "Invalid credentials"});
        }

        // matching the password
        const isMatch = await bcrypt.compare(password , user.password);

        if(!isMatch){
            return res.status(400).json({message : "Invalid credentials"});
        }

        const token = await genToken(user._id);
        if(!token){
            return res.status(500).json({message : "Could not create authentication token"});
        }
        const safeUser = await User.findById(user._id).select("-password");
        // Now parsing the token in cookies
        clearAuthCookie(res);
        res.cookie("token" , token , authCookieOptions)
        return res.status(200).json({message : "User logged in successfully", user: safeUser});
    }
    catch(err){
        console.log("Error in login" , err);
    }
}

// logout

module.exports = {
    ...module.exports,
    Logout: async(req , res)=>{
        try{
            // if we clear the cookie then the user will be logged out
            clearAuthCookie(res);
            return res.status(200).json({message : "User logged out successfully"});
        }catch(err){
            console.log("Error in logout" , err);
        }
    }
}
