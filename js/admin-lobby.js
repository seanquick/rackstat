import { db, auth } from './firebase-config.js';

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, count, getAggregateFromServer, doc, getDoc, getDocs, deleteDoc, updateDoc, orderBy, limit, addDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentAdminUid = null;

// Auth guard for the admin lobby
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace('index.html');
        return;
    }

    try {
        const userSnap = await getDoc(doc(db, "users", user.uid));

        if (!userSnap.exists() || userSnap.data().role !== 'admin') {
            console.warn("Unauthorized Access Attempt");
            window.location.replace('index.html');
            return;
        }

        currentAdminUid = user.uid;

        renderMetrics();
        getRecentPulse();
        loadSchoolActivity();
        bindAdminActions();
    } catch (error) {
        console.error("Auth Error:", error);
    }
});

// Loads aggregate counts for users and app activity
async function renderMetrics() {
    try {
        const athleteCount = await getCount(query(collection(db, "users"), where("role", "==", "player")));
        const coachCount = await getCount(query(collection(db, "users"), where("role", "==", "coach")));

        document.getElementById('count-athletes').innerText = athleteCount;
        document.getElementById('count-coaches').innerText = coachCount;
        document.getElementById('total-users').innerText = athleteCount + coachCount;

        let workoutCount = 0;
        let mealCount = 0;
        let profileCount = 0;
        let metricCount = 0;

        try {
            workoutCount = await getCount(collection(db, "completed_workouts"));
        } catch (e) {
            console.warn("Workouts empty");
        }

        try {
            mealCount = await getCount(collection(db, "meals"));
        } catch (e) {
            console.warn("Top-level meals empty");
        }

        try {
            profileCount = await getCount(collection(db, "recruiting_profiles"));
        } catch (e) {
            console.warn("Recruiting profiles empty");
        }

        try {
            metricCount = await getCount(collection(db, "metrics"));
        } catch (e) {
            console.warn("Metrics empty");
        }

        document.getElementById('count-workouts').innerText = workoutCount;
        document.getElementById('count-meals').innerText = mealCount;
        document.getElementById('total-activity').innerText = workoutCount + mealCount;

        document.getElementById('count-profiles').innerText = profileCount;
        document.getElementById('count-metrics').innerText = metricCount;
        document.getElementById('total-profiles').innerText = profileCount;
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

        if (snap.empty) {
            listEl.innerHTML = '<p class="p-6 text-xs text-gray-600 italic text-center">No recent activity.</p>';
            return;
        }

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

        if (snap.empty) {
            container.innerHTML = '<p class="p-6 text-xs text-gray-600 italic text-center">No schools registered.</p>';
            return;
        }

        snap.forEach(docSnap => {
            const school = docSnap.data();
            const row = document.createElement('div');
            row.className = "p-4 flex justify-between items-center hover:bg-white/[0.02] transition";
            row.innerHTML = `
                <div>
                    <p class="font-bold text-sm">${school.name || 'Unnamed School'}</p>
                    <p class="text-[10px] text-gray-500 uppercase">${docSnap.id}</p>
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

function bindAdminActions() {
    const logoutBtn = document.getElementById('admin-logout-btn');
    const announcementBtn = document.getElementById('post-announcement');
    const createSchoolBtn = document.getElementById('create-school-btn');
    const resetSchoolFormBtn = document.getElementById('reset-school-form-btn');

    if (logoutBtn && !logoutBtn.dataset.bound) {
        logoutBtn.dataset.bound = 'true';
        logoutBtn.addEventListener('click', handleLogout);
    }

    if (announcementBtn && !announcementBtn.dataset.bound) {
        announcementBtn.dataset.bound = 'true';
        announcementBtn.addEventListener('click', handleAnnouncementPost);
    }

    if (createSchoolBtn && !createSchoolBtn.dataset.bound) {
        createSchoolBtn.dataset.bound = 'true';
        createSchoolBtn.addEventListener('click', handleCreateSchool);
    }

    if (resetSchoolFormBtn && !resetSchoolFormBtn.dataset.bound) {
        resetSchoolFormBtn.dataset.bound = 'true';
        resetSchoolFormBtn.addEventListener('click', resetSchoolForm);
    }
}

async function handleLogout(e) {
    e.preventDefault();
    try {
        await signOut(auth);
        window.location.replace('index.html');
    } catch (err) {
        console.error("Logout failed:", err);
    }
}

async function handleAnnouncementPost() {
    const input = document.getElementById('announcement-text');
    const expirationInput = document.getElementById('announcement-expiration');

    const text = input?.value.trim() || "";
    const expirationValue = expirationInput?.value || "";

    if (!text) {
        alert("Please enter a message.");
        return;
    }

    try {
        const payload = {
            message: text,
            timestamp: serverTimestamp(),
            postedBy: auth.currentUser?.uid || null,
            active: true
        };

        if (expirationValue) {
            const expiresAt = new Date(`${expirationValue}T23:59:59`);
            if (!Number.isNaN(expiresAt.getTime())) {
                payload.expiresAt = expiresAt;
            }
        }

        await addDoc(collection(db, "system_announcements"), payload);

        if (input) input.value = '';
        if (expirationInput) expirationInput.value = '';

        alert("Announcement published successfully!");
    } catch (err) {
        console.error("Announcement Error:", err);
        alert("Unable to publish announcement.");
    }
}

await loadAnnouncements();

function slugifySchoolName(text = "") {
    return String(text)
        .toLowerCase()
        .trim()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

function randomCode(length = 8) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < length; i += 1) {
        out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
}

async function generateUniqueRegistrationCode(fieldName) {
    for (let i = 0; i < 20; i += 1) {
        const code = randomCode(8);
        const existing = await getDocs(query(collection(db, "schools"), where(fieldName, "==", code), limit(1)));
        if (existing.empty) {
            return code;
        }
    }

    throw new Error(`Unable to generate unique ${fieldName}. Please try again.`);
}

function getCheckedValues(selector) {
    return Array.from(document.querySelectorAll(selector))
        .filter(el => el.checked)
        .map(el => String(el.value || "").trim())
        .filter(Boolean);
}

function setSchoolCreateStatus(text, tone = "neutral") {
    const statusEl = document.getElementById('school-create-status');
    if (!statusEl) return;

    statusEl.innerText = text;
    statusEl.className = "text-[11px] font-bold uppercase tracking-widest";

    if (tone === "success") {
        statusEl.classList.add("text-emerald-400");
    } else if (tone === "error") {
        statusEl.classList.add("text-red-400");
    } else if (tone === "warn") {
        statusEl.classList.add("text-yellow-300");
    } else {
        statusEl.classList.add("text-gray-500");
    }
}

function showCreatedSchoolResult({ schoolId, name, coachCode, playerCode }) {
    const wrapper = document.getElementById('created-school-result');
    if (!wrapper) return;

    wrapper.classList.remove('hidden');
    document.getElementById('result-school-id').innerText = schoolId;
    document.getElementById('result-school-name').innerText = name;
    document.getElementById('result-coach-code').innerText = coachCode;
    document.getElementById('result-player-code').innerText = playerCode;
}

function resetSchoolForm() {
    const nameInput = document.getElementById('new-school-name');
    const primaryColorInput = document.getElementById('new-school-primary-color');
    const logoUrlInput = document.getElementById('new-school-logo-url');
    const formulaInput = document.getElementById('new-school-formula');
    const clubStartInput = document.getElementById('new-school-club-start');
    const recruitingInput = document.getElementById('new-school-recruiting-enabled');
    const resultBox = document.getElementById('created-school-result');

    if (nameInput) nameInput.value = "";
    if (primaryColorInput) primaryColorInput.value = "#b91c1c";
    if (logoUrlInput) logoUrlInput.value = "";
    if (formulaInput) formulaInput.value = "power_index";
    if (clubStartInput) clubStartInput.value = "50";
    if (recruitingInput) recruitingInput.checked = true;

    document.querySelectorAll('.new-school-tracked-lift').forEach(el => {
        el.checked = ["bench", "squat", "clean"].includes(el.value);
    });

    document.querySelectorAll('.new-school-scoring-lift').forEach(el => {
        el.checked = ["bench", "squat", "clean"].includes(el.value);
    });

    if (resultBox) resultBox.classList.add('hidden');

    setSchoolCreateStatus("Ready");
}

async function generateUniqueSchoolId(baseName) {
    const baseSlug = slugifySchoolName(baseName) || "school";
    let candidate = baseSlug;
    let counter = 1;

    while (true) {
        const existing = await getDoc(doc(db, "schools", candidate));
        if (!existing.exists()) {
            return candidate;
        }
        counter += 1;
        candidate = `${baseSlug}-${counter}`;
    }
}

async function handleCreateSchool() {
    const createBtn = document.getElementById('create-school-btn');
    const schoolNameInput = document.getElementById('new-school-name');
    const primaryColorInput = document.getElementById('new-school-primary-color');
    const logoUrlInput = document.getElementById('new-school-logo-url');
    const formulaInput = document.getElementById('new-school-formula');
    const clubStartInput = document.getElementById('new-school-club-start');
    const recruitingInput = document.getElementById('new-school-recruiting-enabled');

    const schoolName = schoolNameInput?.value.trim() || "";
    const primaryColor = primaryColorInput?.value || "#b91c1c";
    const logoUrl = logoUrlInput?.value.trim() || "";
    const formulaType = formulaInput?.value || "power_index";
    const clubStart = Number(clubStartInput?.value || 50) || 50;
    const hasRecruitingCard = !!recruitingInput?.checked;

    const trackedLifts = getCheckedValues('.new-school-tracked-lift');
    const scoringLiftsRaw = getCheckedValues('.new-school-scoring-lift');

    if (!schoolName) {
        alert("Please enter a school name.");
        return;
    }

    if (!trackedLifts.length) {
        alert("Please select at least one tracked lift.");
        return;
    }

    const scoringLifts = scoringLiftsRaw.filter(lift => trackedLifts.includes(lift));

    if (!scoringLifts.length) {
        alert("Please select at least one scoring lift that is also tracked.");
        return;
    }

    const originalText = createBtn?.innerText || "Create School";

    try {
        if (createBtn) {
            createBtn.disabled = true;
            createBtn.innerText = "Creating...";
        }

        setSchoolCreateStatus("Generating Codes...", "warn");

        const [schoolId, coachCode] = await Promise.all([
            generateUniqueSchoolId(schoolName),
            generateUniqueRegistrationCode("coach_code")
        ]);

        let playerCode = await generateUniqueRegistrationCode("player_code");
        while (playerCode === coachCode) {
            playerCode = await generateUniqueRegistrationCode("player_code");
        }

        setSchoolCreateStatus("Saving School...", "warn");

        const payload = {
            name: schoolName,
            primaryColor,
            "colors.primary": primaryColor,
            logo_url: logoUrl,
            logo_primary: logoUrl,
            formula_type: formulaType,
            scoring_lifts: scoringLifts,
            trackedLifts,
            club_start: clubStart,
            hasRecruitingCard,
            coach_code: coachCode,
            player_code: playerCode,
            createdAt: serverTimestamp(),
            createdBy: currentAdminUid,
            active: true
        };

        await setDoc(doc(db, "schools", schoolId), payload, { merge: true });

        showCreatedSchoolResult({
            schoolId,
            name: schoolName,
            coachCode,
            playerCode
        });

        setSchoolCreateStatus("School Created", "success");

        alert(`School created successfully!\n\nSchool ID: ${schoolId}\nCoach Code: ${coachCode}\nAthlete Code: ${playerCode}`);

        await Promise.all([
            loadSchoolActivity(),
            renderMetrics()
        ]);
    } catch (err) {
        console.error("Create school error:", err);
        setSchoolCreateStatus("Create Failed", "error");
        alert("Unable to create school. Check console for details.");
    } finally {
        if (createBtn) {
            createBtn.disabled = false;
            createBtn.innerText = originalText;
        }
    }
}

async function loadAnnouncements() {
    const list = document.getElementById("announcement-list");
    if (!list) return;

    list.innerHTML = `<p class="text-xs text-gray-600 italic">Loading announcements...</p>`;

    try {
        const q = query(
            collection(db, "system_announcements"),
            orderBy("timestamp", "desc")
        );

        const snap = await getDocs(q);

        if (snap.empty) {
            list.innerHTML = `<p class="text-xs text-gray-600 italic">No announcements found.</p>`;
            return;
        }

        list.innerHTML = "";

        snap.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;

            const active = data.active === true;
            const expiresAt = data.expiresAt?.toDate
                ? data.expiresAt.toDate().toLocaleDateString()
                : "No expiration";

            const row = document.createElement("div");
            row.className = "bg-black/20 border border-white/10 rounded-xl p-4";

            row.innerHTML = `
                <div class="flex justify-between items-start gap-4">
                    <div class="min-w-0">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${
                                active ? "bg-green-500/10 text-green-300 border border-green-500/20" : "bg-gray-500/10 text-gray-400 border border-gray-500/20"
                            }">
                                ${active ? "Active" : "Ended"}
                            </span>
                            <span class="text-[10px] text-gray-500 uppercase tracking-widest">
                                Expires: ${expiresAt}
                            </span>
                        </div>

                        <p class="text-sm text-white leading-relaxed break-words">
                            ${data.message || ""}
                        </p>
                    </div>

                    <div class="flex gap-2 shrink-0">
                        ${active ? `
                            <button
                                onclick="endAnnouncement('${id}')"
                                class="bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 text-yellow-300 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider"
                            >
                                End
                            </button>
                        ` : ""}

                        <button
                            onclick="deleteAnnouncement('${id}')"
                            class="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            `;

            list.appendChild(row);
        });
    } catch (err) {
        console.error("Announcement load error:", err);
        list.innerHTML = `<p class="text-xs text-red-400 font-bold">Unable to load announcements.</p>`;
    }
}

    window.endAnnouncement = async function(id) {
        if (!confirm("End this announcement now?")) return;

        await updateDoc(doc(db, "system_announcements", id), {
            active: false,
            endedAt: serverTimestamp()
        });

        await loadAnnouncements();
    };

    window.deleteAnnouncement = async function(id) {
        if (!confirm("Permanently delete this announcement? This cannot be undone.")) return;

        await deleteDoc(doc(db, "system_announcements", id));
        await loadAnnouncements();
    };

    document.getElementById("refresh-announcements-btn")?.addEventListener("click", loadAnnouncements);
        loadAnnouncements();

// Utility helper for Firestore aggregate counts
async function getCount(queryOrColl) {
    try {
        const snap = await getAggregateFromServer(queryOrColl, { total: count() });
        return snap.data().total;
    } catch (e) {
        return 0;
    }
}