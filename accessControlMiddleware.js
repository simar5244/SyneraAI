"use strict";

const { MongoClient } = require("mongodb");

// Cached MongoDB client to reuse connection pool
let cachedClient = null;

// Initialize or return the cached MongoClient instance
async function getMongoClient() {
  if (cachedClient) {
    console.log("[MongoClient] Cached instance found, reusing existing connection.");
    return cachedClient;
  }
  console.log("[MongoClient] No cached instance found. Initializing new connection to MongoDB...");
  try {
    const client = new MongoClient(process.env.MONGO_URI, {
      useUnifiedTopology: true,
    });
    await client.connect();
    console.log("[MongoClient] Connected successfully.");
    cachedClient = client;
    console.log("[MongoClient] Cached client has been set.");
    return client;
  } catch (err) {
    console.error("[MongoClient] Error initializing connection:", err);
    throw err;
  }
}

// Fetch active user count without closing the connection after each request
async function getActiveUserCount(companyCode) {
  console.log(`[getActiveUserCount] Attempting to fetch active user count for company code: ${companyCode}`);
  try {
    const client = await getMongoClient();
    const dbName = `company_${companyCode.toLowerCase()}`;
    const db = client.db(dbName);
    // Adjust the query according to your schema (e.g., if using an "active" field).
    const count = await db.collection("users").countDocuments({ active: true });
    console.log(`[getActiveUserCount] Active user count for database ${dbName}: ${count}`);
    return count;
  } catch (err) {
    console.error("[getActiveUserCount] Error fetching active user count:", err);
    return null;
  }
}

// Access Control Middleware
async function accessControlMiddleware(req, res, next) {
  console.log("[AccessControlMiddleware] Incoming request:", req.method, req.originalUrl);
  // Retrieve the logged-in user and company code from session
  const user = req.session && req.session.user;
  const companyCode = req.session && req.session.companyCode;
  const requestPath = req.path;

  console.log("[AccessControlMiddleware] Session user:", user);
  console.log("[AccessControlMiddleware] Company code:", companyCode);
  console.log("[AccessControlMiddleware] Request path:", requestPath);

  // Allow unauthenticated requests (e.g., login or public pages)
  if (!user || !companyCode) {
    console.log("[AccessControlMiddleware] No user or company code present. Bypassing access control.");
    return next();
  }

  // Rule 1: Non-admin users who haven't paid are redirected to /account-inactive.
  if (!user.isAdmin && !user.paid) {
    console.log("[AccessControlMiddleware] Rule 1 triggered: Non-admin user with unpaid account.");
    if (requestPath !== "/account-inactive") {
      console.log("[AccessControlMiddleware] Redirecting to /account-inactive.");
      return res.redirect("/account-inactive");
    }
    return next();
  }

  // Rule 2: Admin users who haven't paid should see only billing pages.
  if (user.isAdmin && !user.paid) {
    console.log("[AccessControlMiddleware] Rule 2 triggered: Admin user with unpaid account.");
    if (!requestPath.startsWith("/billing")) {
      console.log("[AccessControlMiddleware] Redirecting to /subscription-required.");
      return res.redirect("/subscription-required");
    }
    return next();
  }

  // Rule 3: Check company active user count against the plan limit.
  const activeCount = await getActiveUserCount(companyCode);
  console.log("[AccessControlMiddleware] Fetched active user count:", activeCount, "| User plan limit:", user.planLimit);
  if (activeCount !== null && activeCount > user.planLimit) {
    console.log("[AccessControlMiddleware] Rule 3 triggered: Active user count exceeds plan limit.");
    if (!requestPath.startsWith("/billing")) {
      console.log("[AccessControlMiddleware] Redirecting to /upgrade-plan.");
      return res.redirect("/upgrade-plan");
    }
  }

  console.log("[AccessControlMiddleware] All checks passed. Proceeding with request.");
  // All access checks passed – allow further processing.
  return next();
}

module.exports = accessControlMiddleware;
