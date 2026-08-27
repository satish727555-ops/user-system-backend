const express = require("express");
const mongoose = require("mongoose");
const path =require('path');
const dotenv = require("dotenv");
const cors = require("cors");
dotenv.config();
const app = express();
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.set("view engine","ejs");
app.set('views', path.join(__dirname, 'views'));
app.use(cors());
mongoose.connect(process.env.MONGO_URI)
.then(() => {
console.log("MongoDB Connected");
})
.catch(err => console.log(err));

 app.use('/api/users', require("./routes/userRoutes"));
 const PORT = process.env.PORT || 5000;
 app.listen(PORT , ()=>{
    console.log('server running on port ${PORT}');

 });