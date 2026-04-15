import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Applies the school's branding (colors, logo, name) to the current page.
 */
export async function applyTheme(db, schoolID) {
    if (!schoolID) {
        return;
    }

    try {
        const schoolSnap = await getDoc(doc(db, "schools", schoolID));
        
        if (schoolSnap.exists()) {
            const data = schoolSnap.data();
            const colors = data.colors || {};
            const root = document.documentElement;

            // 1. Update CSS Variables
            const primaryColor = colors.primary || '#b91c1c';
            root.style.setProperty('--school-primary', primaryColor);
            root.style.setProperty('--rackstat-red', primaryColor); 
            root.style.setProperty('--school-secondary', colors.secondary || '#0a0a0b');

            // 2. Update all logo instances
            // NOTE: Changed data.logo_url to data.logo_primary to match your database screenshot
            const logoPath = data.logo_primary || data.logo_url; 
            
            if (logoPath) {
                const logos = document.querySelectorAll('#school-logo, #school-logo-alt, .school-logo-primary, .school-logo-secondary');
                
                logos.forEach(img => {
                    const finalPath = (logoPath.startsWith('http') || logoPath.startsWith('images/')) 
                        ? logoPath 
                        : `images/${logoPath}`;
                        
                    img.src = finalPath;
                    img.style.display = 'block'; 
                });
            }

            // 3. Update school name
            if (data.name) {
                const nameElements = document.querySelectorAll('#school-name, #school-tag, .school-name');
                nameElements.forEach(el => {
                    el.innerText = data.name.toUpperCase();
                });
            }
            
            // Log only the success message, not the full data object
            console.log(`✅ Theme applied: ${data.name || schoolID}`);

            return data; // Return data so profile.html can use it if needed
        }
    } catch (error) {
        // Log generic error without leaking sensitive context
        console.error("❌ Theme engine error");
    } finally {
        const branding = document.getElementById('school-branding');
        if (branding) branding.classList.add('theme-loaded');
    }
}