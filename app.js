const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
dotenv.config();
const app = express();
app.set("view engine","ejs");
app.use(express.json());
app.use(cors());
mongoose.connect(process.env.MONGO_URI)
.then(() => {
console.log("MongoDB Connected");
})
.catch(err => console.log(err));
 app.use("/api/users", require("./routes/userRoutes"));
 app.get('/',(req, res) => res.send("<h1>Server is running sucessfully!</h1>"));
 const PORT = process.env.PORT || 5000;
 app.listen(PORT , ()=>{
    console.log('server running on port ${PORT}');

 });