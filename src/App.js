import React, { useState, useEffect, useCallback, Component, useRef } from 'react';
import './App.css';
import SpaceSimulation from './components/SpaceSimulation';
import ControlPanel from './components/ControlPanel';
import { parseTLE } from './utils/tleParser';
import { COLOR_SCHEMES, DEFAULT_COLOR_SCHEME } from './themes/colorSchemes';

// Error Boundary Component
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('SpaceCore Simulation Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#000',
          color: '#ff4444',
          fontFamily: 'monospace'
        }}>
          <h1>SpaceCore Simulation Error</h1>
          <p>WebGL may not be supported on this device.</p>
          <p>Please try refreshing the page or using a different browser.</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              background: '#333',
              color: 'white',
              border: '1px solid #555',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const simulationElapsedRef = useRef(0);
  const [exportRequest, setExportRequest] = useState({ id: 0, format: 'glb' });
  const satelliteParams = {
    altitude: 400, // km above Earth's surface
    inclination: 51.6, // degrees (ISS-like orbit)
    speed: 7.66, // km/s (orbital velocity)
  };

  // State for TLE satellites (not auto-persisted)
  const [tleSatellites, setTleSatellites] = useState([]);

  // User-saved TLEs in localStorage (shown as quick-add buttons)
  const [savedTles, setSavedTles] = useState(() => {
    try {
      const stored = localStorage.getItem('spacecore_saved_tles');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Failed to load saved TLEs:', e);
    }
    return [];
  });
  const showManualSatellite = false;

  const [colorScheme, setColorScheme] = useState(() => {
    try {
      const stored = localStorage.getItem('spacecore_color_scheme');
      if (stored && COLOR_SCHEMES[stored]) return stored;
    } catch (e) {
      console.warn('Failed to load color scheme:', e);
    }
    return DEFAULT_COLOR_SCHEME;
  });
  const theme = COLOR_SCHEMES[colorScheme];
  
  // State for satellite coverage data
  const [satelliteCoverageData, setSatelliteCoverageData] = useState({});
  
  // Global minimum elevation angle (degrees)
  const [minElevationAngle, setMinElevationAngle] = useState(0);

  // Global union coverage result
  const [globalCoveragePercent, setGlobalCoveragePercent] = useState(0);
  const [globalCoverageAreaKm2, setGlobalCoverageAreaKm2] = useState(0);

  // Globe visibility and grid visibility
  const [showEarth, setShowEarth] = useState(true);
  const [showEarthGrid, setShowEarthGrid] = useState(true);

  const REAL_EARTH_RADIUS_KM = 6378.137;
  const totalEarthAreaKm2 = 4 * Math.PI * REAL_EARTH_RADIUS_KM * REAL_EARTH_RADIUS_KM;

  // Deterministic lat-lon weighted grid (cached by resolution)
  const gridCacheRef = useRef({});
  const getLatLonGrid = (latStepDeg, lonStepDeg) => {
    const key = `${latStepDeg}:${lonStepDeg}`;
    if (gridCacheRef.current[key]) return gridCacheRef.current[key];

    const latSteps = Math.round(180 / latStepDeg);
    const lonSteps = Math.round(360 / lonStepDeg);
    const points = [];
    const weights = [];

    // Lat bands from -90 to +90
    for (let i = 0; i < latSteps; i++) {
      const lat1 = -90 + i * latStepDeg;
      const lat2 = lat1 + latStepDeg;
      // Use band center for direction sampling
      const latCenter = (lat1 + lat2) / 2;
      const phi = (latCenter * Math.PI) / 180; // latitude
      const cosPhi = Math.cos(phi);
      const sinPhi = Math.sin(phi);

      // Band area fraction for one lon cell: Δλ (sinφ2 − sinφ1) / (4π)
      const sinPhi1 = Math.sin((lat1 * Math.PI) / 180);
      const sinPhi2 = Math.sin((lat2 * Math.PI) / 180);
      const bandAreaFracPerLon = ((lonStepDeg * Math.PI) / 180) * (sinPhi2 - sinPhi1) / (4 * Math.PI);

      for (let j = 0; j < lonSteps; j++) {
        const lonCenter = -180 + (j + 0.5) * lonStepDeg;
        const lambda = (lonCenter * Math.PI) / 180;
        const cosLambda = Math.cos(lambda);
        const sinLambda = Math.sin(lambda);
        const x = cosPhi * cosLambda;
        const y = sinPhi;
        const z = cosPhi * sinLambda;
        points.push({ x, y, z });
        weights.push(bandAreaFracPerLon);
      }
    }

    const grid = { points, weights };
    gridCacheRef.current[key] = grid;
    return grid;
  };

  const recomputeGlobalCoverage = useCallback(() => {
    const active = tleSatellites.filter(s => s.showCoverage);
    const activeSatIds = active.map(s => s.id);

    if (activeSatIds.length === 0) {
      setGlobalCoveragePercent(0);
      setGlobalCoverageAreaKm2(0);
      return;
    }

    let rawSats = [];
    for (const id of activeSatIds) {
      const cov = satelliteCoverageData[id];
      if (!cov || !cov.direction || !isFinite(cov.centralAngle) || cov.centralAngle <= 0) continue;
      const { x, y, z } = cov.direction;
      const dirLen = Math.sqrt(x * x + y * y + z * z) || 1;
      const ux = x / dirLen, uy = y / dirLen, uz = z / dirLen;
      const cosThreshold = Math.cos(cov.centralAngle);
      rawSats.push({ ux, uy, uz, cosThreshold, psi: cov.centralAngle });
    }

    if (rawSats.length === 0) {
      setGlobalCoveragePercent(0);
      setGlobalCoverageAreaKm2(0);
      return;
    }

    // Drop dominated caps (caps entirely contained by another cap)
    const sats = [];
    for (let i = 0; i < rawSats.length; i++) {
      let contained = false;
      const ai = rawSats[i];
      for (let j = 0; j < rawSats.length; j++) {
        if (i === j) continue;
        const aj = rawSats[j];
        // angular separation between centers
        const dot = ai.ux * aj.ux + ai.uy * aj.uy + ai.uz * aj.uz;
        const sep = Math.acos(Math.min(1, Math.max(-1, dot)));
        if (aj.psi >= ai.psi + sep - 1e-12) {
          contained = true;
          break;
        }
      }
      if (!contained) sats.push(ai);
    }

    if (sats.length === 0) {
      setGlobalCoveragePercent(0);
      setGlobalCoverageAreaKm2(0);
      return;
    }

    // Choose resolution adaptively based on constellation size and smallest cap
    const minPsiDeg = sats.reduce((m, s) => Math.min(m, s.psi * 180 / Math.PI), Infinity);
    let latStep = 1.0;
    let lonStep = 1.0;
    if (sats.length > 40 || minPsiDeg < 3) {
      latStep = 0.25; lonStep = 0.25;
    } else if (sats.length > 20 || minPsiDeg < 6) {
      latStep = 0.5; lonStep = 0.5;
    }

    const { points, weights } = getLatLonGrid(latStep, lonStep);

    const eps = 1e-12;
    let coveredFrac = 0;
    for (let idx = 0; idx < points.length; idx++) {
      const p = points[idx];
      const w = weights[idx];
      const px = p.x, py = p.y, pz = p.z;
      let covered = false;
      for (let i = 0; i < sats.length; i++) {
        const s = sats[i];
        const dot = px * s.ux + py * s.uy + pz * s.uz;
        if (dot + eps >= s.cosThreshold) {
          covered = true;
          break;
        }
      }
      if (covered) coveredFrac += w;
    }

    const percent = coveredFrac * 100;
    setGlobalCoveragePercent(percent);
    setGlobalCoverageAreaKm2((percent / 100) * totalEarthAreaKm2);
  }, [tleSatellites, satelliteCoverageData, totalEarthAreaKm2]);

  // Recompute global union coverage whenever satellites or coverage data change
  useEffect(() => {
    recomputeGlobalCoverage();
  }, [recomputeGlobalCoverage]);

  // Function to add TLE satellite
  const addTLESatellite = (name, line1, line2) => {
    try {
      const tleData = parseTLE(line1, line2, name);
      const newSatellite = {
        id: Date.now(),
        tleData,
        color: theme.pickSatelliteColor(tleSatellites.length),
        showOrbit: true,
        showTrail: true,
        showCoverage: true,
        rawName: name,
        rawLine1: line1,
        rawLine2: line2
      };
      setTleSatellites(prev => {
        if (prev.some(s => s.rawLine1 === line1 && s.rawLine2 === line2)) return prev;
        return [...prev, newSatellite];
      });
      return true;
    } catch (error) {
      console.error('Error adding TLE satellite:', error);
      alert(`Error adding satellite: ${error.message}`);
      return false;
    }
  };

  // Save a TLE to localStorage (user-triggered)
  const saveTle = (satellite) => {
    if (!satellite || !satellite.rawLine1) {
      console.warn('saveTle: satellite missing rawLine1', satellite);
      return;
    }
    const entry = { rawName: satellite.rawName, rawLine1: satellite.rawLine1, rawLine2: satellite.rawLine2 };
    setSavedTles(prev => {
      if (prev.some(s => s.rawLine1 === entry.rawLine1 && s.rawLine2 === entry.rawLine2)) {
        console.log('saveTle: already saved', entry.rawName);
        return prev;
      }
      const updated = [...prev, entry];
      localStorage.setItem('spacecore_saved_tles', JSON.stringify(updated));
      console.log('saveTle: saved', entry.rawName, 'total:', updated.length);
      return updated;
    });
  };

  // Remove a saved TLE from localStorage
  const removeSavedTle = (index) => {
    setSavedTles(prev => {
      const updated = prev.filter((_, i) => i !== index);
      localStorage.setItem('spacecore_saved_tles', JSON.stringify(updated));
      return updated;
    });
  };

  // Function to remove TLE satellite
  const removeTLESatellite = (id) => {
    setTleSatellites(prev => prev.filter(sat => sat.id !== id));
  };

  // Function to remove all TLE satellites
  const removeAllTleSatellites = () => {
    setTleSatellites([]);
    setSatelliteCoverageData({});
  };

  // Function to update satellite coverage data
  const updateSatelliteCoverage = (satelliteId, coverageData) => {
    setSatelliteCoverageData(prev => {
      const next = { ...prev, [satelliteId]: coverageData };
      return next;
    });
  };

  // Global visibility toggle functions
  const toggleAllSatelliteVisibility = (property, value) => {
    setTleSatellites(prev => prev.map(sat => ({ ...sat, [property]: value })));
  };

  const handleColorSchemeChange = (schemeId) => {
    setColorScheme(schemeId);
    try {
      localStorage.setItem('spacecore_color_scheme', schemeId);
    } catch (e) {
      console.warn('Failed to save color scheme:', e);
    }
  };

  const handleExportComplete = useCallback(() => {}, []);

  const requestSceneExport = useCallback((format = 'glb') => {
    setExportRequest((prev) => ({ id: prev.id + 1, format }));
  }, []);

  return (
    <ErrorBoundary>
      <div className="App" data-theme={colorScheme} style={{ '--canvas-bg': theme.canvas }}>
        <div className="canvas-wrapper">
          <div className="canvas-left-spacer" />
          <div className="canvas-scene">
            <SpaceSimulation 
              simulationSpeed={simulationSpeed}
              satelliteParams={satelliteParams}
              tleSatellites={tleSatellites}
              showManualSatellite={showManualSatellite}
              updateSatelliteCoverage={updateSatelliteCoverage}
              minElevationAngle={minElevationAngle}
              showEarth={showEarth}
              showEarthGrid={showEarthGrid}
              theme={theme}
              isPaused={isPaused}
              simulationElapsedRef={simulationElapsedRef}
              exportRequest={exportRequest}
              onExportComplete={handleExportComplete}
            />
          </div>
        </div>
        <ControlPanel 
          simulationSpeed={simulationSpeed}
          setSimulationSpeed={setSimulationSpeed}
          isPaused={isPaused}
          setIsPaused={setIsPaused}
          simulationElapsedRef={simulationElapsedRef}
          onDownloadModel={() => requestSceneExport('glb')}
          onDownloadSvg={() => requestSceneExport('svg')}
          tleSatellites={tleSatellites}
          addTLESatellite={addTLESatellite}
          removeTLESatellite={removeTLESatellite}
          removeAllTleSatellites={removeAllTleSatellites}
          saveTle={saveTle}
          savedTles={savedTles}
          removeSavedTle={removeSavedTle}
          toggleAllSatelliteVisibility={toggleAllSatelliteVisibility}
          satelliteCoverageData={satelliteCoverageData}
          minElevationAngle={minElevationAngle}
          setMinElevationAngle={setMinElevationAngle}
          globalCoveragePercent={globalCoveragePercent}
          globalCoverageAreaKm2={globalCoverageAreaKm2}
          showEarth={showEarth}
          setShowEarth={setShowEarth}
          showEarthGrid={showEarthGrid}
          setShowEarthGrid={setShowEarthGrid}
          colorScheme={colorScheme}
          setColorScheme={handleColorSchemeChange}
        />
      </div>
    </ErrorBoundary>
  );
}

export default App;