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
    limit,
    addDoc, 
    serverTimestamp 
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
        loadSchoolActivity(); // <--- Added this call
    } catch (error) {
        console.error("Auth Error:", error);
    }
});

// --- ENGINE 1: AGGREGATE METRICS ---
async function renderMetrics() {
    try {
        // User Counts
        const athleteCount = await getCount(query(collection(db, "users"), where("role", "==", "player"))); // Changed from 'athlete' to 'player'
        const coachCount = await getCount(query(collection(db, "users"), where("role", "==", "coach")));

        document.getElementById('count-athletes').innerText = athleteCount;
        document.getElementById('count-coaches').innerText = coachCount;
        document.getElementById('total-users').innerText = athleteCount + coachCount;

        // Activity Counts - Using try/catch specifically for these in case collections don't exist yet
        let workoutCount = 0;
        let mealCount = 0;

        try { workoutCount = await getCount(collection(db, "completed_workouts")); } catch(e) { console.warn("Workouts coll empty"); }
        try { mealCount = await getCount(collection(db, "meals")); } catch(e) { console.warn("Meals coll empty"); }
        
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

        if (snap.empty) {
            listEl.innerHTML = '<p class="p-6 text-xs text-gray-600 italic text-center">No recent activity.</p>';
            return;
        }

        snap.forEach(doc => {
            const data = doc.data();
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
    }
}

// --- ENGINE 3: ACTIVE SCHOOLS ---
async function loadSchoolActivity() {
    try {
        const q = query(collection(db, "schools"), limit(10));
        const snap = await getDocs(q);
        const container = document.getElementById('school-list');

        if (!container) return;
        container.innerHTML = '';

        if (snap.empty) {
            container.innerHTML = '<p class="p-6 text-xs text-gray-600 italic text-center">No schools registered yet.</p>';
            return;
        }

        snap.forEach(doc => {
            const school = doc.data();
            const row = document.createElement('div');
            row.className = "p-4 flex justify-between items-center hover:bg-white/[0.02] transition";
            row.innerHTML = `
                <div>
                    <p class="font-bold text-sm">${school.name || 'Unnamed School'}</p>
                    <p class="text-[10px] text-gray-500 uppercase">${school.city || 'Unknown'}, ${school.state || '--'}</p>
                </div>
                <div class="text-right">
                    <span class="text-[10px] bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full border border-blue-500/20 uppercase font-bold">Active</span>
                </div>
            `;
            container.appendChild(row);
        });
    } catch (err) {
        console.error("School Load Error:", err);
    }
}

// --- ENGINE 4: GLOBAL ANNOUNCEMENTS ---
const postBtn = document.getElementById('post-announcement');
const announcementInput = document.getElementById('announcement-text');

if (postBtn) {
    postBtn.onclick = async () => {
        const text = announcementInput.value.trim();
        if (!text) return alert("Please enter a message.");

        try {
            await addDoc(collection(db, "system_announcements"), {
                message: text,
                timestamp: serverTimestamp(),
                postedBy: auth.currentUser.uid,
                active: true
            });

            announcementInput.value = ''; // Clear input
            alert("Announcement published successfully!");
        } catch (err) {
            console.error("Error posting announcement:", err);
            alert("Failed to post: Check security rules.");
        }
    };
}

// --- UTILITY ---
async function getCount(queryOrColl) {
    try {
        const snap = await getAggregateFromServer(queryOrColl, {
            total: count()
        });
        return snap.data().total;
    } catch (e) {
        return 0;
    }
}

// Add this at the bottom of js/admin-lobby.js
const logoutBtn = document.querySelector("button[onclick*='index.html']");

if (logoutBtn) {
    // Remove the inline onclick from the HTML to avoid conflicts
    logoutBtn.removeAttribute('onclick'); 
    
    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await signOut(auth);
            console.log("Logged out successfully");
            // Use replace to prevent the "back" button from returning here
            window.location.replace('index.html'); 
        } catch (err) {
            console.error("Logout failed:", err);
        }
    });
}