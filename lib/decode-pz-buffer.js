/**
 * Heuristic extraction from Project Zomboid save blobs (Java serialized).
 * Does not fully deserialize; extracts readable strings and known patterns.
 * @param {Buffer} buf - The data column blob
 * @param {'vehicle'|'player'} type - Hint for which patterns to look for
 * @returns {{ type: string, extracted: object, raw: number[] }}
 */
function decodePzBuffer(buf, type = "vehicle") {
    const raw = buf ? Array.from(buf) : [];
    const extracted = {};

    if (!buf || buf.length === 0) {
        return { type, extracted, raw };
    }

    try {
        const strings = extractReadableStrings(buf);
        const utf8String = buf.toString("utf8");

        if (type === "vehicle") {
            // Vehicle type: first "ModName.VehicleId" or "Base.Something"
            const vehicleTypeMatch = utf8String.match(/[a-zA-Z0-9]+\.[a-zA-Z0-9_]+/);
            extracted.vehicleType = vehicleTypeMatch ? vehicleTypeMatch[0] : null;

            // Part-like names (e.g. TrunkDoor, Engine, customName)
            const partPattern = /(?:TrunkDoor|Engine|Battery|GasTank|Muffler|Windshield|Seat|Door|Tire|Brake|GloveBox|Radio|customName|Base\.\w+)/g;
            const parts = [...new Set((utf8String.match(partPattern) || []).filter(Boolean))];
            if (parts.length) extracted.partNames = parts;

            // Custom names (often follow "customName" in stream)
            const customNames = strings.filter(
                (s) =>
                    s.length > 2 &&
                    s.length < 80 &&
                    /^[\x20-\x7e]+$/.test(s) &&
                    !s.includes(".") &&
                    !/^(Base|customName|Tooltip|contentAmount|Trunk|Seat|Door|Engine|Battery|GasTank|Muffler|Windshield|Brake|Tire|Radio|GloveBox)$/i.test(s)
            );
            if (customNames.length) extracted.customNames = [...new Set(customNames)].slice(0, 20);

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
                    !/^\d+$/.test(s)
            );
            if (nameCandidates.length) {
                // Prefer short strings that look like first/last names
                const likelyNames = nameCandidates.filter((s) => s.length <= 20 && s.trim().length >= 2);
                extracted.characterNames = [...new Set(likelyNames)].slice(0, 10);
            }

            // Profession (base:xxx)
            const professions = strings.filter((s) => /^base:[a-z]+$/i.test(s) && s.length < 30);
            if (professions.length) extracted.professionIds = [...new Set(professions)];

            // Trait-like (base:thinskinned, base:burglar, etc.)
            const traits = strings.filter(
                (s) =>
                    s.startsWith("base:") &&
                    s.length > 6 &&
                    s.length < 60 &&
                    !extracted.professionIds?.includes(s)
            );
            if (traits.length) extracted.traitOrSkillIds = [...new Set(traits)].slice(0, 50);

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
                    (appearancePattern.test(s) || /_(Hair|Beard|Chin|Nose|Eyes)/i.test(s))
            );
            if (appearance.length) extracted.appearance = [...new Set(appearance)].slice(0, 30);

            // Clothing / equipment: Base.* item types and TINT-style
            const clothingTypes = strings.filter(
                (s) =>
                    (s.startsWith("Base.") && s.length < 80 && /^[A-Za-z0-9_.]+$/.test(s)) ||
                    (/^[A-Za-z0-9_]+TINT$/i.test(s) && s.length < 60)
            );
            if (clothingTypes.length) extracted.clothingTypes = [...new Set(clothingTypes)].slice(0, 50);

            // Short custom names that may be equipment names (exclude character names and known non-equipment)
            const clothingCustomNames = strings.filter(
                (s) =>
                    s.length >= 2 &&
                    s.length <= 40 &&
                    /^[\x20-\x7e]+$/.test(s) &&
                    !s.includes(".") &&
                    !s.startsWith("base:") &&
                    !/^(Base|Tooltip|contentAmount|Strength|Fitness|Sneak|Nimble|Make|ID Card|Key Ring)$/i.test(s) &&
                    !(extracted.characterNames || []).some((n) => n === s)
            );
            if (clothingCustomNames.length)
                extracted.clothingCustomNames = [...new Set(clothingCustomNames)].slice(0, 20);

            // Inventory-like strings (ID Card:, Key Ring, 's Key, descriptive lines)
            const inventoryStrings = strings.filter(
                (s) =>
                    s.length >= 10 &&
                    s.length <= 80 &&
                    /^[\x20-\x7e]+$/.test(s) &&
                    (s.includes(":") || s.includes("'") || /Key Ring|ID Card|Key\b/i.test(s))
            );
            if (inventoryStrings.length) extracted.inventoryStrings = [...new Set(inventoryStrings)].slice(0, 30);

            // Recipes (e.g. Make*, or common PZ recipe prefixes)
            const recipeIds = strings.filter(
                (s) => /^Make[A-Za-z0-9_]*$/i.test(s) || /^[A-Za-z]+\.[A-Za-z0-9_]+Recipe$/i.test(s)
            );
            if (recipeIds.length) extracted.recipeIds = [...new Set(recipeIds)].slice(0, 100);

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
                    !knownNonUsernames.includes(s)
            );
            if (usernameFromBuffer) extracted.usernameFromBuffer = usernameFromBuffer;

            // Skill XP / raw numbers for levels (XP amounts per level; level calculation done later in frontend)
            const skillXp = extractSkillXpFromBuffer(buf, extracted.statNames || []);
            if (Object.keys(skillXp).length) extracted.skillXp = skillXp;

            // Skill levels: name + 0x00 + 4-byte BE int (0–10) in main skill block
            const skillLevels = extractSkillLevelsFromBuffer(buf, extracted.statNames || []);
            if (Object.keys(skillLevels).length) extracted.skillLevels = skillLevels;
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
            while (end < buf.length && buf[end] !== 0 && buf[end] >= 0x20 && buf[end] <= 0x7e) end++;
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
 * Extract skill levels from the main skill block: [name][0x00][4-byte BE int] with level 0–10.
 * Uses first valid occurrence per skill to avoid mixing with other structures (e.g. doubles).
 * @param {Buffer} buf - Full player buffer
 * @param {string[]} statNames - e.g. ['Strength', 'Fitness', 'Sneak', ...]
 * @returns {{ [skillName: string]: number }} skill name -> level (0–10)
 */
