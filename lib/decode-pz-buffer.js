import fs from "fs";
import path from "path";

const DEBUG_PZ_DECODE =
    process.env.DEBUG_PZ_DECODE === "1" ||
    process.env.DEBUG_PZ_DECODE === "true";
let _debugLogPath = null;
let _debugLogStarted = false;
function debugLog(...args) {
    if (!DEBUG_PZ_DECODE) return;
    const line =
        args
            .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
            .join(" ") + "\n";
    console.log(...args);
    try {
        if (_debugLogPath === null)
            _debugLogPath = path.join(process.cwd(), "pz-decode-debug.log");
        if (!_debugLogStarted) {
            fs.appendFileSync(
                _debugLogPath,
                `\n=== decode debug ${new Date().toISOString()} => ${_debugLogPath} ===\n`,
            );
            _debugLogStarted = true;
        }
        fs.appendFileSync(_debugLogPath, line);
    } catch (_) {}
}

/** Known PZ stat/skill names for level extraction when string extraction finds none. */
const KNOWN_PZ_SKILL_NAMES = [
    "Strength",
    "Fitness",
    "Sneak",
    "Nimble",
    "Lightfoot",
    "Sprinting",
    "Voice",
    "Carpentry",
    "Cooking",
    "Farming",
    "Fishing",
    "Trapping",
    "Electrical",
    "Metalworking",
    "Mechanics",
    "Tailoring",
    "Aiming",
    "Reloading",
    "Blunt",
    "Axe",
    "SmallBlade",
    "LongBlade",
    "SmallBlunt",
    "Spear",
    "Maintenance",
    "FirstAid",
];

/** PZ occupation/profession IDs (base:xxx). Only these go under "Profession". */
const PZ_PROFESSION_IDS = new Set([
    "base:unemployed",
    "base:fireofficer",
    "base:policeofficer",
    "base:parkranger",
    "base:constructionworker",
    "base:securityguard",
    "base:carpenter",
    "base:burglar",
    "base:chef",
    "base:diyexpert",
    "base:rancher",
    "base:farmer",
    "base:angler",
    "base:doctor",
    "base:veteran",
    "base:nurse",
    "base:lumberjack",
    "base:fitnessinstructor",
    "base:burgerflipper",
    "base:electrician",
    "base:engineer",
    "base:welder",
    "base:blacksmith",
    "base:mechanic",
    "base:tailor",
    "base:repairman",
    "base:salesman",
]);

/** PZ clothing/slot/equipment base:xxx IDs — exclude from both profession and traits. */
const PZ_CLOTHING_SLOT_IDS = new Set([
    "base:belt",
    "base:mask",
    "base:hat",
    "base:tanktop",
    "base:tshirt",
    "base:shortsleeveshirt",
    "base:necklace",
    "base:socks",
    "base:shoes",
    "base:glasses",
    "base:gloves",
    "base:scarf",
    "base:bag",
    "base:jacket",
    "base:vest",
    "base:pants",
    "base:shorts",
    "base:underwear",
    "base:ring",
    "base:watch",
]);

/**
 * Decodes Project Zomboid player skills from a binary buffer.
 * Reliable source: skill name at index, then 4-byte Big-Endian level (0–10).
 * @param {Buffer} buffer - The raw 'data' buffer from the SQLite 'players' table.
 * @returns {Object} - An object containing skill names and their levels.
 */
function decodePlayerSkills(buffer) {
    const skills = [
        "Strength",
        "Fitness",
        "Sprinting",
        "Lightfoot",
        "Nimble",
        "Sneak",
        "Axe",
        "LongBlunt",
        "ShortBlunt",
        "LongBlade",
        "ShortBlade",
        "Spear",
        "Maintenance",
        "Carpentry",
        "Cooking",
        "Farming",
        "FirstAid",
        "Electrical",
        "MetalWelding",
        "Mechanics",
        "Tailoring",
        "Aiming",
        "Reloading",
        "Fishing",
        "Trapping",
        "Foraging",
    ];

    let results = {};

    skills.forEach((skill) => {
        // USE lastIndexOf to get the current level, not the starting level
        const index = buffer.lastIndexOf(skill);

        if (index !== -1) {
            try {
                // Read the 4 bytes immediately following the string
                const levelValue = buffer.readInt32BE(index + skill.length);

                // PZ levels are 0-10. This filter ensures we don't accidentally
                // grab a random piece of binary that isn't a level.
                if (levelValue >= 0 && levelValue <= 10) {
                    results[skill] = levelValue;
                }
            } catch (e) {
                results[skill] = 0;
            }
        }
    });

    return results;
}

