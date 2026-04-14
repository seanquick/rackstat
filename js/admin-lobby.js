// Since this file is INSIDE the /js folder, we use ./ to find its roommate
import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    collection, 
    query, 
    where, 
    count, 
    getAggregateFromServer,
    doc,
    getDoc,
    getDocs,
    orderBy,
    limit 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- AUTH PROTECTOR ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Verify Admin Role in Firestore
    try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (!userSnap.exists() || userSnap.data().role !== 'admin') {
            alert("Unauthorized Access");
            window.location.href = 'index.html';
            return;
        }

        // If verified, run the dashboard engines
        renderMetrics();
        getRecentPulse();
    } catch (error) {
        console.error("Auth Error:", error);
    }
});

// --- ENGINE 1: AGGREGATE METRICS ---
async function renderMetrics() {
    try {
        // User Counts
        const athleteCount = await getCount(query(collection(db, "users"), where("role", "==", "athlete")));
        const coachCount = await getCount(query(collection(db, "users"), where("role", "==", "coach")));
        
        document.getElementById('count-athletes').innerText = athleteCount;
        document.getElementById('count-coaches').innerText = coachCount;
        document.getElementById('total-users').innerText = athleteCount + coachCount;

        // Activity Counts
        const workoutCount = await getCount(collection(db, "completed_workouts"));
        const mealCount = await getCount(collection(db, "meals"));
        
        document.getElementById('count-workouts').innerText = workoutCount;
        document.getElementById('count-meals').innerText = mealCount;
        document.getElementById('total-activity').innerText = workoutCount + mealCount;

    } catch (err) {
        console.error("Metric Load Error:", err);
    }
}

// --- ENGINE 2: RECENT PULSE FEED ---
async function getRecentPulse() {
    try {
        const q = query(
            collection(db, "completed_workouts"), 
            orderBy("timestamp", "desc"), 
            limit(5)
        );
        
        const snap = await getDocs(q);
        const listEl = document.getElementById('pulse-list');
        
        if (!listEl) return;
        listEl.innerHTML = '';

        snap.forEach(doc => {
            const data = doc.data();
            // Fallback for missing timestamps to prevent crash
            const time = data.timestamp ? data.timestamp.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "Recent";
            
            const item = document.createElement('div');
            item.className = "flex justify-between items-center p-3 border-b border-white/5 text-xs";
            item.innerHTML = `
                <span class="text-gray-400">Activity logged: <b class="text-white">${data.workoutName || 'Workout'}</b></span>
                <span class="text-orange-500 font-mono">${time}</span>
            `;
            listEl.appendChild(item);
        });
    } catch (err) {
        console.error("Pulse Load Error:", err);
        // Common fix: You might need to create a Firestore Index if you see an error in the console
    }
}

// --- UTILITY ---
async function getCount(queryOrColl) {
    const snap = await getAggregateFromServer(queryOrColl, {
        total: count()
    });
    return snap.data().total;
}