import React, { useState } from 'react';
import { SAMPLE_TLES } from '../utils/tleParser';

function ControlPanel({ 
  simulationSpeed, 
  setSimulationSpeed,
  tleSatellites = [],
  addTLESatellite,
  removeTLESatellite,
  toggleAllSatelliteVisibility,
  satelliteCoverageData = {},
  minElevationAngle = 0,
  setMinElevationAngle,
  globalCoveragePercent = 0,
  globalCoverageAreaKm2 = 0
}) {
  // TLE input state
  const [tleInput, setTleInput] = useState('');
  const [showTleInput, setShowTleInput] = useState(false);
  
  const handleSpeedChange = (e) => {
    setSimulationSpeed(parseFloat(e.target.value));
  };

  // Bulk TLE parsing: accept many blocks. Each block is name (optional), then line 1 (starts with '1 '), then line 2 (starts with '2 ').
  const parseBulkTleInput = (input) => {
    const lines = input
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const triples = [];
    for (let i = 0; i < lines.length - 1; i++) {
      const l1 = lines[i];
      const l2 = lines[i + 1];

      // Find pattern 1/2 lines
      if (l1.startsWith('1 ') && l2.startsWith('2 ')) {
        // Determine name from previous non-1/2 line, if available
        let name = 'Unknown';
        if (i - 1 >= 0) {
          const maybeName = lines[i - 1];
          if (!maybeName.startsWith('1 ') && !maybeName.startsWith('2 ')) {
            name = maybeName;
          }
        }
        triples.push({ name, line1: l1, line2: l2 });
        i += 1; // advance past the 2-line set; the for loop will add another +1
      }
    }

    return triples;
  };

  const handleTleInputChange = (value) => {
    setTleInput(value);
  };

  const handleAddTleSatellite = () => {
    if (!tleInput.trim()) {
      alert('Please paste one or more TLEs (name optional, followed by line 1 and line 2).');
      return;
    }

    const triples = parseBulkTleInput(tleInput);
    if (triples.length === 0) {
      alert('Could not find any valid TLE pairs (lines starting with "1 " and "2 ").');
      return;
    }

    let success = 0;
    let failed = 0;
    triples.forEach(({ name, line1, line2 }) => {
      const ok = addTLESatellite(name, line1, line2);
      if (ok) success++; else failed++;
    });

    setTleInput('');
    setShowTleInput(false);

    if (failed > 0) {
      alert(`Added ${success} satellite(s). ${failed} failed to add.`);
    }
  };

  const handleLoadSampleTle = (sampleKey) => {
    const sample = SAMPLE_TLES[sampleKey];
    const tleText = `${sample.name}\n${sample.line1}\n${sample.line2}`;
    setTleInput(tleText);
  };
  
  return (
    <div className="control-panel">
      <h2 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#00ff00' }}>
        🛰️ Spacecore Orbits
      </h2>
      
      {/* Simulation Speed Control */}
      <div className="control-group">
        <label>Simulation Speed</label>
        <input
          type="range"
          min="0.1"
          max="1000"
          step="0.1"
          value={simulationSpeed}
          onChange={handleSpeedChange}
          style={{
            background: 'linear-gradient(to right, #333, #00ff00)',
            height: '8px',
            borderRadius: '4px',
            outline: 'none',
            appearance: 'none'
          }}
        />
        <div className="speed-display">
          {simulationSpeed < 1 
            ? `${(simulationSpeed * 100).toFixed(0)}% Real Time`
            : `${simulationSpeed.toFixed(1)}x Speed`
          }
        </div>
      </div>
      
      {/* TLE Satellites Section */}
      <div className="control-group">
        <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#00ff00' }}>
          TLE Satellites ({tleSatellites.length})
        </h3>
        
        {/* Global Visibility Controls */}
        {tleSatellites.length > 0 && (
          <div style={{ 
            marginBottom: '10px', 
            padding: '8px', 
            background: 'rgba(0, 255, 0, 0.1)', 
            borderRadius: '5px',
            border: '1px solid rgba(0, 255, 0, 0.3)'
          }}>
            <div style={{ fontSize: '11px', color: '#00ff00', marginBottom: '5px', fontWeight: 'bold' }}>
              🌐 Global Controls (All Satellites):
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '10px' }}>
              <label style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={tleSatellites.every(sat => sat.showOrbit)}
                  onChange={(e) => toggleAllSatelliteVisibility('showOrbit', e.target.checked)}
                  style={{ marginRight: '4px' }}
                />
                Orbits
              </label>
              <label style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={tleSatellites.every(sat => sat.showTrail)}
                  onChange={(e) => toggleAllSatelliteVisibility('showTrail', e.target.checked)}
                  style={{ marginRight: '4px' }}
                />
                Trails
              </label>
              <label style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={tleSatellites.every(sat => sat.showCoverage)}
                  onChange={(e) => toggleAllSatelliteVisibility('showCoverage', e.target.checked)}
                  style={{ marginRight: '4px' }}
                />
                Coverage
              </label>
            </div>
            <div style={{ marginTop: '8px', fontSize: '10px', color: '#00ff00' }}>
              <div style={{ fontWeight: 'bold' }}>Global Earth Coverage:</div>
              <div style={{ color: '#ccc' }}>
                {`${(globalCoveragePercent ?? 0).toFixed(2)}%`} ({((globalCoverageAreaKm2 ?? 0) / 1_000_000).toFixed(2)}M km²)
              </div>
            </div>
          </div>
        )}
        
        <button
          onClick={() => setShowTleInput(!showTleInput)}
          style={{
            background: showTleInput ? '#ff4444' : '#00aa00',
            color: 'white',
            border: showTleInput ? '1px solid #ff4444' : '1px solid #00ff00',
            padding: '10px 16px',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 'bold',
            marginBottom: '10px',
            width: '100%',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.target.style.transform = 'translateY(-1px)';
            e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.4)';
          }}
          onMouseOut={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
          }}
        >
          {showTleInput ? '✕ Cancel' : '🛰️ Add TLE Satellite(s)'}
        </button>

        {/* Quick Add Popular Satellites */}
        {!showTleInput && (
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '11px', color: '#00ff00', marginBottom: '5px' }}>
              Quick Add Popular Satellites:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
              {Object.entries(SAMPLE_TLES).map(([key, tle]) => (
                <button
                  key={key}
                  onClick={() => addTLESatellite(tle.name, tle.line1, tle.line2)}
                  style={{
                    background: '#444',
                    color: 'white',
                    border: '1px solid #666',
                    padding: '6px 8px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    textAlign: 'center',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.target.style.background = '#555';
                    e.target.style.borderColor = '#00ff00';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.background = '#444';
                    e.target.style.borderColor = '#666';
                  }}
                >
                  {tle.name.length > 15 ? tle.name.substring(0, 12) + '...' : tle.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {showTleInput && (
          <div style={{ 
            background: 'rgba(0, 255, 0, 0.1)', 
            padding: '15px', 
            borderRadius: '5px',
            marginBottom: '10px'
          }}>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>
                TLE Data (paste many; name optional above each pair of lines 1 and 2):
              </label>
              <textarea
                value={tleInput}
                onChange={(e) => handleTleInputChange(e.target.value)}
                placeholder={`ISS (ZARYA)
1 25544U 98067A   24001.00000000  .00020137  00000-0  16538-3 0  9993
2 25544  51.6461 339.2377 0001078  88.2548 271.9142 15.48919103123456

MOLNIYA 1-91
1 25485U 98054A   25220.25238000  -.00000045  00000+0  00000+0 0  9999
2 25485  64.5387 331.0544 6772907 286.8560 13.3661  2.36441399 206179`}
                rows={8}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: '#222',
                  color: 'white',
                  border: '1px solid #555',
                  borderRadius: '3px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  resize: 'vertical',
                  lineHeight: '1.2'
                }}
              />
              <div style={{ fontSize: '10px', color: '#888', marginTop: '3px' }}>
                Each satellite: optional name line, then TLE line 1 (starts with "1 ") and TLE line 2 (starts with "2 ").
              </div>
            </div>

            <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
              <button
                onClick={handleAddTleSatellite}
                style={{
                  background: '#00ff00',
                  color: 'black',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  flex: 1
                }}
              >
                Add Satellite(s)
              </button>
            </div>

            <div style={{ fontSize: '11px', color: '#00ff00', marginBottom: '10px' }}>
              Sample TLEs:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {Object.keys(SAMPLE_TLES).map(key => (
                <button
                  key={key}
                  onClick={() => handleLoadSampleTle(key)}
                  style={{
                    background: '#333',
                    color: 'white',
                    border: '1px solid #555',
                    padding: '5px 8px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    textAlign: 'left'
                  }}
                >
                  {SAMPLE_TLES[key].name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* List of added TLE satellites */}
        {tleSatellites.length > 0 && (
          <div style={{ marginTop: '10px' }}>
            {tleSatellites.map(satellite => (
              <div
                key={satellite.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  padding: '8px',
                  borderRadius: '3px',
                  marginBottom: '5px',
                  fontSize: '11px'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '5px'
                }}>
                  <span style={{ color: satellite.color, fontWeight: 'bold' }}>
                    {satellite.tleData.name}
                  </span>
                  <button
                    onClick={() => removeTLESatellite(satellite.id)}
                    style={{
                      background: '#ff4444',
                      color: 'white',
                      border: 'none',
                      padding: '2px 6px',
                      borderRadius: '2px',
                      cursor: 'pointer',
                      fontSize: '10px'
                    }}
                  >
                    ✕
                  </button>
                </div>
                
                
                
                <div style={{ marginTop: '3px', fontSize: '10px', color: '#ccc' }}>
                  Alt: {satellite.tleData.perigeeAltitude.toFixed(0)}-{satellite.tleData.apogeeAltitude.toFixed(0)}km | 
                  Inc: {satellite.tleData.inclination.toFixed(1)}° | 
                  Period: {satellite.tleData.period.toFixed(1)}min
                </div>
                
                {/* Coverage Information */}
                {satelliteCoverageData[satellite.id] && (
                  <div style={{ 
                    marginTop: '5px', 
                    padding: '4px 6px',
                    background: 'rgba(0, 255, 0, 0.1)',
                    borderRadius: '3px',
                    fontSize: '10px', 
                    color: '#00ff00',
                    border: '1px solid rgba(0, 255, 0, 0.3)'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                      📡 Earth Coverage: {satelliteCoverageData[satellite.id].coveragePercentage?.toFixed(2)}%
                    </div>
                    <div style={{ color: '#ccc', fontSize: '9px' }}>
                      Area: {(satelliteCoverageData[satellite.id].coverageAreaKm2 / 1000000).toFixed(1)}M km² | 
                      Current Alt: {satelliteCoverageData[satellite.id].satelliteAltitudeKm?.toFixed(0)}km
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Minimum Elevation Angle Control */}
      <div className="control-group">
        <label>Minimum Elevation Angle</label>
        <input
          type="range"
          min="0"
          max="90"
          step="1"
          value={minElevationAngle}
          onChange={(e) => setMinElevationAngle(parseFloat(e.target.value))}
          style={{
            background: 'linear-gradient(to right, #333, #ff8800)',
            height: '8px',
            borderRadius: '4px',
            outline: 'none',
            appearance: 'none'
          }}
        />
        <div className="speed-display">
          {minElevationAngle}° {minElevationAngle === 0 ? '(Maximum Coverage)' : '(Reduced Coverage)'}
        </div>
        <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
          Ground antenna elevation angle. 0° = horizontal (max coverage), 90° = vertical (min coverage)
        </div>
      </div>
      
      
    </div>
  );
}

export default ControlPanel;