/**
 * Heuristic extraction from Project Zomboid save blobs (Java serialized).
 * Does not fully deserialize; extracts readable strings and known patterns.
 * @param {Buffer|Uint8Array|number[]} buf - The data column blob
 * @param {'vehicle'|'player'} type - Hint for which patterns to look for
 * @returns {{ type: string, extracted: object, raw: number[] }}
 */
function decodePzBuffer(buf, type = "vehicle") {
    const buffer =
        buf && !Buffer.isBuffer(buf) ? Buffer.from(buf) : buf || null;
    const raw = buffer ? Array.from(buffer) : [];
    const extracted = {};

    if (!buffer || buffer.length === 0) {
        return { type, extracted, raw };
    }

    try {
        const strings = extractReadableStrings(buffer);
        const utf8String = buffer.toString("utf8");

        if (type === "vehicle") {
            // Vehicle type: first "ModName.VehicleId" or "Base.Something"
            const vehicleTypeMatch = utf8String.match(
                /[a-zA-Z0-9]+\.[a-zA-Z0-9_]+/,
            );
            extracted.vehicleType = vehicleTypeMatch
                ? vehicleTypeMatch[0]
                : null;

            // Part-like names (e.g. TrunkDoor, Engine, customName)
            const partPattern =
                /(?:TrunkDoor|Engine|Battery|GasTank|Muffler|Windshield|Seat|Door|Tire|Brake|GloveBox|Radio|customName|Base\.\w+)/g;
            const parts = [
                ...new Set(
                    (utf8String.match(partPattern) || []).filter(Boolean),
                ),
            ];
            if (parts.length) extracted.partNames = parts;

            // Custom names (often follow "customName" in stream)
            const customNames = strings.filter(
                (s) =>
                    s.length > 2 &&
                    s.length < 80 &&
                    /^[\x20-\x7e]+$/.test(s) &&
                    !s.includes(".") &&
                    !/^(Base|customName|Tooltip|contentAmount|Trunk|Seat|Door|Engine|Battery|GasTank|Muffler|Windshield|Brake|Tire|Radio|GloveBox)$/i.test(
                        s,
                    ),
            );
            if (customNames.length)
                extracted.customNames = [...new Set(customNames)].slice(0, 20);

            extracted.allStrings = undefined;
        } else {
            // Player: character name (short capitalized words, often first human-looking strings)
            const nameCandidates = strings.filter(
                (s) =>
                    s.length >= 2 &&
                    s.length <= 30 &&
                    /^[A-Za-z0-9\s\-'_]+$/.test(s) &&
                    !s.startsWith("base:") &&
                    !s.startsWith("Base.") &&
                    !/^\d+$/.test(s),
            );
            if (nameCandidates.length) {
                // Prefer short strings that look like first/last names
                const likelyNames = nameCandidates.filter(
                    (s) => s.length <= 20 && s.trim().length >= 2,
                );
                extracted.characterNames = [...new Set(likelyNames)].slice(
                    0,
                    10,
                );
            }

            // Profession: only known PZ occupation IDs (one per character)
            const professions = strings.filter(
                (s) =>
                    /^base:[a-z0-9]+$/i.test(s) &&
                    PZ_PROFESSION_IDS.has(s.toLowerCase()),
            );
            if (professions.length)
                extracted.professionIds = [...new Set(professions)];

            // Traits: base:xxx that are not professions and not clothing/slots
            const traits = strings.filter(
                (s) =>
                    s.startsWith("base:") &&
                    s.length > 6 &&
                    s.length < 60 &&
                    !PZ_PROFESSION_IDS.has(s.toLowerCase()) &&
                    !PZ_CLOTHING_SLOT_IDS.has(s.toLowerCase()),
            );
            if (traits.length)
                extracted.traitOrSkillIds = [...new Set(traits)].slice(0, 50);

            // Stats/skills (Strength, Fitness, and common PZ skill names)
            const statPattern =
                /^(Strength|Fitness|Sneak|Nimble|Lightfoot|Sprinting|Voice|Carpentry|Cooking|Farming|Fishing|Trapping|Electrical|Metalworking|Mechanics|Tailoring|Aiming|Reloading|Blunt|Axe|SmallBlade|LongBlade|SmallBlunt|Spear|Maintenance|FirstAid)$/i;
            const statNames = strings.filter((s) => statPattern.test(s));
            if (statNames.length) extracted.statNames = [...new Set(statNames)];

            // Appearance (PZ appearance IDs: hair, beard, face parts)
            const appearancePattern =
                /^(M_|F_)?(Hair|Beard|Beard_Stubble|Face)_[A-Za-z0-9_]+$|^[A-Za-z]+(Chin|Nose|Eyes|Hair)$|^(PointyChin|ShortAfroCurly|LongAfro|Bald|Stubble|FullBeard|Goatee|Moustache)$/i;
            const appearance = strings.filter(
                (s) =>
                    s.length >= 3 &&
                    s.length <= 50 &&
                    /^[A-Za-z0-9_]+$/.test(s) &&
                    (appearancePattern.test(s) ||
                        /_(Hair|Beard|Chin|Nose|Eyes)/i.test(s)),
            );
            if (appearance.length)
                extracted.appearance = [...new Set(appearance)].slice(0, 30);

            // Clothing / equipment: Base.* item types and TINT-style
            const clothingTypes = strings.filter(
                (s) =>
                    (s.startsWith("Base.") &&
                        s.length < 80 &&
                        /^[A-Za-z0-9_.]+$/.test(s)) ||
                    (/^[A-Za-z0-9_]+TINT$/i.test(s) && s.length < 60),
            );
            if (clothingTypes.length)
                extracted.clothingTypes = [...new Set(clothingTypes)].slice(
                    0,
                    50,
                );

            // Short custom names that may be equipment names (exclude character names and known non-equipment)
            const clothingCustomNames = strings.filter(
                (s) =>
                    s.length >= 2 &&
                    s.length <= 40 &&
                    /^[\x20-\x7e]+$/.test(s) &&
                    !s.includes(".") &&
                    !s.startsWith("base:") &&
                    !/^(Base|Tooltip|contentAmount|Strength|Fitness|Sneak|Nimble|Make|ID Card|Key Ring)$/i.test(
                        s,
                    ) &&
                    !(extracted.characterNames || []).some((n) => n === s),
            );
            if (clothingCustomNames.length)
                extracted.clothingCustomNames = [
                    ...new Set(clothingCustomNames),
                ].slice(0, 20);

            // Inventory-like strings (ID Card:, Key Ring, 's Key, descriptive lines)
            const inventoryStrings = strings.filter(
                (s) =>
                    s.length >= 10 &&
                    s.length <= 80 &&
                    /^[\x20-\x7e]+$/.test(s) &&
                    (s.includes(":") ||
                        s.includes("'") ||
                        /Key Ring|ID Card|Key\b/i.test(s)),
            );
            if (inventoryStrings.length)
                extracted.inventoryStrings = [
                    ...new Set(inventoryStrings),
                ].slice(0, 30);

            // Recipes (e.g. Make*, or common PZ recipe prefixes)
            const recipeIds = strings.filter(
                (s) =>
                    /^Make[A-Za-z0-9_]*$/i.test(s) ||
                    /^[A-Za-z]+\.[A-Za-z0-9_]+Recipe$/i.test(s),
            );
            if (recipeIds.length)
                extracted.recipeIds = [...new Set(recipeIds)].slice(0, 100);

            // Username from buffer (optional fallback; primary username remains from DB)
            // Exclude stat/skill names, appearance, recipes, and other known non-username strings
            const knownNonUsernames = [
                ...(extracted.statNames || []),
                ...(extracted.characterNames || []),
                ...(extracted.professionIds || []),
                ...(extracted.traitOrSkillIds || []),
                ...(extracted.appearance || []).slice(0, 10),
            ];
            const usernameFromBuffer = strings.find(
                (s) =>
                    s.length >= 3 &&
                    s.length <= 20 &&
                    /^[a-zA-Z0-9]+$/.test(s) &&
                    !s.startsWith("base:") &&
                    !s.startsWith("Base.") &&
                    !/^Make[A-Za-z0-9_]*$/i.test(s) &&
                    !knownNonUsernames.includes(s),
            );
            if (usernameFromBuffer)
                extracted.usernameFromBuffer = usernameFromBuffer;

            // Skill XP / raw numbers for levels (XP amounts per level; level calculation done later in frontend)
            const namesForXp =
                extracted.statNames && extracted.statNames.length
                    ? extracted.statNames
                    : KNOWN_PZ_SKILL_NAMES;
            const skillXp = extractSkillXpFromBuffer(buffer, namesForXp);
            if (Object.keys(skillXp).length) extracted.skillXp = skillXp;

            // Skill levels: reliable decode via [skillName][4-byte BE int] (0–10)
            const skillLevels = decodePlayerSkills(buffer);
            if (DEBUG_PZ_DECODE) {
                debugLog("[decode] player buffer length:", buffer.length);
                debugLog(
                    "[decode] skillLevels (decodePlayerSkills):",
                    Object.keys(skillLevels).length,
                    Object.keys(skillLevels).length ? skillLevels : "(none)",
                );
            }
            extracted.skillLevels = skillLevels;
            if (Object.keys(skillLevels).length && !extracted.statNames?.length)
                extracted.statNames = Object.keys(skillLevels);
            // Reliable aggregate level (sum of all skill levels) for display/sorting
            const levelSum = Object.values(skillLevels).reduce(
                (a, b) => a + b,
                0,
            );
            if (Object.keys(skillLevels).length)
                extracted.playerLevel = levelSum;
        }
    } catch (e) {
        extracted._error = e.message || "Decode error";
    }

    return { type, extracted, raw };
}

/**
 * Extract readable ASCII/UTF-8 strings from buffer (length-prefixed and null-terminated).
 * Java serialization often uses 2-byte length (big-endian short) + UTF bytes, or null-terminated.
 */
function extractReadableStrings(buf) {
    const strings = [];
    let i = 0;

    while (i < buf.length - 1) {
        // Try short (2-byte) length prefix, big-endian
        const len = buf.readUInt16BE(i);
        if (len > 0 && len <= 500 && i + 2 + len <= buf.length) {
            const slice = buf.subarray(i + 2, i + 2 + len);
            if (isPrintableUtf8(slice)) {
                const s = slice.toString("utf8");
                if (s.length === len) {
                    strings.push(s);
                    i += 2 + len;
                    continue;
                }
            }
        }

        // Null-terminated run
        if (buf[i] >= 0x20 && buf[i] <= 0x7e) {
            let end = i;
            while (
                end < buf.length &&
                buf[end] !== 0 &&
                buf[end] >= 0x20 &&
                buf[end] <= 0x7e
            )
                end++;
            if (end - i >= 2 && end - i <= 200) {
                strings.push(buf.subarray(i, end).toString("utf8"));
                i = end;
                if (buf[i] === 0) i++;
                continue;
            }
        }

        i++;
    }

    return strings;
}

function isPrintableUtf8(buf) {
    for (let j = 0; j < buf.length; j++) {
        const b = buf[j];
        if (b === 0) return false;
        if (b < 0x20 && b !== 0x09) return false;
        if (b > 0x7e && b < 0xc2) return false;
    }
    return true;
}

/**
 * Extract skill levels from the main skill block.
 * Each skill name can appear multiple times; we take the MAX level (0–10) seen in either
 * 4-byte slot across all occurrences, so we get the "current" level (e.g. Fitness 5, Strength 9).
 * Tries: [name][0x00?][4-byte], [name][4-byte][4-byte] (first or second int), [name][8-byte double].
 * @param {Buffer} buf - Full player buffer
 * @param {string[]} statNames - e.g. ['Strength', 'Fitness', 'Sneak', ...]
 * @returns {{ [skillName: string]: number }} skill name -> level (0–10)
 */
function extractSkillLevelsFromBuffer(buf, statNames) {
    const skillLevels = {};
    if (!buf || buf.length < 10 || !statNames || statNames.length === 0) {
        if (DEBUG_PZ_DECODE)
            debugLog("[decode] extractSkillLevels: skipped (no buf/statNames)");
        return skillLevels;
    }

    for (const name of statNames) {
        const nameBuf = Buffer.from(name, "utf8");
        let maxLevel = -1;
        let i = 0;
        let matchCount = 0;
        while (i <= buf.length - nameBuf.length - 4) {
            if (buf.subarray(i, i + nameBuf.length).compare(nameBuf) !== 0) {
                i++;
                continue;
            }
            matchCount++;
            const after = i + nameBuf.length;
            let level = null;
            // Pattern A: 0x00 then 4-byte int
            if (buf[after] === 0 && after + 5 <= buf.length) {
                const val = buf.readUInt32BE(after + 1);
                if (val <= 10) level = val;
            }
            // Pattern B: first 4-byte int
            if (level == null && after + 4 <= buf.length) {
                const val = buf.readUInt32BE(after);
                if (val <= 10) level = val;
            }
            // Pattern C: second 4-byte int
            if (level == null && after + 8 <= buf.length) {
                const val = buf.readUInt32BE(after + 4);
                if (val <= 10) level = val;
            }
            // Pattern D: 8 bytes as double (integer 0–10)
            if (level == null && after + 8 <= buf.length) {
                try {
                    const d = buf.readDoubleBE(after);
                    if (
                        Number.isFinite(d) &&
                        d >= 0 &&
                        d <= 10 &&
                        Math.floor(d) === d
                    )
                        level = Math.round(d);
                } catch (_) {}
            }
            if (DEBUG_PZ_DECODE && matchCount <= 3) {
                const bytes =
                    after + 8 <= buf.length
                        ? Array.from(buf.subarray(after, after + 8))
                        : Array.from(buf.subarray(after, buf.length));
                const u32_0 =
                    after + 4 <= buf.length ? buf.readUInt32BE(after) : null;
                const u32_4 =
                    after + 8 <= buf.length
                        ? buf.readUInt32BE(after + 4)
                        : null;
                let dbl = null;
                try {
                    if (after + 8 <= buf.length) dbl = buf.readDoubleBE(after);
                } catch (_) {}
                debugLog(
                    `[decode] "${name}" match #${matchCount} at i=${i}, after=${after}, bytes[0..7]=[${bytes.join(",")}]`,
                );
                debugLog(
                    `[decode]   -> readUInt32BE(after)=${u32_0}, readUInt32BE(after+4)=${u32_4}, readDoubleBE(after)=${dbl}`,
                );
                debugLog(
                    `[decode]   -> level this occurrence: ${level ?? "none"}, max so far: ${maxLevel}`,
                );
            }
            if (level != null && level > maxLevel) maxLevel = level;
            i = after + 1;
        }
        if (maxLevel >= 0) skillLevels[name] = maxLevel;
        if (DEBUG_PZ_DECODE && name === statNames[0]) {
            debugLog(
                `[decode] "${name}" total occurrences: ${matchCount}, final level: ${skillLevels[name] ?? "not found"}`,
            );
        }
    }
    return skillLevels;
}

/**
 * Extract XP-like numeric values that follow known stat/skill names in the buffer.
 * Used for later level interpretation in the frontend; level calculation is not done here.
 * @param {Buffer} buf - Full player buffer
 * @param {string[]} statNames - e.g. ['Strength', 'Fitness', 'Sneak', ...]
 * @returns {{ [skillName: string]: number[] }} skill name -> array of numeric values (XP per level)
 */
function extractSkillXpFromBuffer(buf, statNames) {
    const skillXp = {};
    if (!buf || buf.length < 10 || !statNames || statNames.length === 0)
        return skillXp;

    for (const name of statNames) {
        const nameBuf = Buffer.from(name, "utf8");
        const values = [];
        let i = 0;
        while (i < buf.length - nameBuf.length - 8) {
            const match =
                buf.subarray(i, i + nameBuf.length).compare(nameBuf) === 0;
            if (match) {
                const after = i + nameBuf.length;
                if (after + 8 <= buf.length) {
                    try {
                        const val = buf.readDoubleBE(after);
                        if (Number.isFinite(val) && val >= 0 && val < 1e10)
                            values.push(val);
                    } catch (_) {}
                }
                i = after + 1;
            } else {
                i++;
            }
        }
        if (values.length) skillXp[name] = [...new Set(values)].slice(0, 15);
    }
    return skillXp;
}

export { decodePzBuffer };
