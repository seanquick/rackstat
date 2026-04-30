import { appCheckReady } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Applies school branding (colors, logo, and display name) to the current page.
 * Returns the school document data when found, otherwise null.
 */
export async function applyTheme(db, schoolId) {
    if (!db || !schoolId) {
        revealBranding();
        return null;
    }

    try {
        await appCheckReady;
        
        // Load the school's primary branding/config document
        const schoolSnap = await getDoc(doc(db, "schools", schoolId));

        if (!schoolSnap.exists()) {
            applyFallbackTheme();
            revealBranding();
            return null;
        }

        const data = schoolSnap.data();
        const colors = data.colors || {};
        const root = document.documentElement;

        // Apply dynamic CSS variables used across the app
        const primaryColor = colors.primary || data.primaryColor || '#b91c1c';
        const secondaryColor = colors.secondary || data.secondaryColor || '#0a0a0b';

        root.style.setProperty('--school-primary', primaryColor);
        root.style.setProperty('--rackstat-red', primaryColor);
        root.style.setProperty('--school-secondary', secondaryColor);

        // Resolve logo from supported legacy/current field names
        const logoPath = data.logo_primary || data.logo_url || data.logo || '';

        if (logoPath) {
            const logoSelectors = [
                '#school-logo',
                '#school-logo-alt',
                '#coach-school-logo',
                '#disp-logo',
                '.school-logo-primary',
                '.school-logo-large'
            ].join(', ');

            document.querySelectorAll(logoSelectors).forEach((img) => {
                if (img.dataset.themeIgnore === "true") return;

                img.src = logoPath;
                img.style.display = 'block';
                img.onerror = () => {
                    img.src = 'images/rackstat-logo.png';
                };
            });
        }

        // Resolve school display name from supported field names
        const schoolDisplayName = data.name || data.schoolName || data.tag || "RACKSTAT";

        const nameSelectors = [
            '#school-name',
            '#school-tag',
            '#school-title',
            '.school-name'
        ].join(', ');

        document.querySelectorAll(nameSelectors).forEach((el) => {
            if (el.dataset.themeIgnore === "true") return;
            el.innerText = schoolDisplayName.toUpperCase();
        });

        console.log(`✅ Theme applied: ${schoolDisplayName}`);
        revealBranding();
        return data;

    } catch (error) {
        console.error("❌ Theme engine error:", error);
        applyFallbackTheme();
        revealBranding();
        return null;
    }
}

/**
 * Applies a safe default theme when school branding cannot be loaded.
 */
function applyFallbackTheme() {
    const root = document.documentElement;
    root.style.setProperty('--school-primary', '#b91c1c');
    root.style.setProperty('--rackstat-red', '#b91c1c');
    root.style.setProperty('--school-secondary', '#0a0a0b');
}

/**
 * Reveals branding containers after theme loading finishes.
 */
function revealBranding() {
    const branding = document.getElementById('school-branding');
    if (branding) branding.classList.add('theme-loaded');

    document.body?.classList.add('theme-loaded');
}