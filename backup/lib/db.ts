import { MongoClient } from 'mongodb';

function getMongoUri(): string {
  // Get URI from environment
  const envUri = process.env.BuildScape_MONGODB_URI || process.env.MONGODB_URI;

  // Validate it exists and is a string
  if (!envUri) {
    throw new Error("MongoDB URI is not configured. Please set MONGODB_URI environment variable.");
  }

  if (typeof envUri !== 'string') {
    throw new Error("MongoDB URI must be a string.");
  }

  // Convert to string and trim
  let uri = String(envUri).trim();
  
  if (!uri || uri.length === 0) {
    throw new Error("MongoDB URI is empty. Please set MONGODB_URI environment variable.");
  }

  // Ensure it's still a string after operations
  if (typeof uri !== 'string') {
    throw new Error("MongoDB URI must be a string.");
  }

  // Only modify if it's a mongodb+srv:// URI
  if (uri && typeof uri === 'string' && uri.startsWith('mongodb+srv://')) {
    if (!uri.includes('/buildscape_tracker')) {
      if (uri.includes('?')) {
        uri = uri.replace('?', '/buildscape_tracker?');
      } else {
        uri = uri + '/buildscape_tracker?retryWrites=true&w=majority';
      }
    }
    if (!uri.includes('retryWrites=true')) {
      uri = uri.includes('?') ? uri + '&retryWrites=true' : uri + '?retryWrites=true&w=majority';
    }
  }

  // Final validation
  if (!uri || typeof uri !== 'string' || uri.length === 0) {
    throw new Error("Invalid MongoDB URI after processing.");
  }

  return uri;
}

const options = {
  maxPoolSize: 10, // Increased from 1 to allow concurrent connections
  minPoolSize: 2, // Keep minimum connections alive for faster response
  serverSelectionTimeoutMS: 5000, // Reduced from 20s to 5s for faster failure detection
  socketTimeoutMS: 30000, // Reduced from 45s to 30s
  connectTimeoutMS: 10000, // Reduced from 20s to 10s
  retryWrites: true,
  directConnection: false,
  // Additional optimizations
  maxIdleTimeMS: 30000, // Close idle connections after 30s
  heartbeatFrequencyMS: 10000, // Check connection health every 10s
};

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

// Removed unused variables

async function createConnection(): Promise<MongoClient> {
  const uri = getMongoUri();
  let lastError: Error | null = null;
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = new MongoClient(uri, options);
      await client.connect();
      return client;
    } catch (error: any) {
      lastError = error;
      if (attempt === maxRetries) {
        console.error("MongoDB connection failed after retries:", error.message);
      }
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error("Failed to connect to MongoDB after retries");
}

// Lazy initialization - connection only created when promise is accessed
function getClientPromise(): Promise<MongoClient> {
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = createConnection().catch((err) => {
      console.error("MongoDB connection error:", err?.message || String(err));
      if (process.env.NODE_ENV === 'development') {
        console.error("Make sure MONGODB_URI is set in .env.local and MongoDB Atlas is accessible");
      }
      global._mongoClientPromise = undefined; // Reset so it can retry
      throw err;
    });
  }
  return global._mongoClientPromise;
}

// Export a promise that initializes lazily when first accessed
// This wrapper ensures no code runs at module load time
const clientPromise = (() => {
  let promise: Promise<MongoClient> | null = null;
  return new Proxy({} as Promise<MongoClient>, {
    get(_target, prop) {
      if (!promise) {
        promise = getClientPromise();
      }
      const value = (promise as any)[prop];
      return typeof value === 'function' ? value.bind(promise) : value;
    }
  });
})();

export default clientPromise;
export { getClientPromise };


