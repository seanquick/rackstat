
import { readFileSync } from "node:fs";
import {
    initializeTestEnvironment,
    assertFails
} from "@firebase/rules-unit-testing";

const testEnv = await initializeTestEnvironment({
    projectId: "rackstat-production",
    firestore: {
        host: "127.0.0.1",
        port: 8080,
        rules: readFileSync("firestore.rules", "utf8")
    }
});

try {
    const attacker = testEnv.authenticatedContext("security_test_user");
    const db = attacker.firestore();

    const userRef = db.collection("users").doc("security_test_user");

    await assertFails(
        userRef.set({
            fullName: "Unauthorized Coach",
            role: "coach",
            schoolId: "fairbanks_hs",
            school_id: "fairbanks_hs"
        })
    );

    console.log("PASS: Unauthorized coach account creation was denied.");
} catch (error) {
    console.error("FAIL: Security test did not pass.", error);
    process.exitCode = 1;
} finally {
    await testEnv.cleanup();
}
