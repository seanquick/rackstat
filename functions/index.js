/**
 * Firebase Functions v2 - RACKSTAT
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();

setGlobalOptions({maxInstances: 10});

/**
 * Apply CORS headers for allowed origins.
 * @param {object} req Express request
 * @param {object} res Express response
 */
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
  res.set("Access-Control-Allow-Origin", "https://app.rackstatapp.com");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Max-Age", "3600");

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
 * Approve a pending parent access request.
 * Creates the parent link and registration code server-side.
 * @param {object} req Express request
 * @param {object} res Express response
 */
exports.approveParentAccessRequest = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "https://app.rackstatapp.com");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Max-Age", "3600");

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
    const coachUid = decodedToken.uid;

    const requestId = String(
        (req.body && req.body.requestId) || "",
    ).trim();

    if (!requestId) {
      sendError(res, 400, "Missing parent request ID.");
      return;
    }

    const db = admin.firestore();

    // Verify authenticated user is a coach/admin.
    const coachDoc = await db.collection("users").doc(coachUid).get();

    if (!coachDoc.exists) {
      sendError(res, 403, "User profile not found.");
      return;
    }

    const coachData = coachDoc.data();
    const coachRole = String(coachData.role || "").toLowerCase();
    const coachSchoolId =
      coachData.schoolId || coachData.school_id || "";

    if (coachRole !== "coach" && coachRole !== "admin") {
      sendError(res, 403, "Coach or admin access required.");
      return;
    }

    if (coachRole === "coach" && !coachSchoolId) {
      sendError(res, 403, "Coach account is missing a school link.");
      return;
    }

    // Load the request from Firestore rather than trusting browser data.
    const requestRef =
      db.collection("parent_access_requests").doc(requestId);

    const requestSnap = await requestRef.get();

    if (!requestSnap.exists) {
      sendError(res, 404, "Parent request could not be found.");
      return;
    }

    const requestData = requestSnap.data();
    const requestSchoolId =
      requestData.schoolId || requestData.school_id || "";

    if (!requestSchoolId) {
      sendError(res, 400, "Parent request is missing a school link.");
      return;
    }

    // Coaches may approve only requests from their own school.
    if (
      coachRole !== "admin" &&
      requestSchoolId !== coachSchoolId
    ) {
      sendError(res, 403, "Cross-school approval is not permitted.");
      return;
    }

    if (
      String(requestData.status || "").toLowerCase() !== "pending"
    ) {
      sendError(res, 409, "Parent request is no longer pending.");
      return;
    }

    const athleteId = String(requestData.athleteId || "").trim();

    if (!athleteId) {
      sendError(res, 400, "Parent request is missing an athlete.");
      return;
    }

    // Defense in depth: verify the athlete still belongs to the
    // same school represented by the request.
    const athleteDoc =
      await db.collection("users").doc(athleteId).get();

    if (!athleteDoc.exists) {
      sendError(res, 404, "Athlete account could not be found.");
      return;
    }

    const athleteData = athleteDoc.data();
    const athleteRole =
      String(athleteData.role || "").toLowerCase();
    const athleteSchoolId =
      athleteData.schoolId || athleteData.school_id || "";

    if (
      athleteRole !== "player" &&
      athleteRole !== "athlete"
    ) {
      sendError(res, 400, "Linked account is not an athlete.");
      return;
    }

    if (athleteSchoolId !== requestSchoolId) {
      sendError(res, 403, "Athlete school does not match request.");
      return;
    }

    // Generate the credential server-side.
    const registrationCode =
      `PARENT-${crypto.randomUUID()
          .replace(/-/g, "")
          .substring(0, 8)
          .toUpperCase()}`;

    const linkRef = db.collection("parent_links").doc();

    const batch = db.batch();

    batch.set(linkRef, {
      athleteId,
      athleteName:
        requestData.athleteName ||
        athleteData.fullName ||
        "Unknown Athlete",
      parentName: requestData.parentName || "",
      parentEmail: String(requestData.parentEmail || "")
          .toLowerCase()
          .trim(),
      parentPhone: requestData.parentPhone || "",
      relationship: requestData.relationship || "",
      schoolId: requestSchoolId,
      school_id: requestSchoolId,
      approvedBy: coachUid,
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "active",
      registrationCode,
      registrationCodeUsed: false,
    });

    batch.update(requestRef, {
      status: "approved",
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewedBy: coachUid,
      registrationCode,
    });

    await batch.commit();

    res.status(200).json({
      success: true,
      registrationCode,
    });
  } catch (err) {
    console.error("approveParentAccessRequest error:", err);
    sendError(res, 500, err.message || "Internal server error.");
  }
});

