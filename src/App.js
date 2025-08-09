import React, { useState, Component, useMemo, useRef } from 'react';
import './App.css';
import SpaceSimulation from './components/SpaceSimulation';
import ControlPanel from './components/ControlPanel';
import { parseTLE, SAMPLE_TLES } from './utils/tleParser';

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
  const [satelliteParams, setSatelliteParams] = useState({
    altitude: 400, // km above Earth's surface
    inclination: 51.6, // degrees (ISS-like orbit)
    speed: 7.66, // km/s (orbital velocity)
  });

  // State for TLE satellites
  const [tleSatellites, setTleSatellites] = useState([]);
  const [showManualSatellite, setShowManualSatellite] = useState(false);
  
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

  // Precompute quasi-uniform samples on the unit sphere (Fibonacci lattice)
  const sphereSamples = useMemo(() => {
    const NUM_SAMPLES = 2048; // balance accuracy and speed
    const samples = new Array(NUM_SAMPLES);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < NUM_SAMPLES; i++) {
      const t = (i + 0.5) / NUM_SAMPLES;
      const z = 1 - 2 * t;
      const r = Math.sqrt(Math.max(0, 1 - z * z));
      const theta = i * goldenAngle;
      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);
      samples[i] = { x, y, z };
    }
    return samples;
  }, []);

  const REAL_EARTH_RADIUS_KM = 6378.137;
  const totalEarthAreaKm2 = 4 * Math.PI * REAL_EARTH_RADIUS_KM * REAL_EARTH_RADIUS_KM;

  // Recompute global union coverage using current per-satellite coverage data
  const recomputeGlobalCoverage = () => {
    const activeSatIds = tleSatellites
      .filter(s => s.showCoverage)
      .map(s => s.id);

    if (activeSatIds.length === 0) {
      setGlobalCoveragePercent(0);
      setGlobalCoverageAreaKm2(0);
      return;
    }

    const sats = [];
    for (const id of activeSatIds) {
      const cov = satelliteCoverageData[id];
      if (!cov || !cov.direction || !isFinite(cov.centralAngle) || cov.centralAngle <= 0) continue;
      const { x, y, z } = cov.direction;
      const dirLen = Math.sqrt(x * x + y * y + z * z) || 1;
      const ux = x / dirLen, uy = y / dirLen, uz = z / dirLen;
      const cosThreshold = Math.cos(cov.centralAngle);
      sats.push({ ux, uy, uz, cosThreshold });
    }

    if (sats.length === 0) {
      setGlobalCoveragePercent(0);
      setGlobalCoverageAreaKm2(0);
      return;
    }

    let coveredCount = 0;
    for (const p of sphereSamples) {
      const px = p.x, py = p.y, pz = p.z; // unit vector
      let covered = false;
      for (let i = 0; i < sats.length; i++) {
        const s = sats[i];
        const dot = px * s.ux + py * s.uy + pz * s.uz;
        if (dot >= s.cosThreshold) { // inside spherical cap
          covered = true;
          break;
        }
      }
      if (covered) coveredCount++;
    }

    const percent = (coveredCount / sphereSamples.length) * 100;
    setGlobalCoveragePercent(percent);
    setGlobalCoverageAreaKm2((percent / 100) * totalEarthAreaKm2);
  };

  // Function to add TLE satellite
  const addTLESatellite = (name, line1, line2) => {
    try {
      const tleData = parseTLE(line1, line2, name);
      const newSatellite = {
        id: Date.now(),
        tleData,
        color: `hsl(${Math.random() * 360}, 70%, 50%)`, // Random color
        showOrbit: true,
        showTrail: true,
        showCoverage: true,
        rawName: name,
        rawLine1: line1,
        rawLine2: line2
      };
      setTleSatellites(prev => [...prev, newSatellite]);
      return true;
    } catch (error) {
      console.error('Error adding TLE satellite:', error);
      alert(`Error adding satellite: ${error.message}`);
      return false;
    }
  };

  // Function to remove TLE satellite
  const removeTLESatellite = (id) => {
    setTleSatellites(prev => prev.filter(sat => sat.id !== id));
    // Trigger recompute after removal in next tick
    setTimeout(recomputeGlobalCoverage, 0);
  };

  // Function to update satellite coverage data
  const updateSatelliteCoverage = (satelliteId, coverageData) => {
    setSatelliteCoverageData(prev => {
      const next = { ...prev, [satelliteId]: coverageData };
      return next;
    });
    // Recompute union coverage on each update
    // Note: This is a simple approach; can be throttled if needed
    setTimeout(recomputeGlobalCoverage, 0);
  };

  // Global visibility toggle functions
  const toggleAllSatelliteVisibility = (property, value) => {
    setTleSatellites(prev => prev.map(sat => ({ ...sat, [property]: value })));
    // Recompute if coverage visibility changed
    if (property === 'showCoverage') {
      setTimeout(recomputeGlobalCoverage, 0);
    }
  };

  return (
    <ErrorBoundary>
      <div className="App">
        <SpaceSimulation 
          simulationSpeed={simulationSpeed}
          satelliteParams={satelliteParams}
          tleSatellites={tleSatellites}
          showManualSatellite={showManualSatellite}
          updateSatelliteCoverage={updateSatelliteCoverage}
          minElevationAngle={minElevationAngle}
          showEarth={showEarth}
          showEarthGrid={showEarthGrid}
        />
        <ControlPanel 
          simulationSpeed={simulationSpeed}
          setSimulationSpeed={setSimulationSpeed}
          tleSatellites={tleSatellites}
          addTLESatellite={addTLESatellite}
          removeTLESatellite={removeTLESatellite}
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
        />
      </div>
    </ErrorBoundary>
  );
}

export default App;