import dotenv from 'dotenv';
import connectDB from './db/db.js';
import { app } from './app.js';

dotenv.config({
    path: './.env'
})

// Start the server regardless of database connection
const startServer = async () => {
    try {
        // Try to connect to database
        const dbConnected = await connectDB();
        
        if (!dbConnected) {
            console.log("⚠️ Starting server without database connection");
            console.log("📝 Some features may not work properly");
        }
        
        // Start the server
        const port = process.env.PORT || 8000;
        app.listen(port, () => {
            console.log(`🚀 Server is running at port: ${port}`);
            console.log(`🌐 Server URL: https://mail-tracker-k1hl.onrender.com`);
        });
        
    } catch (err) {
        console.log("❌ Server startup failed:", err);
        process.exit(1);
    }
}

startServer();
