# RoadRakshak 🛡️

**Real-time driver assistance PWA for India** - Avoid speeding fines and detect enforcement cameras using a hybrid data approach.

![RoadRakshak Demo](./docs/demo.png)

## ✨ Features

- **📍 Real-time Speed Tracking** - GPS-based speed monitoring with km/h display
- **🚦 Speed Limit Alerts** - Visual & audio warnings when exceeding road limits
- **📷 Speed Camera Detection** - OSM-powered camera location alerts
- **🚔 Crowdsourced Police Reports** - Community-driven checkpoint warnings
- **🌙 Dark/Light Theme** - Optimized for day and night driving
- **📱 PWA Ready** - Install on your phone, works offline

## 🏗️ Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Maps | MapLibre GL JS + CARTO tiles |
| State | Zustand |
| Speed Data | Ola Maps API (mock included) |
| Camera Data | OpenStreetMap Overpass API |
| Real-time DB | Firebase Firestore (optional) |

## 🚀 Quick Start

```bash
# Clone and install
git clone <repo-url>
cd RoadRakshak
npm install

# Start development server
npm run dev

# Open http://localhost:5173 on your phone (same network)
```

## ⚙️ Configuration

Create a `.env` file from the example:

```bash
cp .env.example .env
```

### API Keys (Optional)

The app works with mock data by default. For production:

| Service | Get Key From | Free Tier |
|---------|--------------|-----------|
| Ola Maps | [cloud.olakrutrim.com](https://cloud.olakrutrim.com) | 5M calls/month |
| Firebase | [console.firebase.google.com](https://console.firebase.google.com) | Generous free tier |

```env
# .env
VITE_OLA_API_KEY=your_ola_api_key
VITE_FIREBASE_API_KEY=your_firebase_key
VITE_FIREBASE_PROJECT_ID=your_project_id
```

## 📁 Project Structure

```
src/
├── components/       # UI Components
│   ├── MapBoard.tsx     # MapLibre map with markers
│   ├── Speedometer.tsx  # Speed display widget
│   ├── Controls.tsx     # Theme/mute buttons
│   ├── ReportButton.tsx # Police report FAB
│   └── AlertBanner.tsx  # Warning notifications
├── hooks/            # React Hooks
│   ├── useGPS.ts        # Geolocation tracking
│   ├── useSpeedLimit.ts # Speed limit fetching
│   ├── useAlerts.ts     # Proximity alerts
│   └── useWakeLock.ts   # Screen wake lock
├── services/         # API Services
│   ├── OlaApiService.ts     # Ola Maps integration
│   ├── OverpassService.ts   # OSM camera data
│   └── FirebaseService.ts   # Crowdsourcing backend
├── stores/           # Zustand State
│   ├── gpsStore.ts      # GPS state
│   └── appStore.ts      # App settings & data
└── App.tsx           # Main application
```

## 📱 Using the App

1. **Open on Mobile** - Visit the URL in Chrome/Safari
2. **Allow Location** - GPS permission is required
3. **Start Driving** - Speed and limits update automatically
4. **Report Police** - Tap 🚔 button to report checkpoints
5. **Mute Alerts** - Tap 🔊 to silence audio warnings

## 🔧 Development

```bash
# Type checking
npm run build

# Lint
npm run lint

# Preview production build
npm run preview
```

## 📄 License

MIT License - See [LICENSE](./LICENSE) for details.

## 🙏 Acknowledgments

- [Ola Maps](https://maps.olakrutrim.com) - Speed limit data
- [OpenStreetMap](https://openstreetmap.org) - Camera locations
- [MapLibre GL JS](https://maplibre.org) - Map rendering
- [CARTO](https://carto.com) - Base map tiles

---

**Made with ❤️ for Indian drivers**
