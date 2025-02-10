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

// Always use singleton pattern
if (!global._mongoClientPromise) {
	client = new MongoClient(uri, {
		serverApi: {
			version: ServerApiVersion.v1,
			strict: true,
			deprecationErrors: true,
		},
		maxPoolSize: 1, // Force single connection
		minPoolSize: 1,
		connectTimeoutMS: 30000,
		socketTimeoutMS: 60000,
		heartbeatFrequencyMS: 30000, // Keep connection alive
	});

	// Add error handling for production
	client.on("serverClosed", () => {
		console.log("MongoDB connection closed - resetting client");
		global._mongoClientPromise = client.connect(); // Auto-reconnect
	});

	global._mongoClientPromise = client.connect();
}

// eslint-disable-next-line prefer-const
clientPromise = global._mongoClientPromise;

// Add connection verification
clientPromise
	.then((connectedClient) => {
		console.log("MongoDB connection established");
		connectedClient.on("error", (err) => {
			console.error("MongoDB connection error:", err);
		});
	})
	.catch((err) => {
		console.error("MongoDB connection failed:", err);
	});

export default clientPromise;
