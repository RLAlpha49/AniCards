import { MongoClient, ServerApiVersion } from "mongodb";

const uri = process.env.MONGODB_URI!;

if (!uri) {
	throw new Error("MONGODB_URI environment variable not defined");
}

declare global {
	// eslint-disable-next-line no-var
	var _mongoClientPromise: Promise<MongoClient>;
}

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
	// In development mode, use a global variable to preserve the connection
	if (!global._mongoClientPromise) {
		client = new MongoClient(uri, {
			serverApi: {
				version: ServerApiVersion.v1,
				strict: true,
				deprecationErrors: true,
			},
			maxPoolSize: 1, // Single connection in development
			minPoolSize: 1,
		});
		global._mongoClientPromise = client.connect();
	}
	clientPromise = global._mongoClientPromise;
} else {
	// In production mode, create a new connection
	client = new MongoClient(uri, {
		serverApi: {
			version: ServerApiVersion.v1,
			strict: true,
			deprecationErrors: true,
		},
		maxPoolSize: 10, // Connection pool size
		minPoolSize: 2,   // Keep at least 2 connections warm
		connectTimeoutMS: 30000, // 30 seconds connection timeout
		socketTimeoutMS: 60000,  // 60 seconds socket timeout
	});
	clientPromise = client.connect();
}

export default clientPromise;
