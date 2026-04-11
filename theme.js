import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Applies the school's branding (colors, logo, name) to the current page.
 */
export async function applyTheme(db, schoolID) {
    if (!schoolID) {
        console.warn("No School ID provided to theme engine.");
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

            // 2. Update all logo instances
            if (data.logo_url) {
                const logos = document.querySelectorAll('#school-logo, #school-logo-alt, .school-logo-primary, .school-logo-secondary');
                logos.forEach(img => {
                    // Check if it's a full URL or just a filename
                    const finalPath = data.logo_url.startsWith('http') || data.logo_url.startsWith('images/') 
                        ? data.logo_url 
                        : `images/${data.logo_url}`;
                        
                    img.src = finalPath;
                    // Make sure it's visible if it was previously hidden by an error
                    img.style.display = 'block'; 
                });
            }

            // 3. Update school name/tags
            if (data.name) {
                // This now looks for our new tag (#school-tag) AND the old name class
                const nameElements = document.querySelectorAll('#school-tag, .school-name');
                nameElements.forEach(el => {
                    el.innerText = data.name.toUpperCase();
                });
            }
            
            console.log(`Theme applied: ${data.name || schoolID}`);
        }
    } catch (error) {
        console.error("Error applying theme:", error);
    } finally {
        // Reveal branding if using the fade-in utility
        const branding = document.getElementById('school-branding');
        if (branding) branding.classList.add('theme-loaded');
    }
}