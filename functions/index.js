/**
 * Firebase Functions v2 - RACKSTAT
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

setGlobalOptions({maxInstances: 10});

const allowedOrigins = [
  "https://rackstat-production.web.app",
  "https://rackstat-production.firebaseapp.com",
  "http://localhost:5000",
  "http://localhost:5173",
];

/**
 * Applies CORS headers for approved origins.
 * @param {object} req Express request object.
 * @param {object} res Express response object.
 */
function setCorsHeaders(req, res) {
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  }

  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

/**
 * Sends a normalized JSON error response.
 * @param {object} res Express response object.
 * @param {number} status HTTP status code.
 * @param {string} message Error message.
 */
function sendError(res, status, message) {
  res.status(status).json({
    success: false,
    message,
  });
}

exports.deleteUserData = onRequest(async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    sendError(res, 405, "Method not allowed.");
    return;
  }

  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      sendError(res, 401, "Missing authorization token.");
      return;
    }

    const idToken = authHeader.split("Bearer ")[1];

    if (!idToken) {
      sendError(res, 401, "Invalid authorization token.");
      return;
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const requesterUid = decodedToken.uid;
    const db = admin.firestore();

    const requesterDoc = await db.collection("users").doc(requesterUid).get();

    if (!requesterDoc.exists || requesterDoc.data().role !== "admin") {
      sendError(res, 403, "Admin only.");
      return;
    }

    const targetUid = String(
        (req.body && req.body.targetUid) || "",
    ).trim();

    if (!targetUid) {
      sendError(res, 400, "Missing targetUid.");
      return;
    }

    if (targetUid === requesterUid) {
      sendError(res, 400, "Admins cannot delete their own account.");
      return;
    }

    const userRef = db.collection("users").doc(targetUid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      sendError(res, 404, "User not found.");
      return;
    }

    const userData = userDoc.data();
    const role = userData.role;

    const batch = db.batch();

    batch.delete(userRef);

    if (role === "player" || role === "athlete") {
      const profileRef = db.collection("recruiting_profiles").doc(targetUid);

      const maxesSnap = await profileRef.collection("maxes").get();
      maxesSnap.forEach((doc) => batch.delete(doc.ref));

      const mealsSnap = await profileRef.collection("meals").get();
      mealsSnap.forEach((doc) => batch.delete(doc.ref));

      batch.delete(profileRef);

      const workoutsByUid = await db.collection("completed_workouts")
          .where("uid", "==", targetUid)
          .get();

      workoutsByUid.forEach((doc) => batch.delete(doc.ref));

      const workoutsByAthleteId = await db.collection("completed_workouts")
          .where("athleteId", "==", targetUid)
          .get();

      workoutsByAthleteId.forEach((doc) => batch.delete(doc.ref));

      const links = await db.collection("parent_links")
          .where("athleteId", "==", targetUid)
          .get();

      links.forEach((doc) => batch.delete(doc.ref));
    }

    if (role === "parent") {
      const links = await db.collection("parent_links")
          .where("parentUid", "==", targetUid)
          .get();

      links.forEach((doc) => batch.delete(doc.ref));
    }

    await admin.auth().deleteUser(targetUid);
    await batch.commit();

    res.status(200).json({
      success: true,
    });
  } catch (err) {
    console.error("deleteUserData error:", err);
    sendError(res, 500, err.message || "Internal server error.");
  }
});
