//require('dotenv').config({path: './env'})

import dotenv from "dotenv"

import connectDB from "./db/index.js";

import {app} from './app.js'

//dotenv.config({
//  path: './.env' //this is correct, this should be written
//})
dotenv.config({
  path: './env'
})


connectDB()

.then( ()=> {

  //listen k pehle , error k liye listen bhi kr sakte ho 
  app.listen(process.env.PORT || 8000, () => {
    console.log(`Server is running on port: ' ${process.env.PORT}`);
  })
})
.catch((err) => {
  console.log("MONGO db connection failed !!", err);
})