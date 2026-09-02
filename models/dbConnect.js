import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI nahi mila .env me');
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false, // isse turant error milega, wait nahi karega
      bufferMaxEntries: 0,
      serverSelectionTimeoutMS: 5000, // 5 sec me fail ho jaye
    }).then((mongoose) => mongoose);
  }
  
  cached.conn = await cached.promise;
  return cached.conn;
}

export default dbConnect;