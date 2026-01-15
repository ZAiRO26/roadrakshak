// Script to add Kerala AI cameras to official_cameras.json
// Run: node scripts/add-kerala-cameras.js

const fs = require('fs');
const path = require('path');

const CAMERAS_FILE = path.join(__dirname, '../src/data/official_cameras.json');

// Kerala AI Camera data - Part 1 (Thiruvananthapuram & Kollam)
const keralaCameras = [
    { "id": "ker_ai_001", "city": "Thiruvananthapuram", "name": "AI Cam: Parassala", "type": "AI_CAM", "speed_limit": 60, "lat": 8.3150151, "lng": 77.1287226 },
    { "id": "ker_ai_002", "city": "Thiruvananthapuram", "name": "AI Cam: Pambukala", "type": "AI_CAM", "speed_limit": 60, "lat": 8.3254417, "lng": 77.0641614 },
    { "id": "ker_ai_003", "city": "Thiruvananthapuram", "name": "AI Cam: Kovalam Jn", "type": "AI_CAM", "speed_limit": 60, "lat": 8.3998494, "lng": 76.9808770 },
    { "id": "ker_ai_004", "city": "Thiruvananthapuram", "name": "AI Cam: Neyyattinkara (Main)", "type": "AI_CAM", "speed_limit": 60, "lat": 8.4078907, "lng": 77.0794932 },
    { "id": "ker_ai_005", "city": "Thiruvananthapuram", "name": "AI Cam: Neyyattinkara (Town)", "type": "AI_CAM", "speed_limit": 50, "lat": 8.4080435, "lng": 77.0792108 },
    { "id": "ker_ai_006", "city": "Thiruvananthapuram", "name": "AI Cam: Thozhukkal", "type": "AI_CAM", "speed_limit": 60, "lat": 8.4167193, "lng": 77.0803191 },
    { "id": "ker_ai_007", "city": "Thiruvananthapuram", "name": "AI Cam: Balaramapuram (South)", "type": "AI_CAM", "speed_limit": 50, "lat": 8.4263583, "lng": 77.0389850 },
    { "id": "ker_ai_008", "city": "Thiruvananthapuram", "name": "AI Cam: Balaramapuram (North)", "type": "AI_CAM", "speed_limit": 50, "lat": 8.4271586, "lng": 77.0395764 },
    { "id": "ker_ai_009", "city": "Thiruvananthapuram", "name": "AI Cam: Pallichal Jn", "type": "AI_CAM", "speed_limit": 60, "lat": 8.4431159, "lng": 77.0173222 },
    { "id": "ker_ai_010", "city": "Thiruvananthapuram", "name": "AI Cam: Thiruvallom", "type": "AI_CAM", "speed_limit": 60, "lat": 8.4431921, "lng": 76.9524799 },
    { "id": "ker_ai_011", "city": "Thiruvananthapuram", "name": "AI Cam: Kumarichantha", "type": "AI_CAM", "speed_limit": 60, "lat": 8.4516364, "lng": 76.9470077 },
    { "id": "ker_ai_012", "city": "Thiruvananthapuram", "name": "AI Cam: Vellayani Jn (South)", "type": "AI_CAM", "speed_limit": 60, "lat": 8.4590336, "lng": 76.9973992 },
    { "id": "ker_ai_013", "city": "Thiruvananthapuram", "name": "AI Cam: Vellayani Jn (North)", "type": "AI_CAM", "speed_limit": 60, "lat": 8.4590994, "lng": 76.9974916 },
    { "id": "ker_ai_014", "city": "Thiruvananthapuram", "name": "AI Cam: Manacaud Jn", "type": "AI_CAM", "speed_limit": 50, "lat": 8.4719437, "lng": 76.9481288 },
    { "id": "ker_ai_015", "city": "Thiruvananthapuram", "name": "AI Cam: Eenjakkal (Bypass 1)", "type": "AI_CAM", "speed_limit": 60, "lat": 8.4805714, "lng": 76.9351440 },
    { "id": "ker_ai_016", "city": "Thiruvananthapuram", "name": "AI Cam: Eenjakkal (Bypass 2)", "type": "AI_CAM", "speed_limit": 60, "lat": 8.4807817, "lng": 76.9359144 },
    { "id": "ker_ai_017", "city": "Thiruvananthapuram", "name": "AI Cam: Killipalam (PRS Hospital)", "type": "AI_CAM", "speed_limit": 50, "lat": 8.4813394, "lng": 76.9595876 },
    { "id": "ker_ai_018", "city": "Thiruvananthapuram", "name": "AI Cam: Killipalam (Junction)", "type": "AI_CAM", "speed_limit": 50, "lat": 8.4815023, "lng": 76.9582123 },
    { "id": "ker_ai_019", "city": "Thiruvananthapuram", "name": "AI Cam: Power House Road", "type": "AI_CAM", "speed_limit": 40, "lat": 8.4849944, "lng": 76.9529890 },
    { "id": "ker_ai_020", "city": "Thiruvananthapuram", "name": "AI Cam: East Fort Stretch", "type": "AI_CAM", "speed_limit": 30, "lat": 8.4859640, "lng": 76.9478151 },
    { "id": "ker_ai_021", "city": "Thiruvananthapuram", "name": "AI Cam: Thambanoor", "type": "AI_CAM", "speed_limit": 40, "lat": 8.4870139, "lng": 76.9521384 },
    { "id": "ker_ai_022", "city": "Thiruvananthapuram", "name": "AI Cam: Malayinkeezh", "type": "AI_CAM", "speed_limit": 50, "lat": 8.4875062, "lng": 77.0364776 },
    { "id": "ker_ai_023", "city": "Thiruvananthapuram", "name": "AI Cam: Kaithamukk", "type": "AI_CAM", "speed_limit": 40, "lat": 8.4895629, "lng": 76.9401949 },
    { "id": "ker_ai_024", "city": "Thiruvananthapuram", "name": "AI Cam: MG Road", "type": "AI_CAM", "speed_limit": 40, "lat": 8.4902162, "lng": 76.9473004 },
    { "id": "ker_ai_025", "city": "Thiruvananthapuram", "name": "AI Cam: Poojapura", "type": "AI_CAM", "speed_limit": 50, "lat": 8.4910375, "lng": 76.9738924 },
    { "id": "ker_ai_026", "city": "Thiruvananthapuram", "name": "AI Cam: All Saints", "type": "AI_CAM", "speed_limit": 60, "lat": 8.4946185, "lng": 76.9098068 },
    { "id": "ker_ai_027", "city": "Thiruvananthapuram", "name": "AI Cam: Pettah", "type": "AI_CAM", "speed_limit": 50, "lat": 8.4952048, "lng": 76.9275781 },
    { "id": "ker_ai_028", "city": "Thiruvananthapuram", "name": "AI Cam: Vettukadu", "type": "AI_CAM", "speed_limit": 50, "lat": 8.4965309, "lng": 76.8987359 },
    { "id": "ker_ai_029", "city": "Thiruvananthapuram", "name": "AI Cam: Holy Angels Road", "type": "AI_CAM", "speed_limit": 40, "lat": 8.4980147, "lng": 76.9428620 },
    { "id": "ker_ai_030", "city": "Thiruvananthapuram", "name": "AI Cam: AKG Center", "type": "AI_CAM", "speed_limit": 40, "lat": 8.5004062, "lng": 76.9461896 }
];

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
    }
});

// Save updated data
fs.writeFileSync(CAMERAS_FILE, JSON.stringify(existingData, null, 4));
console.log(`Added ${added} Kerala AI cameras. Total: ${existingData.length}`);
