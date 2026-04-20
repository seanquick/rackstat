/**
 * RACKSTAT Board Score Engine
 * Shared calculation helpers for rack.html, board.html, and any future leaderboard views.
 */

/**
 * Normalizes a string into a consistent lift key format.
 * Example: "Push Press" -> "push_press"
 */
export function slugify(text) {
    return String(text || "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[^\w-]+/g, "");
}

/**
 * Normalizes lift arrays coming from Firestore.
 * Supports:
 * - arrays of strings
 * - comma-separated strings
 * - legacy mixed values
 */
export function normalizeLiftArray(value, fallback = []) {
    if (!value) return [...fallback];

    if (Array.isArray(value)) {
        return value
            .flatMap(item => {
                if (typeof item === "string") return item.split(",");
                return [];
            })
            .map(item => slugify(item.trim()))
            .filter(Boolean);
    }

    if (typeof value === "string") {
        return value
            .split(",")
            .map(item => slugify(item.trim()))
            .filter(Boolean);
    }

    return [...fallback];
}

/**
 * Returns the configured tracked lifts for a school document.
 * Falls back to a default core trio if nothing is configured.
 */
export function getTrackedLiftsFromSchool(schoolData = {}) {
    return normalizeLiftArray(
        schoolData.trackedLifts || schoolData.activeLifts,
        ["bench", "squat", "clean"]
    );
}

/**
 * Returns the configured scoring lifts for board score calculation.
 * Falls back to tracked lifts if scoring_lifts is not explicitly configured.
 */
export function getScoringLiftsFromSchool(schoolData = {}) {
    const trackedLifts = getTrackedLiftsFromSchool(schoolData);

    const scoringLifts = normalizeLiftArray(
        schoolData.scoring_lifts || schoolData.scoringLifts,
        trackedLifts
    );

    return scoringLifts.length ? scoringLifts : trackedLifts;
}

/**
 * Returns the school formula type in a normalized format.
 * Supported normalized values:
 * - "straight_total"
 * - "power_index"
 */
export function getFormulaTypeFromSchool(schoolData = {}) {
    const raw = String(schoolData.formula_type || "power_index").toLowerCase().trim();

    if (raw === "straight_calculation") return "straight_total";
    if (raw === "straight_total") return "straight_total";
    return "power_index";
}

/**
 * Returns the possible field aliases for a given lift key.
 * This preserves compatibility with older documents and dual-key syncing.
 */
export function getLiftAliases(liftKey) {
    const normalized = slugify(liftKey);

    const aliasMap = {
        bench: ["bench", "bench_press"],
        squat: ["squat", "back_squat"],
        clean: ["clean", "power_clean"],
        deadlift: ["deadlift"],
        push_press: ["push_press", "pushPress", "pushpress"],
        forty: ["forty", "forty_yard_dash"]
    };

    return aliasMap[normalized] || [normalized];
}

/**
 * Gets a numeric lift value from a max/profile document using alias fallback.
 */
export function getLiftValue(data = {}, liftKey = "") {
    const aliases = getLiftAliases(liftKey);

    for (const key of aliases) {
        const raw = data[key];
        if (raw !== undefined && raw !== null && raw !== "") {
            return Number(raw) || 0;
        }
    }

    return 0;
}

/**
 * Gets bodyweight with fallback support for different field names.
 */
export function getBodyweight(data = {}) {
    return Number(
        data.bodyWeight ??
        data.body_weight ??
        data.weight ??
        0
    ) || 0;
}

/**
 * Calculates the sum of the selected scoring lifts.
 */
export function calculateLiftTotal(data = {}, scoringLifts = []) {
    return scoringLifts.reduce((sum, liftKey) => {
        return sum + getLiftValue(data, liftKey);
    }, 0);
}

/**
 * Main Board Score calculation engine.
 *
 * Power Index formula:
 * L - (BWadj × N)
 * where:
 * L = sum of selected lifts
 * BWadj = min(bodyweight, 200)
 * N = number of selected lifts
 */
export function calculateBoardScore({
    data = {},
    formulaType = "power_index",
    scoringLifts = []
} = {}) {
    const normalizedFormula = formulaType === "straight_calculation"
        ? "straight_total"
        : formulaType;

    const normalizedScoringLifts = normalizeLiftArray(scoringLifts, []);
    const total = calculateLiftTotal(data, normalizedScoringLifts);
    const bw = getBodyweight(data);
    const bwAdj = Math.min(bw, 200);
    const liftCount = normalizedScoringLifts.length;

    let score = total;

    if (normalizedFormula === "power_index") {
        score = total - (bwAdj * liftCount);
    }

    return {
        formulaType: normalizedFormula,
        scoringLifts: normalizedScoringLifts,
        total,
        bw,
        bwAdj,
        liftCount,
        score: Math.round(score)
    };
}

/**
 * Builds a normalized team settings object from a school document.
 * Useful for rack.html and board.html so both use the same interpretation.
 */
export function buildBoardScoreSettings(schoolData = {}) {
    const trackedLifts = getTrackedLiftsFromSchool(schoolData);
    const scoringLifts = getScoringLiftsFromSchool(schoolData);
    const formulaType = getFormulaTypeFromSchool(schoolData);

    return {
        tracked_lifts: trackedLifts,
        display_names: trackedLifts.map(lift => lift.replace(/_/g, " ").toUpperCase()),
        formula_type: formulaType,
        scoring_lifts: scoringLifts
    };
}

/**
 * Generates all write-back aliases for a lift so max docs can stay in sync
 * across legacy and current pages.
 */
export function buildLiftWritebacks(liftKey, value) {
    const normalized = slugify(liftKey);
    const writebacks = {
        [normalized]: Number(value) || 0
    };

    if (normalized === "bench") writebacks.bench_press = Number(value) || 0;
    if (normalized === "squat") writebacks.back_squat = Number(value) || 0;
    if (normalized === "clean") writebacks.power_clean = Number(value) || 0;

    if (normalized === "push_press") {
        writebacks.push_press = Number(value) || 0;
        writebacks.pushPress = Number(value) || 0;
        writebacks.pushpress = Number(value) || 0;
    }

    return writebacks;
}