import React, { useState, useEffect } from 'react';
import { SAMPLE_TLES } from '../utils/tleParser';
import { COLOR_SCHEMES } from '../themes/colorSchemes';

function ControlPanel({ 
  simulationSpeed, 
  setSimulationSpeed,
  isPaused = false,
  setIsPaused,
  simulationElapsedRef,
  onDownloadModel,
  onDownloadSvg,
  onDownloadSvgAnimation,
  isExporting = false,
  tleSatellites = [],
  addTLESatellite,
  removeTLESatellite,
  removeAllTleSatellites,
  saveTle,
  savedTles = [],
  removeSavedTle,
  toggleAllSatelliteVisibility,
  satelliteCoverageData = {},
  minElevationAngle = 0,
  setMinElevationAngle,
  globalCoveragePercent = 0,
  globalCoverageAreaKm2 = 0,
  showEarth,
  setShowEarth,
  showEarthGrid,
  setShowEarthGrid,
  colorScheme = 'dark',
  setColorScheme,
}) {
  // TLE input state
  const [tleInput, setTleInput] = useState('');
  const [showTleInput, setShowTleInput] = useState(false);
  const [showVisibleTle, setShowVisibleTle] = useState(false);

  // Simulation time (YYYY-MM-DD hh:mm)
  const [simTimeStr, setSimTimeStr] = useState('');
  useEffect(() => {
    const update = () => {
      const elapsedSeconds = simulationElapsedRef?.current ?? 0;
      const d = new Date(Date.now() + elapsedSeconds * 1000);
      const yyyy = d.getFullYear();
      const mm2 = String(d.getMonth() + 1).padStart(2, '0');
      const dd2 = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      setSimTimeStr(`${yyyy}-${mm2}-${dd2} ${hh}:${mi}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [simulationElapsedRef, isPaused, simulationSpeed]);
  
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

  const handleLoadSampleTle = (sampleKey, savedEntry) => {
    if (savedEntry) {
      // Load from a saved TLE entry directly into the scene
      addTLESatellite(savedEntry.rawName, savedEntry.rawLine1, savedEntry.rawLine2);
      return;
    }
    const sample = SAMPLE_TLES[sampleKey];
    const tleText = `${sample.name}\n${sample.line1}\n${sample.line2}`;
    setTleInput(tleText);
  };

  // Helper: replace mean anomaly in TLE line 2 (columns 43-51) with new value in degrees
  const replaceMeanAnomaly = (line2, meanAnomalyDeg) => {
    const wrapped = ((meanAnomalyDeg % 360) + 360) % 360;
    const field = wrapped.toFixed(4).toString().padStart(8, ' ');
    if (line2.length < 52) return line2; // safety
    return line2.slice(0, 43) + field + line2.slice(51);
  };

  // Helper: replace inclination in TLE line 2 (columns 8-16)
  const replaceInclination = (line2, inclinationDeg) => {
    const clamped = Math.max(0, Math.min(180, inclinationDeg));
    const field = clamped.toFixed(4).toString().padStart(8, ' ');
    if (line2.length < 17) return line2;
    return line2.slice(0, 8) + field + line2.slice(16);
  };

  // Helper: replace RAAN in TLE line 2 (columns 17-25)
  const replaceRAAN = (line2, raanDeg) => {
    const wrapped = ((raanDeg % 360) + 360) % 360;
    const field = wrapped.toFixed(4).toString().padStart(8, ' ');
    if (line2.length < 26) return line2;
    return line2.slice(0, 17) + field + line2.slice(25);
  };

  // Compute minimal satellites along same plane to wrap 360° using centralAngle (psi)
  const computeMinimalCount = (centralAngle) => {
    if (!isFinite(centralAngle) || centralAngle <= 0) return 1;
    const psiDeg = centralAngle * 180 / Math.PI;
    // Heuristic: dense spacing along orbit to ensure overlap
    return Math.max(3, Math.min(120, Math.ceil(360 / (psiDeg * 0.8))));
  };

  // Compute a robust set of planes spanning 0..90 deg to target full Earth coverage
  const computePlanes = (baseInclinationDeg, centralAngle) => {
    const psiDeg = Math.max(1, (centralAngle * 180) / Math.PI);
    // Step planes no larger than psiDeg*0.8 to ensure overlap between latitude bands
    const step = Math.max(5, psiDeg * 0.8);
    const inclinations = [];
    for (let inc = 0; inc < 90 - 1e-6; inc += step) {
      inclinations.push(+inc.toFixed(2));
    }
    inclinations.push(90); // include polar plane to cover poles

    // Prefer including the original plane if not already close
    if (isFinite(baseInclinationDeg)) {
      const close = inclinations.some(v => Math.abs(v - baseInclinationDeg) < 0.5);
      if (!close) inclinations.push(+baseInclinationDeg.toFixed(2));
    }

    // Deduplicate and sort
    const uniq = Array.from(new Set(inclinations.map(v => +v.toFixed(2)))).sort((a,b)=>a-b);
    return uniq;
  };
  
  return (
    <div className="control-panel">
      <div className="theme-toggle">
        {Object.values(COLOR_SCHEMES).map((scheme) => (
          <button
            key={scheme.id}
            type="button"
            className={colorScheme === scheme.id ? 'active' : ''}
            onClick={() => setColorScheme(scheme.id)}
          >
            {scheme.label}
          </button>
        ))}
      </div>
      <h2 style={{ margin: '0 0 10px 0', fontSize: '18px', color: 'var(--accent)' }}>
        🛰️ Spacecore Orbits
      </h2>
      <div style={{ margin: '0 0 20px 0', fontSize: '12px', color: 'var(--text-muted)' }}>
        {simTimeStr}
      </div>
      
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
          disabled={isPaused}
          style={{
            background: 'linear-gradient(to right, var(--speed-gradient-start), var(--speed-gradient-end))',
            height: '8px',
            borderRadius: '4px',
            outline: 'none',
            appearance: 'none',
            opacity: isPaused ? 0.5 : 1,
          }}
        />
        <div className="speed-display">
          {simulationSpeed < 1 
            ? `${(simulationSpeed * 100).toFixed(0)}% Real Time`
            : `${simulationSpeed.toFixed(1)}x Speed`
          }
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          <button
            type="button"
            onClick={() => setIsPaused((paused) => !paused)}
            style={{
              background: isPaused ? 'var(--accent)' : 'var(--btn-neutral-bg)',
              color: isPaused ? 'var(--accent-on)' : 'var(--btn-neutral-text)',
              border: `1px solid ${isPaused ? 'var(--accent)' : 'var(--btn-neutral-border)'}`,
              padding: '8px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 'bold',
              flex: 1,
            }}
          >
            {isPaused ? '▶ Resume' : '⏸ Pause'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button
            type="button"
            onClick={onDownloadModel}
            disabled={isExporting}
            title="Download GLB model with colours, textures, and transparency"
            style={{
              background: 'var(--btn-info-bg)',
              color: 'var(--accent-on)',
              border: '1px solid var(--btn-info-border)',
              padding: '8px 12px',
              borderRadius: '4px',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              fontSize: '11px',
              fontWeight: 'bold',
              flex: 1,
              opacity: isExporting ? 0.6 : 1,
            }}
          >
            ⬇ 3D Model
          </button>
          <button
            type="button"
            onClick={onDownloadSvg}
            disabled={isExporting}
            title="Download 2D SVG snapshot of the current view with colours and textures"
            style={{
              background: 'var(--btn-info-bg)',
              color: 'var(--accent-on)',
              border: '1px solid var(--btn-info-border)',
              padding: '8px 12px',
              borderRadius: '4px',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              fontSize: '11px',
              fontWeight: 'bold',
              flex: 1,
              opacity: isExporting ? 0.6 : 1,
            }}
          >
            ⬇ 2D SVG
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button
            type="button"
            onClick={onDownloadSvgAnimation}
            disabled={isExporting}
            title="Download a 10 second SVG animation at 20 fps (200 frames) of orbital motion from the current view"
            style={{
              background: 'var(--btn-info-bg)',
              color: 'var(--accent-on)',
              border: '1px solid var(--btn-info-border)',
              padding: '8px 12px',
              borderRadius: '4px',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              fontSize: '11px',
              fontWeight: 'bold',
              flex: 1,
              opacity: isExporting ? 0.6 : 1,
            }}
          >
            {isExporting ? '⏳ Exporting animation…' : '⬇ SVG Animation (10s @ 20fps)'}
          </button>
        </div>
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
            background: 'linear-gradient(to right, var(--speed-gradient-start), var(--elevation-gradient-end))',
            height: '8px',
            borderRadius: '4px',
            outline: 'none',
            appearance: 'none'
          }}
        />
        <div className="speed-display">
          {minElevationAngle}° {minElevationAngle === 0 ? '(Maximum Coverage)' : '(Reduced Coverage)'}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-subtle)', marginTop: '2px' }}>
          Ground antenna elevation angle. 0° = horizontal (max coverage), 90° = vertical (min coverage)
        </div>
      </div>
      
      {/* TLE Satellites Section */}
      <div className="control-group">
        
        {/* Global Visibility Controls */}
        <div style={{ 
          marginBottom: '10px', 
          padding: '8px', 
          background: 'var(--accent-soft-bg)', 
          borderRadius: '5px',
          border: '1px solid var(--accent-soft-border)'
        }}>
          <div style={{ fontSize: '11px', color: 'var(--accent)', marginBottom: '5px', fontWeight: 'bold' }}>
            🌐 Global Controls:
          </div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
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
                checked={tleSatellites.every(sat => sat.showCoverage)}
                onChange={(e) => toggleAllSatelliteVisibility('showCoverage', e.target.checked)}
                style={{ marginRight: '4px' }}
              />
              Coverage
            </label>
            <label style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={tleSatellites.every(sat => sat.showBeam !== false)}
                onChange={(e) => toggleAllSatelliteVisibility('showBeam', e.target.checked)}
                style={{ marginRight: '4px' }}
              />
              Beams
            </label>
            <label style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showEarth}
                onChange={(e) => setShowEarth(e.target.checked)}
                style={{ marginRight: '4px' }}
              />
              Globe
            </label>
            <label style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showEarthGrid}
                onChange={(e) => setShowEarthGrid(e.target.checked)}
                style={{ marginRight: '4px' }}
              />
              Grid
            </label>
          </div>
          <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--accent)' }}>
            <div style={{ fontWeight: 'bold' }}>Global Earth Coverage:</div>
            <div style={{ color: 'var(--text-muted)' }}>
              {`${(globalCoveragePercent ?? 0).toFixed(2)}%`} ({((globalCoverageAreaKm2 ?? 0) / 1_000_000).toFixed(2)}M km²)
            </div>
          </div>
        </div>

        <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: 'var(--accent)' }}>
          TLE Satellites ({tleSatellites.length})
        </h3>
        
        {/* Add / Show Visible TLE buttons */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowTleInput(!showTleInput)}
            style={{
              background: showTleInput ? 'var(--btn-danger-bg)' : 'var(--accent-dim)',
              color: 'var(--accent-on)',
              border: showTleInput ? '1px solid var(--btn-danger-bg)' : '1px solid var(--accent)',
              padding: '6px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 'bold',
              flex: '0 0 auto',
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

          {/* Show Visible TLE button (no auto copy) */}
          <button
            onClick={() => setShowVisibleTle(prev => !prev)}
            style={{
              background: 'var(--accent-dim)',
              color: 'var(--accent-on)',
              border: '1px solid var(--accent)',
              padding: '6px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 'bold',
              flex: '0 0 auto'
            }}
          >
            {showVisibleTle ? 'Hide Visible TLE' : 'Show Visible TLE'}
          </button>

          {/* Minimal constellation button when at least one satellite is present */}
          {(() => {
            const eligible = tleSatellites.filter(s => s.rawLine1 && s.rawLine2);
            if (eligible.length < 1) return null;
            const sat = eligible[0];
            const cov = satelliteCoverageData[sat.id];
            const psi = cov?.centralAngle;
            const N = computeMinimalCount(psi);
            return (
              <button
                onClick={() => {
                  if (!sat.rawLine1 || !sat.rawLine2) return;
                  const psiLocal = psi || (Math.PI/6);
                  const planes = computePlanes(sat.tleData.inclination, psiLocal);
                  const P = planes.length;
                  // Original orbital elements
                  const origM = parseFloat(sat.rawLine2.substring(43, 51));
                  const origRAAN = parseFloat(sat.rawLine2.substring(17, 25));

                  let idx = 1;
                  for (let p = 0; p < P; p++) {
                    const incDeg = planes[p];
                    // Distribute RAANs evenly to interleave planes
                    const raanDeg = ((isFinite(origRAAN) ? origRAAN : 0) + (360 / P) * p) % 360;
                    for (let k = 0; k < N; k++) {
                      // Skip original satellite slot (best-effort) if same plane and phase
                      if (p === 0 && k === 0 && Math.abs(incDeg - sat.tleData.inclination) < 0.5) continue;
                      const deltaM = (360 / N) * k;
                      const newM = ((isFinite(origM) ? origM : 0) + deltaM) % 360;
                      let line2 = sat.rawLine2;
                      line2 = replaceInclination(line2, incDeg);
                      line2 = replaceRAAN(line2, raanDeg);
                      line2 = replaceMeanAnomaly(line2, newM);
                      const name = `${sat.tleData.name} [${idx + 1}/${P*N}]`;
                      addTLESatellite(name, sat.rawLine1, line2);
                      idx++;
                    }
                  }
                }}
                title="Add planes (inclination) and phased satellites to target full Earth coverage"
                style={{
                  background: 'var(--btn-info-bg)',
                  color: 'var(--accent-on)',
                  border: '1px solid var(--btn-info-border)',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  flex: '0 0 auto'
                }}
              >
                Show minimal constellation (~100% coverage)
              </button>
            );
          })()}
        </div>

        {/* Visible satellites TLE textbox */}
        {showVisibleTle && (
          <div style={{ marginBottom: '10px' }}>
            <textarea
              readOnly
              value={tleSatellites
                .filter(s => s.showCoverage && s.rawLine1 && s.rawLine2)
                .map(s => `${s.rawName || s.tleData.name}\n${s.rawLine1}\n${s.rawLine2}`)
                .join('\n\n')}
              rows={8}
              style={{
                width: '100%',
                padding: '8px',
                background: 'var(--textarea-bg)',
                color: 'var(--textarea-text)',
                border: '1px solid var(--input-border)',
                borderRadius: '3px',
                fontSize: '11px',
                fontFamily: 'monospace',
                resize: 'vertical',
                lineHeight: '1.2'
              }}
            />
          </div>
        )}

        {/* Quick Add Satellites */}
        {!showTleInput && (
          <div style={{ marginBottom: '10px' }}>
            {savedTles.length > 0 && (
              <>
                <div style={{ fontSize: '11px', color: 'var(--btn-saved-text)', marginBottom: '5px' }}>
                  Saved:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '10px' }}>
                  {savedTles.map((saved, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      <button
                        onClick={() => handleLoadSampleTle(null, saved)}
                        style={{
                          background: 'var(--btn-neutral-bg)',
                          color: 'var(--btn-saved-text)',
                          border: '1px solid var(--btn-saved-border)',
                          padding: '6px 8px',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '10px',
                          textAlign: 'center',
                          transition: 'all 0.2s ease',
                          width: '100%'
                        }}
                        onMouseOver={(e) => {
                          e.target.style.background = 'var(--input-border)';
                          e.target.style.borderColor = 'var(--btn-saved-text)';
                        }}
                        onMouseOut={(e) => {
                          e.target.style.background = 'var(--btn-neutral-bg)';
                          e.target.style.borderColor = 'var(--btn-saved-border)';
                        }}
                      >
                        {saved.rawName.length > 15 ? saved.rawName.substring(0, 12) + '...' : saved.rawName}
                      </button>
                      <button
                        onClick={() => removeSavedTle(idx)}
                        style={{
                          position: 'absolute',
                          top: '-4px',
                          right: '-4px',
                          background: 'var(--btn-remove-saved-bg)',
                          color: 'var(--btn-remove-saved-text)',
                          border: '1px solid var(--btn-remove-saved-border)',
                          borderRadius: '50%',
                          width: '14px',
                          height: '14px',
                          padding: 0,
                          cursor: 'pointer',
                          fontSize: '8px',
                          lineHeight: '12px',
                          textAlign: 'center'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div style={{ fontSize: '11px', color: 'var(--accent)', marginBottom: '5px' }}>
              Popular:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
              {Object.entries(SAMPLE_TLES).map(([key, tle]) => (
                <button
                  key={key}
                  onClick={() => addTLESatellite(tle.name, tle.line1, tle.line2)}
                  style={{
                    background: 'var(--btn-neutral-bg)',
                    color: 'var(--btn-neutral-text)',
                    border: '1px solid var(--btn-neutral-border)',
                    padding: '6px 8px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    textAlign: 'center',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.target.style.background = 'var(--input-border)';
                    e.target.style.borderColor = 'var(--accent)';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.background = 'var(--btn-neutral-bg)';
                    e.target.style.borderColor = 'var(--btn-neutral-border)';
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
            background: 'var(--accent-soft-bg)', 
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
                  background: 'var(--input-bg)',
                  color: 'var(--input-text)',
                  border: '1px solid var(--input-border)',
                  borderRadius: '3px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  resize: 'vertical',
                  lineHeight: '1.2'
                }}
              />
              <div style={{ fontSize: '10px', color: 'var(--text-subtle)', marginTop: '3px' }}>
                Each satellite: optional name line, then TLE line 1 (starts with "1 ") and TLE line 2 (starts with "2 ").
              </div>
            </div>

            <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
              <button
                onClick={handleAddTleSatellite}
                style={{
                  background: 'var(--accent)',
                  color: 'var(--accent-on)',
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

            <div style={{ fontSize: '11px', color: 'var(--accent)', marginBottom: '10px' }}>
              Sample TLEs:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {Object.keys(SAMPLE_TLES).map(key => (
                <button
                  key={key}
                  onClick={() => handleLoadSampleTle(key)}
                  style={{
                    background: 'var(--btn-neutral-bg)',
                    color: 'var(--btn-neutral-text)',
                    border: '1px solid var(--btn-neutral-border)',
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{tleSatellites.length} satellite{tleSatellites.length !== 1 ? 's' : ''}</span>
              <button
                onClick={removeAllTleSatellites}
                style={{
                  background: 'var(--btn-danger-dark)',
                  color: 'var(--accent-on)',
                  border: 'none',
                  padding: '3px 8px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '10px'
                }}
              >
                Remove All
              </button>
            </div>
            {tleSatellites.map(satellite => (
              <div
                key={satellite.id}
                style={{
                  background: 'var(--sat-card-bg)',
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
                  <div style={{ display: 'flex', gap: '3px' }}>
                    <button
                      onClick={() => saveTle(satellite)}
                      title="Save to favorites"
                      style={{
                        background: 'var(--btn-save-bg)',
                        color: 'var(--btn-save-text)',
                        border: 'none',
                        padding: '2px 6px',
                        borderRadius: '2px',
                        cursor: 'pointer',
                        fontSize: '10px'
                      }}
                    >
                      ☆
                    </button>
                    <button
                      onClick={() => removeTLESatellite(satellite.id)}
                      style={{
                        background: 'var(--btn-danger-bg)',
                        color: 'var(--accent-on)',
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
                </div>
                
                
                
                <div style={{ marginTop: '3px', fontSize: '10px', color: 'var(--text-muted)' }}>
                  Alt: {satellite.tleData.perigeeAltitude.toFixed(0)}-{satellite.tleData.apogeeAltitude.toFixed(0)}km | 
                  Inc: {satellite.tleData.inclination.toFixed(1)}° | 
                  Period: {satellite.tleData.period.toFixed(1)}min
                </div>
                
                {/* Current Position */}
                {satelliteCoverageData[satellite.id] && satelliteCoverageData[satellite.id].latitude !== undefined && (
                  <div style={{ marginTop: '3px', fontSize: '10px', color: 'var(--pos-text)' }}>
                    Pos: {satelliteCoverageData[satellite.id].latitude.toFixed(1)}° {satelliteCoverageData[satellite.id].latitude >= 0 ? 'N' : 'S'}, {Math.abs(satelliteCoverageData[satellite.id].longitude).toFixed(1)}° {satelliteCoverageData[satellite.id].longitude >= 0 ? 'E' : 'W'} | 
                    Alt: {satelliteCoverageData[satellite.id].satelliteAltitudeKm?.toFixed(0)}km
                  </div>
                )}

                {/* Coverage Information */}
                {satelliteCoverageData[satellite.id] && (
                  <div style={{ 
                    marginTop: '5px', 
                    padding: '4px 6px',
                    background: 'var(--accent-soft-bg)',
                    borderRadius: '3px',
                    fontSize: '10px', 
                    color: 'var(--accent)',
                    border: '1px solid var(--accent-soft-border)'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                      📡 Earth Coverage: {satelliteCoverageData[satellite.id].coveragePercentage?.toFixed(2)}%
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '9px' }}>
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
    </div>
  );
}

export default ControlPanel;