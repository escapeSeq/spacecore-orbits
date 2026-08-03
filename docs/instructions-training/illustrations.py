"""Animated title cards: wireframe hero + timed cover bullets."""

from __future__ import annotations

W, H = 1920, 1080

BASE_CSS = f"""
  html,body{{margin:0;padding:0;width:{W}px;height:{H}px;overflow:hidden;
    background:#020617;font-family:"Segoe UI",Helvetica,Arial,sans-serif;color:#f8fafc}}
  *{{box-sizing:border-box}}
"""


def hero_html(duration: float) -> str:
    """Wireframe app sketch that draws in with the narration."""
    draw = max(2.5, min(8.0, duration * 0.55))
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
{BASE_CSS}
.wrap{{
  height:100%;padding:48px 72px;display:grid;grid-template-columns:1.05fr 1fr;gap:48px;align-items:center;
  background:
    radial-gradient(900px 520px at 12% 0%, #0f3d2e 0%, transparent 55%),
    radial-gradient(700px 480px at 90% 80%, #0c4a6e33 0%, transparent 50%),
    #0b1220;
}}
.copy .eyebrow{{color:#7dd3fc;letter-spacing:0.16em;text-transform:uppercase;font-size:0.95rem;margin-bottom:1rem;
  opacity:0;animation:fadeIn 0.7s ease forwards 0.15s}}
.copy h1{{font-family:Georgia,serif;font-weight:400;font-size:3.6rem;margin:0 0 1.1rem;line-height:1.08;
  opacity:0;animation:fadeIn 0.8s ease forwards 0.45s}}
.copy p{{font-size:1.4rem;color:#cbd5e1;max-width:28rem;line-height:1.5;margin:0;
  opacity:0;animation:fadeIn 0.8s ease forwards 1.1s}}
.mark{{background:rgba(34,197,94,0.35);padding:0 6px;border-radius:4px;color:#dcfce7}}
.stage{{position:relative;height:min(720px, 78vh);border-radius:18px;background:#020617;
  border:1px solid #1e293b;box-shadow:0 24px 60px rgba(0,0,0,0.45);overflow:hidden}}
svg.wire{{position:absolute;inset:0;width:100%;height:100%}}
.stroke{{
  fill:none;stroke:#67e8f9;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;
  stroke-dasharray:1400;stroke-dashoffset:1400;
  animation:draw {draw:.2f}s ease forwards 0.35s;
  filter:drop-shadow(0 0 6px rgba(103,232,249,0.35));
}}
.stroke.dim{{stroke:#38bdf8;stroke-width:1.5;opacity:0.85;animation-delay:0.9s}}
.stroke.panel{{stroke:#86efac;animation-delay:0.55s}}
.glow-dot{{fill:#86efac;opacity:0;animation:fadeIn 0.5s ease forwards {draw*0.7:.2f}s}}
@keyframes draw{{to{{stroke-dashoffset:0}}}}
@keyframes fadeIn{{to{{opacity:1}}}}
</style></head><body><div class="wrap">
  <div class="copy">
    <div class="eyebrow">Spacecore · Instructions</div>
    <h1>Spacecore<br/>Orbits</h1>
    <p>A <span class="mark">control panel</span> on the left. A live <span class="mark">3D Earth</span> on the right — orbits, beams, and coverage in motion.</p>
  </div>
  <div class="stage" aria-hidden="true">
    <svg class="wire" viewBox="0 0 900 700" preserveAspectRatio="xMidYMid meet">
      <!-- Window frame -->
      <rect class="stroke dim" x="36" y="28" width="828" height="644" rx="18"/>
      <!-- Left control panel -->
      <rect class="stroke panel" x="56" y="52" width="250" height="596" rx="12"/>
      <line class="stroke panel" x1="76" y1="92" x2="260" y2="92"/>
      <line class="stroke panel" x1="76" y1="118" x2="200" y2="118"/>
      <rect class="stroke panel" x="76" y="150" width="210" height="14" rx="7"/>
      <rect class="stroke panel" x="76" y="186" width="210" height="36" rx="8"/>
      <rect class="stroke panel" x="76" y="240" width="210" height="14" rx="7"/>
      <rect class="stroke panel" x="76" y="274" width="96" height="28" rx="6"/>
      <rect class="stroke panel" x="184" y="274" width="102" height="28" rx="6"/>
      <rect class="stroke panel" x="76" y="330" width="210" height="90" rx="10"/>
      <rect class="stroke panel" x="76" y="440" width="98" height="40" rx="8"/>
      <rect class="stroke panel" x="186" y="440" width="100" height="40" rx="8"/>
      <rect class="stroke panel" x="76" y="496" width="98" height="40" rx="8"/>
      <rect class="stroke panel" x="186" y="496" width="100" height="40" rx="8"/>
      <!-- Globe / scene -->
      <circle class="stroke" cx="580" cy="350" r="168"/>
      <ellipse class="stroke dim" cx="580" cy="350" rx="168" ry="58"/>
      <path class="stroke dim" d="M580 182 C640 250,640 450,580 518"/>
      <path class="stroke dim" d="M580 182 C520 250,520 450,580 518"/>
      <!-- Eccentric orbit -->
      <ellipse class="stroke" cx="600" cy="330" rx="250" ry="120" transform="rotate(-28 600 330)"/>
      <!-- Satellite -->
      <circle class="glow-dot" cx="820" cy="250" r="6"/>
      <!-- Theme toggle -->
      <circle class="stroke dim" cx="820" cy="72" r="16"/>
    </svg>
  </div>
</div></body></html>"""


def map_html(duration: float, themes: list[dict] | None = None, bullets: list[str] | None = None) -> str:
    """Four grouped theme cards that appear as the narrator introduces each theme."""
    if themes is None and bullets:
        themes = [{"title": b, "blurb": ""} for b in bullets]
    themes = themes or []
    # Intro line, then one card per theme as narration walks the groups
    intro = 3.0
    remain = max(6.0, duration - intro - 0.8)
    step = remain / max(len(themes), 1)
    cards = []
    for i, theme in enumerate(themes):
        delay = intro + i * step
        title = theme.get("title", "")
        blurb = theme.get("blurb", "")
        cards.append(
            f'<div class="card" style="animation-delay:{delay:.2f}s">'
            f'<div class="num">{i+1}</div>'
            f'<div class="body"><h2>{title}</h2><p>{blurb}</p></div>'
            f"</div>"
        )
    cards_html = "\n".join(cards)
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
{BASE_CSS}
.wrap{{
  height:100%;padding:56px 96px;display:flex;flex-direction:column;justify-content:center;
  background:
    radial-gradient(900px 500px at 80% 0%, #0c4a6e44 0%, transparent 50%),
    #0b1220;
}}
h1{{
  font-family:Georgia,serif;font-weight:400;font-size:3.1rem;margin:0 0 0.4rem;
  opacity:0;animation:fadeIn 0.7s ease forwards 0.1s;
}}
.sub{{
  font-size:1.4rem;color:#94a3b8;margin:0 0 2.4rem;max-width:42rem;line-height:1.45;
  opacity:0;animation:fadeIn 0.7s ease forwards 0.45s;
}}
.grid{{
  display:grid;grid-template-columns:1fr 1fr;gap:22px 28px;
}}
.card{{
  display:flex;align-items:flex-start;gap:20px;min-height:140px;padding:26px 28px;
  border-radius:20px;background:rgba(15,23,42,0.92);border:1px solid #334155;
  opacity:0;transform:translateY(22px) scale(0.98);
  animation:popIn 0.6s cubic-bezier(.2,.8,.2,1) forwards;
  box-shadow:0 12px 32px rgba(0,0,0,0.28);
}}
.num{{
  flex:0 0 auto;width:56px;height:56px;border-radius:16px;
  display:flex;align-items:center;justify-content:center;
  font-weight:700;font-size:1.45rem;color:#0b1220;background:#67e8f9;
}}
.body h2{{
  margin:0 0 8px;font-size:1.85rem;font-weight:650;letter-spacing:0.01em;color:#f8fafc;line-height:1.15;
}}
.body p{{
  margin:0;font-size:1.2rem;color:#94a3b8;line-height:1.4;
}}
@keyframes fadeIn{{to{{opacity:1}}}}
@keyframes popIn{{to{{opacity:1;transform:translateY(0) scale(1)}}}}
</style></head><body><div class="wrap">
  <h1>What we'll cover</h1>
  <p class="sub">Four themes in the live app — each card appears as we talk through it.</p>
  <div class="grid">
    {cards_html}
  </div>
</div></body></html>"""


def loop_html() -> str:
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
{BASE_CSS}
.wrap{{height:100%;padding:48px 64px;display:flex;flex-direction:column;justify-content:center;background:#0b1220}}
h1{{font-family:Georgia,serif;font-weight:400;font-size:2.6rem;margin:0 0 2.5rem;text-align:center}}
.loop{{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap}}
.step{{width:200px;background:#111827;border:1px solid #334155;border-radius:16px;padding:22px 16px;text-align:center}}
.glyph{{width:52px;height:52px;margin:0 auto 12px;border-radius:14px;background:#0f172a;border:1px solid #334155;
  display:flex;align-items:center;justify-content:center;font-size:1.35rem;font-weight:700;color:#7dd3fc}}
.step h3{{margin:0 0 6px;font-size:1.1rem}}
.step p{{margin:0;color:#94a3b8;font-size:0.95rem;line-height:1.35}}
.arrow{{color:#38bdf8;font-size:1.8rem;font-weight:700}}
.mark{{background:rgba(34,197,94,0.35);padding:0 5px;border-radius:3px;color:#dcfce7}}
</style></head><body><div class="wrap">
  <h1>The Spacecore loop</h1>
  <div class="loop">
    <div class="step"><div class="glyph">1</div><h3>Add</h3><p>Place a <span class="mark">TLE</span></p></div>
    <div class="arrow">→</div>
    <div class="step"><div class="glyph">2</div><h3>Speed</h3><p>Watch it <span class="mark">move</span></p></div>
    <div class="arrow">→</div>
    <div class="step"><div class="glyph">3</div><h3>Coverage</h3><p>Tune the <span class="mark">layers</span></p></div>
    <div class="arrow">→</div>
    <div class="step"><div class="glyph">4</div><h3>Export</h3><p><span class="mark">Share</span> results</p></div>
  </div>
</div></body></html>"""
