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

            console.log("🎨 Applying theme data:", data);

            // 1. Update CSS Variables
            // We update --rackstat-red because that's what your profile.html uses for buttons/borders
            const primaryColor = colors.primary || '#b91c1c';
            root.style.setProperty('--school-primary', primaryColor);
            root.style.setProperty('--rackstat-red', primaryColor); 
            
            root.style.setProperty('--school-secondary', colors.secondary || '#0a0a0b');

            // 2. Update all logo instances
            if (data.logo_url) {
                // Expanded selector to catch your #school-logo ID
                const logos = document.querySelectorAll('#school-logo, #school-logo-alt, .school-logo-primary, .school-logo-secondary');
                
                logos.forEach(img => {
                    const finalPath = data.logo_url.startsWith('http') || data.logo_url.startsWith('images/') 
                        ? data.logo_url 
                        : `images/${data.logo_url}`;
                        
                    console.log("🖼️ Setting logo path to:", finalPath);
                    img.src = finalPath;
                    img.style.display = 'block'; 
                });
            }

            // 3. Update school name
            if (data.name) {
                // FIX: Added #school-name to the selector to match your profile.html header
                const nameElements = document.querySelectorAll('#school-name, #school-tag, .school-name');
                nameElements.forEach(el => {
                    el.innerText = data.name.toUpperCase();
                });
            }
            
            console.log(`✅ Theme successfully applied: ${data.name || schoolID}`);
        } else {
            console.error(`❌ School document "${schoolID}" not found in 'schools' collection.`);
        }
    } catch (error) {
        console.error("❌ Error in theme engine:", error);
    } finally {
        const branding = document.getElementById('school-branding');
        if (branding) branding.classList.add('theme-loaded');
    }
}