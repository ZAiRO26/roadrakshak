// Script to enrich Kerala AI cameras with real speed limits from road data
// Run: node scripts/enrich-speed-limits.cjs
// This fetches actual road type data and infers correct speed limits

const fs = require('fs');
const path = require('path');

const CAMERAS_FILE = path.join(__dirname, '../src/data/official_cameras.json');
const DELAY_MS = 1100; // Nominatim rate limit: 1 request per second

// Infer speed limit from road characteristics (same logic as useSpeedLimit.ts)
function inferSpeedLimit(roadName, roadType) {
    const nameLower = (roadName || '').toLowerCase();
    const typeLower = (roadType || '').toLowerCase();

    // Expressways / National Highways
    if (nameLower.includes('expressway') ||
        nameLower.includes('nh-') ||
        nameLower.includes('nh ') ||
        nameLower.includes('national highway') ||
        typeLower.includes('motorway')) {
        return 100;
    }

    // State Highways
    if (nameLower.includes('sh-') ||
        nameLower.includes('sh ') ||
        nameLower.includes('state highway') ||
        typeLower.includes('trunk')) {
        return 80;
    }

    // Main roads / Ring roads / Bypasses
    if (nameLower.includes('ring road') ||
        nameLower.includes('outer ring') ||
        nameLower.includes('inner ring') ||
        nameLower.includes('bypass') ||
        typeLower.includes('primary')) {
        return 60;
    }

    // Major city roads
    if (nameLower.includes('marg') ||
        nameLower.includes('main road') ||
        typeLower.includes('secondary')) {
        return 50;
    }

    // Tertiary roads
    if (typeLower.includes('tertiary')) {
        return 45;
    }

    // Service roads
    if (nameLower.includes('service') ||
        typeLower.includes('service')) {
        return 30;
    }

    // Residential / Living streets
    if (typeLower.includes('residential') ||
        typeLower.includes('living_street') ||
        typeLower.includes('unclassified')) {
        return 30;
    }

    // Default - use road name context for Kerala
    if (nameLower.includes('road') || nameLower.includes('street')) {
        return 40;
    }

    // Unknown - keep original
    return null;
}

// Fetch road data from Nominatim
async function fetchRoadData(lat, lng) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'ZairoMaps-Enrichment/1.0 (github.com/ZAiRO26/roadrakshak)',
                },
            }
        );

        if (!response.ok) {
            console.log(`    API error: ${response.status}`);
            return null;
        }

        const data = await response.json();

        const roadName = data.address?.road ||
            data.address?.highway ||
            data.display_name?.split(',')[0] ||
            '';

        const roadType = data.type || data.class || '';

        return { roadName, roadType };
    } catch (error) {
        console.log(`    Fetch error: ${error.message}`);
        return null;
    }
}

// Sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    console.log('='.repeat(60));
    console.log('  KERALA AI CAMERA SPEED LIMIT ENRICHMENT');
    console.log('='.repeat(60));
    console.log();

    // Load cameras
    const cameras = JSON.parse(fs.readFileSync(CAMERAS_FILE, 'utf8'));
    console.log(`Total cameras in database: ${cameras.length}`);

    // Filter Kerala AI cameras
    const keralaCameras = cameras.filter(c => c.id.startsWith('ker_ai_'));
    console.log(`Kerala AI cameras to enrich: ${keralaCameras.length}`);
    console.log();

    let updated = 0;
    let unchanged = 0;
    let errors = 0;

    for (let i = 0; i < keralaCameras.length; i++) {
        const camera = keralaCameras[i];
        const progress = `[${i + 1}/${keralaCameras.length}]`;

        process.stdout.write(`${progress} ${camera.name}... `);

        // Fetch road data
        const roadData = await fetchRoadData(camera.lat, camera.lng);

        if (roadData) {
            const inferredLimit = inferSpeedLimit(roadData.roadName, roadData.roadType);

            if (inferredLimit !== null && inferredLimit !== camera.speed_limit) {
                const oldLimit = camera.speed_limit;

                // Find and update in main array
                const idx = cameras.findIndex(c => c.id === camera.id);
                if (idx !== -1) {
                    cameras[idx].speed_limit = inferredLimit;
                    updated++;
                    console.log(`${oldLimit} -> ${inferredLimit} km/h (${roadData.roadType || 'road'})`);
                }
            } else {
                unchanged++;
                console.log(`OK (${camera.speed_limit} km/h)`);
            }
        } else {
            errors++;
            console.log('SKIP (API error)');
        }

        // Rate limiting
        if (i < keralaCameras.length - 1) {
            await sleep(DELAY_MS);
        }
    }

    // Save updated data
    fs.writeFileSync(CAMERAS_FILE, JSON.stringify(cameras, null, 4));

    console.log();
    console.log('='.repeat(60));
    console.log('  ENRICHMENT COMPLETE');
    console.log('='.repeat(60));
    console.log(`  Updated: ${updated} cameras`);
    console.log(`  Unchanged: ${unchanged} cameras`);
    console.log(`  Errors: ${errors} cameras`);
    console.log('='.repeat(60));
}

main().catch(console.error);
