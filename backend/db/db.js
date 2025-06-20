import mongoose from 'mongoose';

const connectDB = async () => {
    const DB_NAME = 'mailTracker-DB';

    try {
        if (!process.env.MONGO_URI) {
            console.log("⚠️ MONGO_URI not found in environment variables");
            console.log("📝 Please set MONGO_URI in your Render environment variables");
            console.log("📝 Example: mongodb+srv://username:password@cluster.mongodb.net/");
            return false;
        }

        const connectionInstance = await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`);
        console.log(`\n ✅ MongoDB connected !! DB HOST :${connectionInstance.connection.host}`);
        return true;
    } catch (error) {
        console.log("❌ MongoDB connection error:", error);
        console.log("📝 Please check your MONGO_URI in Render environment variables");
        return false;
    }
}

export default connectDB;