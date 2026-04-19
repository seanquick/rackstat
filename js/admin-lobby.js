// Import shared Firebase services from the local js folder
// Since this file is already inside /js, the correct relative path is ./firebase-config.js
import { db, auth } from './firebase-config.js';

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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

// Auth guard for the admin lobby
// Ensures only signed-in users with admin role can access this page
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace('index.html');
        return;
    }

    try {
        // Load the signed-in user's Firestore profile
        const userSnap = await getDoc(doc(db, "users", user.uid));

        // Redirect if the account is missing or not an admin
        if (!userSnap.exists() || userSnap.data().role !== 'admin') {
            console.warn("Unauthorized Access Attempt");
            window.location.replace('index.html');
            return;
        }

        // Initialize all dashboard modules after successful admin verification
        renderMetrics();
        getRecentPulse();
        loadSchoolActivity();
    } catch (error) {
        console.error("Auth Error:", error);
    }
});

// Loads aggregate counts for users and app activity
async function renderMetrics() {
    try {
        // Count athlete and coach user records
        const athleteCount = await getCount(query(collection(db, "users"), where("role", "==", "player")));
        const coachCount = await getCount(query(collection(db, "users"), where("role", "==", "coach")));

        // Update top-level user metrics in the dashboard
        document.getElementById('count-athletes').innerText = athleteCount;
        document.getElementById('count-coaches').innerText = coachCount;
        document.getElementById('total-users').innerText = athleteCount + coachCount;

        // Count activity collections
        let workoutCount = 0;
        let mealCount = 0;

        try {
            workoutCount = await getCount(collection(db, "completed_workouts"));
        } catch (e) {
            console.warn("Workouts empty");
        }

        try {
            mealCount = await getCount(collection(db, "meals"));
        } catch (e) {
            console.warn("Meals empty");
        }
        
        // Update dashboard activity totals
        document.getElementById('count-workouts').innerText = workoutCount;
        document.getElementById('count-meals').innerText = mealCount;
        document.getElementById('total-activity').innerText = workoutCount + mealCount;

    } catch (err) {
        console.error("Metric Load Error:", err);
    }
}

// Loads the most recent completed workout activity into the pulse feed
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

        // Empty state for no recent activity
        if (snap.empty) {
            listEl.innerHTML = '<p class="p-6 text-xs text-gray-600 italic text-center">No recent activity.</p>';
            return;
        }

        // Render the latest workout activity items
        snap.forEach(docSnap => {
            const data = docSnap.data();
            const time = data.timestamp
                ? data.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : "Recent";
            
            const item = document.createElement('div');
            item.className = "flex justify-between items-center p-3 border-b border-white/5 text-xs";
            item.innerHTML = `
                <span class="text-gray-400">Activity: <b class="text-white">${data.workoutName || 'Workout'}</b></span>
                <span class="text-orange-500 font-mono">${time}</span>
            `;
            listEl.appendChild(item);
        });
    } catch (err) {
        console.error("Pulse Error:", err);
    }
}

// Loads a quick list of registered schools for the admin overview panel
async function loadSchoolActivity() {
    try {
        const snap = await getDocs(query(collection(db, "schools"), limit(10)));
        const container = document.getElementById('school-list');
        if (!container) return;

        container.innerHTML = '';

        // Empty state if no schools exist
        if (snap.empty) {
            container.innerHTML = '<p class="p-6 text-xs text-gray-600 italic text-center">No schools registered.</p>';
            return;
        }

        // Render school summary cards/rows
        snap.forEach(docSnap => {
            const school = docSnap.data();
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

// Centralized click handling for admin actions
document.addEventListener('click', async (e) => {
    // Handles admin sign-out action
    if (e.target && e.target.id === 'admin-logout-btn') {
        e.preventDefault();
        try {
            await signOut(auth);
            window.location.replace('index.html');
        } catch (err) {
            console.error("Logout failed:", err);
        }
    }

    // Handles posting a new system-wide announcement
    if (e.target && e.target.id === 'post-announcement') {
        const input = document.getElementById('announcement-text');
        const text = input.value.trim();

        if (!text) return alert("Please enter a message.");

        try {
            await addDoc(collection(db, "system_announcements"), {
                message: text,
                timestamp: serverTimestamp(),
                postedBy: auth.currentUser.uid,
                active: true
            });

            input.value = '';
            alert("Announcement published successfully!");
        } catch (err) {
            console.error("Announcement Error:", err);
        }
    }
});

// Utility helper for Firestore aggregate counts
// Accepts either a collection reference or a query
async function getCount(queryOrColl) {
    try {
        const snap = await getAggregateFromServer(queryOrColl, { total: count() });
        return snap.data().total;
    } catch (e) {
        return 0;
    }
}