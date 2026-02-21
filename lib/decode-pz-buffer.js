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

            // Stats/skills (Strength, Fitness, etc.)
            const statNames = strings.filter((s) =>
                /^(Strength|Fitness|Sneak|Nimble|Lightfoot|Sprinting|Voice|etc)$/i.test(s)
            );
            if (statNames.length) extracted.statNames = [...new Set(statNames)];
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

module.exports = { decodePzBuffer };
