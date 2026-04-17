import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Applies the school's branding (colors, logo, name) to the current page.
 */
export async function applyTheme(db, schoolID) {
    if (!schoolID) return;

    try {
        const schoolSnap = await getDoc(doc(db, "schools", schoolID));
        
        if (schoolSnap.exists()) {
            const data = schoolSnap.data();
            const colors = data.colors || {};
            const root = document.documentElement;

            // 1. Update CSS Variables
            const primaryColor = colors.primary || data.primaryColor || '#b91c1c';
            root.style.setProperty('--school-primary', primaryColor);
            root.style.setProperty('--rackstat-red', primaryColor); 
            root.style.setProperty('--school-secondary', colors.secondary || '#0a0a0b');

            // 2. Update all logo instances (Supports logo_primary, logo_url, or logo)
            const logoPath = data.logo_primary || data.logo_url || data.logo; 
            
            if (logoPath) {
                const logos = document.querySelectorAll('#school-logo, #school-logo-alt, .school-logo-primary');
                logos.forEach(img => {
                    img.src = logoPath;
                    img.style.display = 'block';
                    // Fallback if the URL in the database is broken
                    img.onerror = () => { img.src = 'images/rackstat-logo.png'; };
                });
            }

            // 3. Update school name
            const schoolDisplayName = data.name || data.schoolName || "RACKSTAT";
            const nameElements = document.querySelectorAll('#school-name, #school-tag, .school-name');
            nameElements.forEach(el => {
                el.innerText = schoolDisplayName.toUpperCase();
            });
            
            console.log(`✅ Theme applied: ${schoolDisplayName}`);
            return data; 
        }
    } catch (error) {
        console.error("❌ Theme engine error:", error);
    } finally {
        const branding = document.getElementById('school-branding');
        if (branding) branding.classList.add('theme-loaded');
    }
}