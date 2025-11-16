import mongoose from "mongoose";

export async function connectDB(uri){
   try{
    const conn = await mongoose.connect(uri,{});
    console.log("MongoDB connected",conn.connection.host);
   }
   catch(err){
    console.error("MongoDB connection error",err.message);
    process.exit(1);
   }
}