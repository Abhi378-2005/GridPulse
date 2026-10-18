import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });
dotenv.config(); // Also check local .env

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/gridpulse?replicaSet=rs0';

/**
 * Connect to MongoDB. Reuses existing connection if already connected.
 * MongoDB must be running as a replica set for transaction support (LedgerService).
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  try {
    await mongoose.connect(MONGO_URL, {
      // Connection pool settings
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      heartbeatFrequencyMS: 10000,
    });

    console.log('🗄️  Connected to MongoDB');

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected');
    });

    return mongoose;
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    throw error;
  }
}

/**
 * Disconnect from MongoDB gracefully.
 */
export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  console.log('🗄️  Disconnected from MongoDB');
}
