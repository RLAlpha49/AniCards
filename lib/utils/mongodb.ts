import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
	throw new Error("MONGODB_URI environment variable not defined");
}

declare global {
	// eslint-disable-next-line no-var
	var mongooseCache: {
		conn: typeof mongoose | null;
		promise: Promise<typeof mongoose> | null;
	};
}

// Initialize cache
let cached = global.mongooseCache;
if (!cached) {
	global.mongooseCache = { conn: null, promise: null };
	cached = global.mongooseCache;
}

// Serverless-optimized connection config
const config = {
	bufferCommands: false,
	maxPoolSize: 1,
	minPoolSize: 1,
	socketTimeoutMS: 30000,
	serverSelectionTimeoutMS: 5000,
	heartbeatFrequencyMS: 10000,
	maxIdleTimeMS: 10000,
	waitQueueTimeoutMS: 5000,
};

export async function connectToDatabase() {
	// Reuse existing connection if available
	if (cached.conn && cached.conn.connection.readyState === 1) {
		return cached.conn;
	}

	// Create new connection if none exists
	if (!cached.promise) {
		console.log("🌀 Creating new MongoDB connection");
		cached.promise = mongoose
			.connect(MONGODB_URI, {
				...config,
				dbName: "anicards",
			})
			.then((mongoose) => {
				console.log("✅ MongoDB connection established to anicards database");
				return mongoose;
			})
			.catch((err) => {
				console.error("❌ MongoDB connection failed:", err);
				cached.promise = null;
				throw err;
			});
	}

	try {
		cached.conn = await cached.promise;
	} catch (err) {
		cached.promise = null;
		throw err;
	}

	return cached.conn;
}
