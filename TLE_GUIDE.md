# 🛰️ TLE Satellite Controls - Quick Guide

## Where to Find the TLE Satellite Controls

After opening http://localhost:3000 in your browser, you should see:

### Main Interface Layout
```
┌─────────────────────────────────┬─────────────────────┐
│                                 │                     │
│         3D Earth View           │    Control Panel    │
│                                 │                     │
│     (Rotating Earth with        │  ┌─────────────────┐ │
│      satellite orbits)          │  │ Simulation Speed│ │
│                                 │  ├─────────────────┤ │
│                                 │  │ Manual Satellite│ │
│                                 │  ├─────────────────┤ │
│                                 │  │ ☑️ Show Manual  │ │
│                                 │  ├─────────────────┤ │
│                                 │  │ TLE Satellites  │ │
│                                 │  │ 🛰️ Add TLE Sat │ │
│                                 │  │ Quick Add:      │ │
│                                 │  │ [🚀ISS] [🔭HST] │ │
│                                 │  │ [📡SL] [🌍NOAA] │ │
│                                 │  └─────────────────┘ │
└─────────────────────────────────┴─────────────────────┘
```

### TLE Satellite Section Location
Look for this section in the control panel:

**TLE Satellites (0)**
- **🛰️ Add TLE Satellite** ← Main green button
- **Quick Add Popular Satellites:** ← Grid of 4 buttons below

### Expected Buttons You Should See:

1. **Main Button:** 
   - Green button with satellite emoji: "🛰️ Add TLE Satellite"

2. **Quick Add Buttons (4 small buttons):**
   - 🚀 ISS (ZARYA)
   - 🔭 Hubble Space...
   - 📡 Starlink-1007  
   - 🌍 NOAA-19 Wea...

## Troubleshooting

### If you don't see the TLE controls:

1. **Refresh the page** (Ctrl+F5 or Cmd+Shift+R)
2. **Check the URL**: Make sure you're on http://localhost:3000
3. **Scroll down** in the control panel - the TLE section is below the manual satellite controls
4. **Check browser console** for any JavaScript errors (F12 → Console tab)

### If the page doesn't load:

1. **Check container status**: 
   ```bash
   docker ps
   ```
   You should see "spacecore-simulation" running

2. **Check container logs**:
   ```bash
   docker logs spacecore-simulation
   ```

## Test Instructions

1. Open http://localhost:3000
2. Look at the right side control panel
3. Scroll down to find "TLE Satellites (0)"
4. Click "🚀 ISS (ZARYA)" quick-add button
5. You should see the ISS appear as a green satellite orbiting Earth!

## What You Should See After Adding ISS:
- Green orbital line around Earth
- Small satellite model moving along the orbit
- Green trail following the satellite
- "TLE Satellites (1)" counter updated
- ISS entry in the satellite list with toggle controls

