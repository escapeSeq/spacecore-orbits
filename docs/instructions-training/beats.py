"""Narration beats — British neural TTS (en-GB-LibbyNeural +5%)."""

VOICE = "en-GB-LibbyNeural"
RATE = "+5%"

# Grouped themes (revealed with 02-map narration) — same shape as the original four-layer card
MAP_THEMES = [
    {
        "title": "Time & speed",
        "blurb": "Clock, pause, and acceleration so motion is easy to follow.",
    },
    {
        "title": "Satellites & orbits",
        "blurb": "Sample TLEs, paste your own, and watch paths on the globe.",
    },
    {
        "title": "Coverage tools",
        "blurb": "Global layers, beams, and the elevation mask.",
    },
    {
        "title": "Theme & exports",
        "blurb": "Light or dark view, then take GLB, SVG, or TLE with you.",
    },
]

BEATS = [
    {
        "id": "01-open",
        "kind": "illustrate",
        "illustration": "hero",
        "narration": (
            "Hi — welcome to Spacecore Orbits. This live three-D Earth simulator puts your "
            "controls on the left and the globe on the right, so orbits, beams, and coverage "
            "stay in view as the scene moves."
        ),
    },
    {
        "id": "02-map",
        "kind": "illustrate",
        "illustration": "map",
        "themes": MAP_THEMES,
        "narration": (
            "We'll walk the live app through four themes. "
            "First, time and speed — the clock, pause, and how you accelerate the scene so motion is easy to follow. "
            "Next, satellites and orbits — adding a sample bird, pasting your own TLE data, and watching paths unfold on the globe. "
            "Then coverage tools — the global layers, beams, and the elevation mask that shapes the footprint. "
            "And finally, theme and exports — switching light or dark, then taking a model, an SVG, or the TLE text with you."
        ),
    },
    {
        "id": "03-app",
        "kind": "live",
        "video": "03-app.mp4",
        "audio_delay": 0.35,
        "marks": ["Control panel", "3D Earth"],
        "narration": (
            "Here's the workspace: controls on the left, the live globe on the right. "
            "Drag to orbit the camera, scroll to zoom, and right-drag to pan when you want a closer look."
        ),
    },
    {
        "id": "04-time",
        "kind": "live",
        "video": "04-time.mp4",
        "audio_delay": 0.25,
        "marks": ["Date/time", "Instructions"],
        "narration": (
            "Under the title, the simulation clock stays with the scene. Beside it, Instructions "
            "opens this walkthrough, and you can share a link that brings someone straight back here."
        ),
    },
    {
        "id": "05-add-tle",
        "kind": "live",
        "video": "05-add-tle.mp4",
        "audio_delay": 0.3,
        "marks": ["Popular", "sample"],
        "narration": (
            "Under Popular samples, one click places a real elliptical satellite on the globe — "
            "path, coverage, and beam appear together so you can see the orbit take shape."
        ),
    },
    {
        "id": "06-speed",
        "kind": "live",
        "video": "06-speed.mp4",
        "audio_delay": 0.15,
        "marks": ["Simulation Speed", "Pause"],
        "narration": (
            "Now we push simulation speed right up — watch that long orbit race ahead as the "
            "multiplier climbs. Pause freezes the frame when you want a closer look; Resume "
            "lets the motion continue."
        ),
    },
    {
        "id": "07-theme",
        "kind": "live",
        "video": "07-theme.mp4",
        "audio_delay": 0.25,
        "marks": ["Theme toggle"],
        "narration": (
            "Top-right is the theme toggle: a light high-contrast sky when you need clarity, "
            "then back to dark space when you want that classic look."
        ),
    },
    {
        "id": "08-satellite",
        "kind": "live",
        "video": "08-satellite.mp4",
        "audio_delay": 0.2,
        "marks": ["Orbit", "Coverage", "Beam"],
        "narration": (
            "Swing the camera and the eccentric path keeps moving — footprint and beam sweeping "
            "across the Earth so the geometry is easy to read from another angle."
        ),
    },
    {
        "id": "09-global",
        "kind": "live",
        "video": "09-global.mp4",
        "audio_delay": 0.25,
        "marks": ["Orbits", "Coverage", "Beams", "Globe", "Grid"],
        "narration": (
            "Global Controls let you blink coverage, beams, orbits, and the grid off and on — "
            "handy when you want a quieter view or need every layer back at once."
        ),
    },
    {
        "id": "10-elevation",
        "kind": "live",
        "video": "10-elevation.mp4",
        "audio_delay": 0.25,
        "marks": ["Minimum Elevation Angle"],
        "narration": (
            "The elevation slider models a ground antenna mask. Raise it and the usable footprint "
            "shrinks; bring it back down for maximum coverage again."
        ),
    },
    {
        "id": "12-paste",
        "kind": "live",
        "video": "12-paste.mp4",
        "audio_delay": 0.25,
        "marks": ["Add TLE Satellite(s)"],
        "narration": (
            "When you're ready for your own data, Add TLE Satellite opens a paste box for bulk "
            "NORAD lines — optional name, then line one and line two — as many blocks as you need."
        ),
    },
    {
        "id": "13-exports",
        "kind": "live",
        "video": "13-exports.mp4",
        "audio_delay": 0.25,
        "marks": ["Exports", "3D Model", "2D SVG", "TLE"],
        "narration": (
            "Exports gathers the ways out: a three-D model, a two-D SVG snapshot, an SVG animation, "
            "or the raw TLE text for satellites you're showing."
        ),
    },
    {
        "id": "14-loop",
        "kind": "illustrate",
        "illustration": "loop",
        "narration": (
            "So the rhythm is simple: add a satellite, raise speed until the orbit tells its story, "
            "tune coverage and elevation, then export or share what you've built."
        ),
    },
]