/**
 * Claim school registration code and create athlete/coach profile.
 * @param {object} req Express request
 * @param {object} res Express response
 */
exports.claimSchoolRegistrationCode = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "https://app.rackstatapp.com");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Max-Age", "3600");

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
    const uid = decodedToken.uid;
    const email = String(decodedToken.email || "").toLowerCase().trim();

    const body = req.body || {};
    const fullName = String(body.fullName || "").trim();
    const registrationCode = String(body.registrationCode || "")
        .toUpperCase()
        .trim();
    const requestedRole = String(body.role || "").toLowerCase().trim();
    const gradYear = String(body.gradYear || "").trim();

    const role = requestedRole === "coach" ? "coach" : "player";

    if (!email) {
      sendError(res, 400, "Account is missing an email.");
      return;
    }

    if (!fullName || !registrationCode) {
      sendError(res, 400, "Missing name or registration code.");
      return;
    }

    if (role === "player" && !gradYear) {
      sendError(res, 400, "Graduation year is required.");
      return;
    }

    const db = admin.firestore();

    const existingUser = await db.collection("users").doc(uid).get();

    if (existingUser.exists) {
      sendError(res, 400, "User profile already exists.");
      return;
    }

    let schoolId = "";

    const codeSnap = await db.collection("school_codes")
        .where("code", "==", registrationCode)
        .where("role", "==", role)
        .where("active", "==", true)
        .limit(1)
        .get();

    if (!codeSnap.empty) {
      const codeData = codeSnap.docs[0].data();
      schoolId = codeData.schoolId || codeData.school_id || "";
    } else {
      const codeField = role === "coach" ? "coach_code" : "player_code";

      const schoolSnap = await db.collection("schools")
          .where(codeField, "==", registrationCode)
          .limit(1)
          .get();

      if (schoolSnap.empty) {
        sendError(res, 404, "Invalid registration code.");
        return;
      }

      const schoolData = schoolSnap.docs[0].data();

      if (schoolData.active === false) {
        sendError(res, 403, "This school is inactive.");
        return;
      }

      schoolId = schoolSnap.docs[0].id;

      if (schoolSnap.empty) {
        sendError(res, 404, "Invalid registration code.");
        return;
      }

      schoolId = schoolSnap.docs[0].id;
    }

    if (!schoolId) {
      sendError(res, 400, "Registration code is missing a school link.");
      return;
    }

    const batch = db.batch();

    batch.set(db.collection("users").doc(uid), {
      fullName,
      email,
      role,
      schoolId,
      school_id: schoolId,
      gradYear: role === "player" ? gradYear : null,
      termsAccepted: true,
      termsAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      privacyAccepted: true,
      privacyAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      parentAcknowledged: role === "player",
      consentVersion: "v1_2026_04",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (role === "player") {
      batch.set(db.collection("recruiting_profiles").doc(uid), {
        fullName,
        schoolId,
        school_id: schoolId,
        gradYear,
        nextLevelComplete: false,
        offPrimary: "-",
        defPrimary: "-",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    batch.set(db.collection("data_access_logs").doc(), {
      action: "claim_school_registration_code",
      targetUid: uid,
      performedBy: uid,
      performedByRole: role,
      schoolId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      source: "signup",
    });

    await batch.commit();

    res.status(200).json({
      success: true,
      schoolId,
      role,
    });
  } catch (err) {
    console.error("claimSchoolRegistrationCode error:", err);
    sendError(res, 500, err.message || "Internal server error.");
  }
});

exports.logSensitiveDataAccess = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "https://app.rackstatapp.com");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Max-Age", "3600");

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
    const actorUid = decodedToken.uid;
    const actorEmail = String(decodedToken.email || "")
        .toLowerCase()
        .trim();

    const body = req.body || {};
    const athleteId = String(body.athleteId || "").trim() || null;
    const action = String(body.action || "").trim();
    const reason = String(body.reason || "").trim();

    if (!action) {
      sendError(res, 400, "Missing audit action.");
      return;
    }

    const db = admin.firestore();

    const actorDoc = await db.collection("users").doc(actorUid).get();

    if (!actorDoc.exists) {
      sendError(res, 403, "User profile not found.");
      return;
    }

    const actorData = actorDoc.data();
    const actorRole = String(actorData.role || "").toLowerCase();
    const schoolId = actorData.schoolId || actorData.school_id || "";

    if (!schoolId) {
      sendError(res, 403, "User is not linked to a school.");
      return;
    }

    let page = "";
    let source = "";
    let normalizedReason = reason;
    let athleteName = null;

    if (
      action === "view_team_lift_analytics" ||
      action === "view_team_meal_analytics"
    ) {
      if (actorRole !== "coach" && actorRole !== "admin") {
        sendError(res, 403, "Analytics access is not permitted.");
        return;
      }

      if (athleteId && actorRole !== "admin") {
        const athleteDoc = await db.collection("users").doc(athleteId).get();

        if (!athleteDoc.exists) {
          sendError(res, 404, "Athlete not found.");
          return;
        }

        const athleteData = athleteDoc.data();
        const athleteSchoolId =
          athleteData.schoolId || athleteData.school_id || "";

        if (athleteSchoolId !== schoolId) {
          sendError(res, 403, "Cross-school access is not permitted.");
          return;
        }
      }

      page = "analytics-vault.html";
      source = "analytics-vault";
      normalizedReason = normalizedReason || "coach_loaded_analytics_tab";
    } else if (action === "parent_view_athlete_data") {
      if (actorRole !== "parent") {
        sendError(res, 403, "Parent access is required.");
        return;
      }

      if (!athleteId) {
        sendError(res, 400, "Missing athleteId.");
        return;
      }

      const linkedAthletes = Array.isArray(actorData.linkedAthletes) ?
        actorData.linkedAthletes :
        [];

      if (!linkedAthletes.includes(athleteId)) {
        sendError(res, 403, "Parent is not linked to this athlete.");
        return;
      }

      const athleteDoc = await db.collection("users").doc(athleteId).get();

      if (!athleteDoc.exists) {
        sendError(res, 404, "Athlete not found.");
        return;
      }

      const athleteData = athleteDoc.data();
      const athleteSchoolId =
        athleteData.schoolId || athleteData.school_id || "";

      if (athleteSchoolId !== schoolId) {
        sendError(res, 403, "Cross-school access is not permitted.");
        return;
      }

      athleteName =
        athleteData.fullName ||
        `${athleteData.firstName || ""} ${athleteData.lastName || ""}`.trim() ||
        null;

      page = "parent-lobby.html";
      source = "parent-lobby";
      normalizedReason = normalizedReason || "parent_viewed_linked_athlete";
    } else {
      sendError(res, 400, "Unsupported audit action.");
      return;
    }

    const logRef = await db.collection("data_access_logs").add({
      actorUid,
      actorId: actorUid,
      actorRole,
      actorEmail,
      schoolId,
      athleteId,
      athleteName,
      action,
      reason: normalizedReason,
      page,
      source,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({
      success: true,
      logId: logRef.id,
    });
  } catch (err) {
    console.error("logSensitiveDataAccess error:", err);
    sendError(res, 500, err.message || "Internal server error.");
  }
});

