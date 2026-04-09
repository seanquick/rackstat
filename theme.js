import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Applies the school's branding (colors, logo, name) to the current page.
 * @param {Firestore} db - The Firestore instance.
 * @param {string} schoolID - The ID of the school to fetch.
 */
export async function applyTheme(db, schoolID) {
    if (!schoolID) {
        console.warn("No School ID provided to theme engine.");
        document.body.classList.add('theme-loaded');
        return;
    }

    try {
        const schoolSnap = await getDoc(doc(db, "schools", schoolID));
        
        if (schoolSnap.exists()) {
            const data = schoolSnap.data();
            const colors = data.colors || {};
            const root = document.documentElement;

            // 1. Update CSS Variables for colors
            root.style.setProperty('--school-primary', colors.primary || '#b91c1c');
            root.style.setProperty('--school-secondary', colors.secondary || '#0a0a0b');

            // 2. Update all logo instances (Primary and Secondary)
            if (data.logo_url) {
                const logos = document.querySelectorAll('.school-logo-primary, .school-logo-secondary');
                logos.forEach(img => {
                    img.src = data.logo_url;
                });
            }

            // 3. Update all instances of the school name
            if (data.name) {
                const nameElements = document.querySelectorAll('.school-name');
                nameElements.forEach(el => {
                    el.innerText = data.name;
                });
            }
            
            console.log(`Theme applied: ${data.name || schoolID}`);
        } else {
            console.error("School document not found in Firestore.");
        }
    } catch (error) {
        console.error("Error applying theme:", error);
    } finally {
        // 4. Reveal the body once the theme is processed
        document.body.classList.add('theme-loaded');
    }
}