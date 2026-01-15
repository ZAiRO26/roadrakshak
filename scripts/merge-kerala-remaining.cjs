// Script to merge ALL Kerala AI cameras (Parts 5-13) into official_cameras.json
// Run: node scripts/merge-kerala-remaining.cjs

const fs = require('fs');
const path = require('path');

const CAMERAS_FILE = path.join(__dirname, '../src/data/official_cameras.json');

// Load all new parts (5-13)
const part5 = require('./kerala-data-part5.cjs');
const part6 = require('./kerala-data-part6.cjs');
const part7 = require('./kerala-data-part7.cjs');
const part8 = require('./kerala-data-part8.cjs');
const part9 = require('./kerala-data-part9.cjs');
const part10 = require('./kerala-data-part10.cjs');
const part11 = require('./kerala-data-part11.cjs');
const part12 = require('./kerala-data-part12.cjs');
const part13 = require('./kerala-data-part13.cjs');

// Combine all remaining Kerala cameras
const keralaCameras = [
    ...part5, ...part6, ...part7, ...part8, ...part9,
    ...part10, ...part11, ...part12, ...part13
];
console.log(`Total new Kerala cameras to add: ${keralaCameras.length}`);

// Load existing cameras
const existingData = JSON.parse(fs.readFileSync(CAMERAS_FILE, 'utf8'));
console.log(`Existing cameras: ${existingData.length}`);

// Check for duplicates and add new cameras
let added = 0;
let skipped = 0;
const existingIds = new Set(existingData.map(c => c.id));

keralaCameras.forEach(camera => {
    if (!existingIds.has(camera.id)) {
        existingData.push(camera);
        added++;
        existingIds.add(camera.id);
    } else {
        skipped++;
    }
});

// Save updated data
fs.writeFileSync(CAMERAS_FILE, JSON.stringify(existingData, null, 4));
console.log(`\nAdded ${added} new Kerala AI cameras`);
console.log(`Skipped ${skipped} duplicates`);
console.log(`Total cameras now: ${existingData.length}`);

// Summary by district
const allKerala = existingData.filter(c => c.id.startsWith('ker_ai_'));
const districts = {};
allKerala.forEach(c => {
    districts[c.city] = (districts[c.city] || 0) + 1;
});
console.log('\nAll Kerala cameras by district:');
Object.entries(districts).sort((a, b) => b[1] - a[1]).forEach(([city, count]) => {
    console.log(`   ${city}: ${count}`);
});
console.log(`\n   TOTAL KERALA: ${allKerala.length}`);
