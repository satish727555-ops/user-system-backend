const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const{protect,adminOnly} = require("../middleware/authMiddleware");


const router =express.Router();
router.get("/register",(req,res) =>{
    res.render("register");
})
router.post("/register",async(req,res) =>{
    const{name,email,password} = req.body;
    const userExists =await User.findOne({email});
    if(userExists){
        return res.status(400).json({message:"User already exists"});
    }
    const hashedPassword = await bcrypt.hash(password,10);


    const user = await User.create({
        name,
        email,
        password: hashedPassword
    });
    res.status(201).json({message:"User registered successfully"});
    });
    router.post("/login",async(req,res)=>{
        const {email,password}=req.body;
        const user = await User.findOne({email});

        if(!user){
            return res.status(400).json({message:"invalid email or password"});

        }
        const isMatch = await bcrypt.compare(password, user.password);
        if(!isMatch){
            return res.status(400).json({message:"invalid email or password"
            });
        }
        const token  =jwt.sign(
            {id:user._id, role:user.role},
            process.env.JWT_SECRET,
            {expiresIn:"id"}
        );
    res.json({
        token,
        user:{
            id: user._id,
         name:user.name,
         email:user.email,
         role:user.role
        }
    });
});
router.get("/profile",protect,async(req,res)=>{
    const user = await
    User.findById(req.user.id).select("-password");
    res.json(user);
});
router.get("/admin",protect,adminOnly,(req,res)=>{
    res.json({message:"Welcome Admin"});

});
module.exports=router;





























