/**
 * Submit parent access request using athlete email.
 * @param {object} req Express request
 * @param {object} res Express response
 */
exports.requestParentAccessByAthleteEmail = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "https://app.rackstatapp.com");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Max-Age", "3600");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({error: "Method not allowed."});
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
      res.status(400).json({error: "Required fields are missing."});
      return;
    }

    const db = admin.firestore();

    const athleteSnap = await db.collection("users")
        .where("email", "==", athleteEmail)
        .limit(1)
        .get();

    if (athleteSnap.empty) {
      res.status(404).json({error: "No athlete account was found."});
      return;
    }

    const athleteDoc = athleteSnap.docs[0];
    const athleteData = athleteDoc.data();
    const athleteRole = String(athleteData.role || "").toLowerCase();

    if (athleteRole !== "player" && athleteRole !== "athlete") {
      res.status(400).json({
        error: "Email does not belong to an athlete account.",
      });
      return;
    }

    const athleteId = athleteDoc.id;
    const schoolId = athleteData.schoolId || athleteData.school_id || "";

    if (!schoolId) {
      res.status(400).json({
        error: "Athlete account is missing a school link.",
      });
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
      res.status(409).json({
        error: "A pending parent access request already exists.",
      });
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
    res.status(500).json({
      error: err.message || "Internal server error.",
    });
  }
});
/**
 * Delete a user and all associated data (admin only).
 * @param {object} req Express request
 * @param {object} res Express response
 */
exports.deleteUserData = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "https://app.rackstatapp.com");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Max-Age", "3600");

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