function extractSkillLevelsFromBuffer(buf, statNames) {
    const skillLevels = {};
    if (!buf || buf.length < 10 || !statNames || statNames.length === 0) return skillLevels;

    for (const name of statNames) {
        if (skillLevels[name] !== undefined) continue;
        const nameBuf = Buffer.from(name, "utf8");
        let i = 0;
        while (i <= buf.length - nameBuf.length - 5) {
            if (buf.subarray(i, i + nameBuf.length).compare(nameBuf) !== 0) {
                i++;
                continue;
            }
            const after = i + nameBuf.length;
            if (buf[after] === 0 && after + 5 <= buf.length) {
                const level = buf.readUInt32BE(after + 1);
                if (level <= 10) {
                    skillLevels[name] = level;
                    break;
                }
            }
            i = after + 1;
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
    if (!buf || buf.length < 10 || !statNames || statNames.length === 0) return skillXp;

    for (const name of statNames) {
        const nameBuf = Buffer.from(name, "utf8");
        const values = [];
        let i = 0;
        while (i < buf.length - nameBuf.length - 8) {
            const match = buf.subarray(i, i + nameBuf.length).compare(nameBuf) === 0;
            if (match) {
                const after = i + nameBuf.length;
                if (after + 8 <= buf.length) {
                    try {
                        const val = buf.readDoubleBE(after);
                        if (Number.isFinite(val) && val >= 0 && val < 1e10) values.push(val);
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
