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
 * Apply CORS headers for allowed origins.
 * @param {object} req Express request
 * @param {object} res Express response
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
 * Send standardized JSON error response.
 * @param {object} res Express response
 * @param {number} status HTTP status code
 * @param {string} message Error message
 */
function sendError(res, status, message) {
  res.status(status).json({
    success: false,
    message,
  });
}
/**
 * Verify Firebase Auth bearer token.
 * @param {object} req Express request
 * @return {Promise<object>} Decoded token
 */
async function verifyBearerToken(req) {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("Missing authorization token.");
  }

  const idToken = authHeader.split("Bearer ")[1];

  if (!idToken) {
    throw new Error("Invalid authorization token.");
  }

  return admin.auth().verifyIdToken(idToken);
}
/**
 * Claim a parent registration code and create parent account.
 * @param {object} req Express request
 * @param {object} res Express response
 */
exports.claimParentRegistrationCode = onRequest(async (req, res) => {
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
    const decodedToken = await verifyBearerToken(req);
    const parentUid = decodedToken.uid;
    const parentEmail = String(decodedToken.email || "").toLowerCase().trim();

    const fullName = String((req.body && req.body.fullName) || "").trim();
    const registrationCode = String(
        (req.body && req.body.registrationCode) || "",
    ).toUpperCase().trim();

    if (!parentEmail) {
      sendError(res, 400, "Parent account is missing an email.");
      return;
    }

    if (!fullName || !registrationCode) {
      sendError(res, 400, "Missing parent name or registration code.");
      return;
    }

    const db = admin.firestore();
    const existingUser = await db.collection("users").doc(parentUid).get();

    if (existingUser.exists) {
      sendError(res, 400, "Parent profile already exists.");
      return;
    }

    const linksSnap = await db.collection("parent_links")
        .where("registrationCode", "==", registrationCode)
        .where("registrationCodeUsed", "==", false)
        .where("status", "==", "active")
        .limit(1)
        .get();

    if (linksSnap.empty) {
      sendError(res, 404, "Invalid or already-used parent registration code.");
      return;
    }

    const linkDoc = linksSnap.docs[0];
    const linkData = linkDoc.data();
    const approvedEmail = String(linkData.parentEmail || "")
        .toLowerCase()
        .trim();

    if (approvedEmail && approvedEmail !== parentEmail) {
      sendError(res, 403, "This code is assigned to a different email.");
      return;
    }

    const schoolId = linkData.schoolId || linkData.school_id || "";
    const athleteId = linkData.athleteId || "";

    if (!schoolId || !athleteId) {
      sendError(res, 400, "Parent link is missing required school data.");
      return;
    }

    const batch = db.batch();

    batch.set(db.collection("users").doc(parentUid), {
      fullName,
      email: parentEmail,
      role: "parent",
      schoolId,
      school_id: schoolId,
      linkedAthletes: [athleteId],
      termsAccepted: true,
      termsAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      privacyAccepted: true,
      privacyAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      parentAcknowledged: true,
      consentVersion: "v1_2026_04",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    batch.update(linkDoc.ref, {
      parentUid,
      parentEmail,
      registrationCodeUsed: true,
      registrationCodeUsedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    batch.set(db.collection("data_access_logs").doc(), {
      action: "claim_parent_registration_code",
      targetUid: athleteId,
      parentUid,
      performedBy: parentUid,
      performedByRole: "parent",
      schoolId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      source: "signup",
    });

    await batch.commit();

    res.status(200).json({
      success: true,
      schoolId,
      athleteId,
    });
  } catch (err) {
    console.error("claimParentRegistrationCode error:", err);
    sendError(res, 500, err.message || "Internal server error.");
  }
});
/**
 * Submit parent access request using athlete email.
 * @param {object} req Express request
 * @param {object} res Express response
 */
exports.requestParentAccessByAthleteEmail = onRequest(async (req, res) => {
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
    const body = req.body || {};
    const parentName = String(body.parentName || "").trim();
    const parentEmail = String(body.parentEmail || "").toLowerCase().trim();
    const parentPhone = String(body.parentPhone || "").trim();
    const relationship = String(body.relationship || "").trim();
    const athleteEmail = String(body.athleteEmail || "").toLowerCase().trim();

    if (!athleteEmail || !parentName || !parentEmail || !relationship) {
      sendError(res, 400, "Required fields are missing.");
      return;
    }

    const db = admin.firestore();

    const athleteSnap = await db.collection("users")
        .where("email", "==", athleteEmail)
        .limit(1)
        .get();

    if (athleteSnap.empty) {
      sendError(res, 404, "No athlete account was found.");
      return;
    }

    const athleteDoc = athleteSnap.docs[0];
    const athleteData = athleteDoc.data();
    const athleteRole = String(athleteData.role || "").toLowerCase();

    if (athleteRole !== "player" && athleteRole !== "athlete") {
      sendError(res, 400, "Email does not belong to an athlete account.");
      return;
    }

    const athleteId = athleteDoc.id;
    const schoolId = athleteData.schoolId || athleteData.school_id || "";

    if (!schoolId) {
      sendError(res, 400, "Athlete account is missing a school link.");
      return;
    }

    const athleteName = athleteData.fullName ||
      `${athleteData.firstName || ""} ${athleteData.lastName || ""}`.trim() ||
      "Unknown Athlete";

    const existingPending = await db.collection("parent_access_requests")
        .where("athleteId", "==", athleteId)
        .where("parentEmail", "==", parentEmail)
        .where("status", "==", "pending")
        .limit(1)
        .get();

    if (!existingPending.empty) {
      sendError(res, 409, "A pending parent access request already exists.");
      return;
    }

    await db.collection("parent_access_requests").add({
      athleteId,
      uid: athleteId,
      athleteName,
      athleteEmail,
      parentName,
      parentEmail,
      parentPhone,
      relationship,
      schoolId,
      school_id: schoolId,
      status: "pending",
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      source: "public_parent_request",
    });

    res.status(200).json({
      success: true,
      message: "Parent access request submitted.",
    });
  } catch (err) {
    console.error("requestParentAccessByAthleteEmail error:", err);
    sendError(res, 500, err.message || "Internal server error.");
  }
});
/**
 * Delete a user and all associated data (admin only).
 * @param {object} req Express request
 * @param {object} res Express response
 */
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
    const decodedToken = await verifyBearerToken(req);
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

    await batch.commit();

    await db.collection("data_access_logs").add({
      action: "delete_user_data",
      targetUid,
      targetRole: role || null,
      performedBy: requesterUid,
      performedByRole: "admin",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      source: "admin-lobby",
    });

    await admin.auth().deleteUser(targetUid);

    res.status(200).json({
      success: true,
    });
  } catch (err) {
    console.error("deleteUserData error:", err);
    sendError(res, 500, err.message || "Internal server error.");
  }
});
