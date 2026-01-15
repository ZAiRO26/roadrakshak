// Script to merge all Kerala AI cameras into official_cameras.json
// Run: node scripts/merge-kerala-cameras.cjs

const fs = require('fs');
const path = require('path');

const CAMERAS_FILE = path.join(__dirname, '../src/data/official_cameras.json');

// Load all parts
const part1 = require('./kerala-data-part1.cjs');
const part2 = require('./kerala-data-part2.cjs');
const part3 = require('./kerala-data-part3.cjs');
const part4 = require('./kerala-data-part4.cjs');

// Combine all Kerala cameras
const keralaCameras = [...part1, ...part2, ...part3, ...part4];
console.log(`Total Kerala cameras to add: ${keralaCameras.length}`);

// Load existing cameras
const existingData = JSON.parse(fs.readFileSync(CAMERAS_FILE, 'utf8'));
console.log(`Existing cameras: ${existingData.length}`);

// Check for duplicates and add new cameras
let added = 0;
const existingIds = new Set(existingData.map(c => c.id));

keralaCameras.forEach(camera => {
    if (!existingIds.has(camera.id)) {
        existingData.push(camera);
        added++;
        existingIds.add(camera.id);
    } else {
        console.log(`Skipping duplicate: ${camera.id}`);
    }
});

// Save updated data
fs.writeFileSync(CAMERAS_FILE, JSON.stringify(existingData, null, 4));
console.log(`\nAdded ${added} Kerala AI cameras`);
console.log(`Total cameras now: ${existingData.length}`);

// Summary by district
const districts = {};
keralaCameras.forEach(c => {
    districts[c.city] = (districts[c.city] || 0) + 1;
});
console.log('\nKerala cameras by district:');
Object.entries(districts).forEach(([city, count]) => {
    console.log(`   ${city}: ${count}`);
});
