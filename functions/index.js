/**
 * Firebase Functions v2 - RACKSTAT
 */

const {setGlobalOptions} = require("firebase-functions");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

setGlobalOptions({maxInstances: 10});

exports.deleteUserData = onCall(async (request) => {
  const context = request.auth;

  if (!context) {
    throw new HttpsError("unauthenticated", "Not logged in.");
  }

  const requesterUid = context.uid;
  const db = admin.firestore();

  const requesterDoc = await db.collection("users").doc(requesterUid).get();

  if (!requesterDoc.exists || requesterDoc.data().role !== "admin") {
    throw new HttpsError("permission-denied", "Admin only.");
  }

  const {targetUid} = request.data;

  if (!targetUid) {
    throw new HttpsError("invalid-argument", "Missing targetUid.");
  }

  const userRef = db.collection("users").doc(targetUid);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    throw new HttpsError("not-found", "User not found.");
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

  return {success: true};
});
