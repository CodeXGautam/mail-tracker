import mongoose from 'mongoose';


const connectDB = async () =>{

    const DB_NAME = 'mailTracker-DB';

    try{
        const connectionInstance =  await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`);
        console.log(`\n MongoDB connected !! DB HOST :${connectionInstance.connection.host}`);
    }

    catch(error){
        console.log("Mongo DB connection error" , error);
        process.exit(1);
    }

}

export default connectDB;