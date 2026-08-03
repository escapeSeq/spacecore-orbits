"""
Record a live interactive walkthrough of Spacecore Orbits.
Clicks real controls and captures full WebGL animations (Playwright video → per-beat MP4).
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "captures" / "raw"
CLIPS = ROOT / "captures" / "clips"
BASE = os.environ.get("SPACECORE_URL", "http://localhost:3000")
VW, VH = 1600, 1000

FFMPEG = os.environ.get(
    "FFMPEG",
    shutil.which("ffmpeg")
    or r"C:\Users\gutte\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin\ffmpeg.exe",
)

OVERLAY_CSS = """
#wo-train-root{position:fixed;inset:0;z-index:2147483646;pointer-events:none;overflow:hidden}
#wo-train-root .glow{
  position:absolute;border-radius:10px;background:transparent;
  border:1.5px solid rgba(125,211,252,0.95);
  box-shadow:0 0 0 1px rgba(56,189,248,0.35),0 0 10px 2px rgba(56,189,248,0.45);
}
#wo-train-root .label{
  position:absolute;background:rgba(15,23,42,0.92);color:#f1f5f9;
  border:1px solid rgba(125,211,252,0.55);border-radius:10px;
  padding:8px 12px;font:600 13px/1.3 Helvetica,Arial,sans-serif;
  max-width:280px;box-shadow:0 10px 28px rgba(0,0,0,0.28);white-space:nowrap;
}
#wo-train-root svg.arrows{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
"""

OVERLAY_JS = r"""
(() => {
  const old = document.getElementById("wo-train-root");
  if (old) old.remove();
  const root = document.createElement("div");
  root.id = "wo-train-root";
  document.body.appendChild(root);
  function padRect(r, pad = 8) {
    return { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
  }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function nearestEdgePoint(box, towardX, towardY) {
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    const dx = towardX - cx, dy = towardY - cy;
    if (Math.abs(dx) * box.h > Math.abs(dy) * box.w) {
      return { x: dx > 0 ? box.x + box.w : box.x, y: clamp(towardY, box.y + 8, box.y + box.h - 8) };
    }
    return { x: clamp(towardX, box.x + 8, box.x + box.w - 8), y: dy > 0 ? box.y + box.h : box.y };
  }
  function placeCallout(target, text, side = "auto") {
    const gap = 18, approxW = Math.min(300, 12 + text.length * 8.2), approxH = 38;
    const cx = target.x + target.w / 2, cy = target.y + target.h / 2;
    const vw = window.innerWidth, vh = window.innerHeight;
    let preferred = side;
    if (preferred === "auto") {
      const space = { left: target.x, right: vw - (target.x + target.w), top: target.y, bottom: vh - (target.y + target.h) };
      preferred = Object.entries(space).sort((a, b) => b[1] - a[1])[0][0];
    }
    let lx, ly;
    if (preferred === "left") { lx = target.x - gap - approxW; ly = cy - approxH / 2; }
    else if (preferred === "right") { lx = target.x + target.w + gap; ly = cy - approxH / 2; }
    else if (preferred === "top") { lx = cx - approxW / 2; ly = target.y - gap - approxH; }
    else { lx = cx - approxW / 2; ly = target.y + target.h + gap; }
    lx = clamp(lx, 12, vw - approxW - 12);
    ly = clamp(ly, 12, vh - approxH - 12);
    return { labelBox: { x: lx, y: ly, w: approxW, h: approxH } };
  }
  function curvedPath(from, to) {
    const dx = to.x - from.x, dy = to.y - from.y, dist = Math.hypot(dx, dy) || 1;
    const bend = Math.min(48, dist * 0.28), nx = -dy / dist, ny = dx / dist;
    return `M ${from.x} ${from.y} C ${from.x + dx * 0.35 + nx * bend} ${from.y + dy * 0.35 + ny * bend}, ${from.x + dx * 0.7 + nx * bend * 0.35} ${from.y + dy * 0.7 + ny * bend * 0.35}, ${to.x} ${to.y}`;
  }
  window.__woTrain = {
    clear() { root.innerHTML = ""; },
    rectOf(el) {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    },
    spotlight(rects, callouts = []) {
      root.innerHTML = "";
      const padded = rects.map((r) => padRect(r, r.pad ?? 8));
      const vw = window.innerWidth, vh = window.innerHeight, svgNS = "http://www.w3.org/2000/svg";
      const dimSvg = document.createElementNS(svgNS, "svg");
      dimSvg.setAttribute("width", String(vw)); dimSvg.setAttribute("height", String(vh));
      dimSvg.setAttribute("style", "position:absolute;inset:0;width:100%;height:100%;pointer-events:none");
      const defs = document.createElementNS(svgNS, "defs");
      const mask = document.createElementNS(svgNS, "mask");
      mask.setAttribute("id", "wo-frost-mask"); mask.setAttribute("maskUnits", "userSpaceOnUse");
      const full = document.createElementNS(svgNS, "rect");
      full.setAttribute("x", "0"); full.setAttribute("y", "0");
      full.setAttribute("width", String(vw)); full.setAttribute("height", String(vh));
      full.setAttribute("fill", "white"); mask.appendChild(full);
      padded.forEach((r) => {
        const hole = document.createElementNS(svgNS, "rect");
        hole.setAttribute("x", String(r.x)); hole.setAttribute("y", String(r.y));
        hole.setAttribute("width", String(r.w)); hole.setAttribute("height", String(r.h));
        hole.setAttribute("rx", "10"); hole.setAttribute("ry", "10"); hole.setAttribute("fill", "black");
        mask.appendChild(hole);
      });
      defs.appendChild(mask); dimSvg.appendChild(defs);
      const dim = document.createElementNS(svgNS, "rect");
      dim.setAttribute("x", "0"); dim.setAttribute("y", "0");
      dim.setAttribute("width", String(vw)); dim.setAttribute("height", String(vh));
      dim.setAttribute("fill", "rgba(15, 23, 42, 0.38)");
      dim.setAttribute("mask", "url(#wo-frost-mask)");
      dimSvg.appendChild(dim); root.appendChild(dimSvg);
      padded.forEach((r) => {
        const glow = document.createElement("div"); glow.className = "glow";
        glow.style.left = `${r.x}px`; glow.style.top = `${r.y}px`;
        glow.style.width = `${r.w}px`; glow.style.height = `${r.h}px`;
        root.appendChild(glow);
      });
      const arrowSvg = document.createElementNS(svgNS, "svg");
      arrowSvg.classList.add("arrows");
      arrowSvg.setAttribute("width", String(vw)); arrowSvg.setAttribute("height", String(vh));
      const aDefs = document.createElementNS(svgNS, "defs");
      aDefs.innerHTML = `<marker id="wo-arrowhead" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0.6 L8,4.5 L0,8.4 Z" fill="#7dd3fc"/></marker>`;
      arrowSvg.appendChild(aDefs); root.appendChild(arrowSvg);
      callouts.forEach((c) => {
        const target = padded[c.targetIndex ?? 0] || padded[0];
        if (!target) return;
        let { labelBox } = placeCallout(target, c.text, c.side || "auto");
        const lab = document.createElement("div"); lab.className = "label"; lab.textContent = c.text;
        lab.style.left = `${labelBox.x}px`; lab.style.top = `${labelBox.y}px`;
        root.appendChild(lab);
        const lr = lab.getBoundingClientRect();
        labelBox = { x: lr.x, y: lr.y, w: lr.width, h: lr.height };
        const from = nearestEdgePoint(labelBox, target.x + target.w / 2, target.y + target.h / 2);
        const to = nearestEdgePoint(target, from.x, from.y);
        const pathEl = document.createElementNS(svgNS, "path");
        pathEl.setAttribute("d", curvedPath(from, to));
        pathEl.setAttribute("fill", "none"); pathEl.setAttribute("stroke", "#7dd3fc");
        pathEl.setAttribute("stroke-width", "2.25"); pathEl.setAttribute("stroke-linecap", "round");
        pathEl.setAttribute("marker-end", "url(#wo-arrowhead)");
        arrowSvg.appendChild(pathEl);
      });
    },
  };
})();
"""


class Timeline:
    def __init__(self):
        self.t0 = time.perf_counter()
        self.marks: list[dict] = []

    def mark(self, beat_id: str):
        t = time.perf_counter() - self.t0
        self.marks.append({"id": beat_id, "t": round(t, 3)})
        print(f"  mark {beat_id} @ {t:.2f}s")


def inject_overlay(page):
    page.add_style_tag(content=OVERLAY_CSS)
    page.evaluate(OVERLAY_JS)


def _react_set_range(page, group_re: str, value: float):
    """Set a React-controlled range input so state (and the 3D scene) actually update."""
    page.evaluate(
        """({ groupRe, value }) => {
      const rx = new RegExp(groupRe, 'i');
      const groups = [...document.querySelectorAll('.control-group')];
      const g = groups.find((el) => rx.test(el.textContent || ''));
      const input = g?.querySelector('input[type=range]');
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, String(value));
      // Clear React value tracker so the next input event is not ignored
      const tracker = input._valueTracker;
      if (tracker) tracker.setValue(String(value === 0 ? 1 : 0));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      const key = Object.keys(input).find((k) => k.startsWith('__reactProps$'));
      if (key && typeof input[key].onChange === 'function') {
        input[key].onChange({ target: input, currentTarget: input });
      }
      return true;
    }""",
        {"groupRe": group_re, "value": value},
    )


def set_speed(page, value: float):
    _react_set_range(page, "Simulation Speed", value)


def animate_speed(page, start: float, end: float, steps: int = 18, step_ms: int = 120):
    """Ramp speed via React state, and drag the thumb so the UI change is obvious."""
    group = page.locator(".control-group").filter(has_text="Simulation Speed")
    slider = group.locator("input[type=range]")
    box = slider.bounding_box()
    for i in range(steps + 1):
        t = i / steps
        v = start + (end - start) * t
        set_speed(page, round(v, 1))
        if box:
            x = box["x"] + box["width"] * t
            y = box["y"] + box["height"] / 2
            page.mouse.move(x, y)
            if i == 0:
                page.mouse.down()
            if i == steps:
                page.mouse.up()
        page.wait_for_timeout(step_ms)
    # Ensure final value stuck in React
    set_speed(page, end)


def set_elevation(page, value: float):
    _react_set_range(page, "Minimum Elevation", value)


def animate_elevation(page, start: float, end: float, steps: int = 14, step_ms: int = 110):
    for i in range(steps + 1):
        v = start + (end - start) * (i / steps)
        set_elevation(page, round(v))
        page.wait_for_timeout(step_ms)


def rotate_camera(page, dx=260, dy=-110, steps=30):
    canvas = page.locator("canvas").first
    box = canvas.bounding_box()
    if not box:
        return
    cx = box["x"] + box["width"] * 0.62
    cy = box["y"] + box["height"] * 0.48
    page.mouse.move(cx, cy)
    page.mouse.down()
    page.mouse.move(cx + dx, cy + dy, steps=steps)
    page.mouse.up()
    page.wait_for_timeout(200)


def click_button_matching(page, pattern: str):
    page.evaluate(
        """(re) => {
      const rx = new RegExp(re, 'i');
      const btn = [...document.querySelectorAll('button')].find((b) => rx.test(b.textContent || ''));
      btn?.click();
    }""",
        pattern,
    )


def toggle_checkbox_label(page, label: str):
    page.evaluate(
        """(label) => {
      const lab = [...document.querySelectorAll('label')].find((l) =>
        (l.textContent || '').trim().toLowerCase() === label.toLowerCase()
      );
      const input = lab?.querySelector('input[type=checkbox]');
      if (input) input.click();
    }""",
        label,
    )


def ensure_dark(page):
    page.evaluate(
        """() => {
      const root = document.querySelector('.App');
      const btn = document.querySelector('.theme-toggle-float');
      if (root && root.getAttribute('data-theme') === 'light' && btn) btn.click();
    }"""
    )


def cut_clips(master: Path, marks: list[dict], end_t: float):
    CLIPS.mkdir(parents=True, exist_ok=True)
    # Pair consecutive marks; last mark runs to end_t
    for i, m in enumerate(marks):
        start = m["t"]
        stop = marks[i + 1]["t"] if i + 1 < len(marks) else end_t
        # small pad so cuts aren't abrupt
        dur = max(0.8, stop - start)
        out = CLIPS / f"{m['id']}.mp4"
        subprocess.run(
            [
                FFMPEG,
                "-y",
                "-ss",
                f"{start:.3f}",
                "-i",
                str(master),
                "-t",
                f"{dur:.3f}",
                "-vf",
                f"scale={VW}:{VH}:force_original_aspect_ratio=decrease,pad={VW}:{VH}:(ow-iw)/2:(oh-ih)/2,fps=30",
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-an",
                "-movflags",
                "+faststart",
                str(out),
            ],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        print(f"clip {out.name} {dur:.1f}s")


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    if CLIPS.exists():
        shutil.rmtree(CLIPS)
    CLIPS.mkdir(parents=True, exist_ok=True)

    print("Live capture from", BASE)
    tl = Timeline()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": VW, "height": VH},
            device_scale_factor=1,
            record_video_dir=str(RAW),
            record_video_size={"width": VW, "height": VH},
        )
        page = context.new_page()
        page.on("dialog", lambda d: d.dismiss())

        page.goto(BASE, wait_until="domcontentloaded", timeout=120_000)
        page.wait_for_selector(".control-panel", timeout=120_000)
        page.wait_for_timeout(2800)
        inject_overlay(page)
        ensure_dark(page)
        page.wait_for_timeout(400)
        # Keep timeline from browser start so cut points match Playwright's video clock

        # 03 — overview + gentle camera move (action-first, short callout)
        tl.mark("03-app")
        page.wait_for_timeout(400)
        page.evaluate(
            """() => {
          window.__woTrain.clear();
          const panel = document.querySelector('.control-panel');
          const scene = document.querySelector('.canvas-scene') || document.querySelector('canvas');
          const rects = [];
          if (panel) rects.push({ ...window.__woTrain.rectOf(panel), pad: 6 });
          if (scene) rects.push({ ...window.__woTrain.rectOf(scene), pad: 4 });
          window.__woTrain.spotlight(rects, [
            { text: 'Control panel', targetIndex: 0, side: 'right' },
            { text: '3D Earth', targetIndex: Math.min(1, rects.length - 1), side: 'left' },
          ]);
        }"""
        )
        page.wait_for_timeout(1200)
        page.evaluate("() => window.__woTrain.clear()")
        rotate_camera(page, dx=180, dy=-40, steps=24)
        page.wait_for_timeout(1600)

        # 04 — clock / instructions (do not open modal)
        tl.mark("04-time")
        page.evaluate(
            """() => {
          window.__woTrain.clear();
          const row = document.querySelector('.panel-time-row');
          if (!row) return;
          window.__woTrain.spotlight([{ ...window.__woTrain.rectOf(row), pad: 8 }], [
            { text: 'Clock · Instructions', targetIndex: 0, side: 'right' },
          ]);
        }"""
        )
        page.wait_for_timeout(2800)
        page.evaluate("() => window.__woTrain.clear()")
        page.wait_for_timeout(400)

        # 05 — add an elliptical sample (Molniya) silently so speed/orbit demos read clearly
        tl.mark("05-add-tle")
        page.evaluate(
            """() => {
          const mol = [...document.querySelectorAll('button')]
            .find((b) => /MOLNIYA/i.test(b.textContent || ''));
          mol?.scrollIntoView({ block: 'center' });
        }"""
        )
        page.wait_for_timeout(350)
        page.evaluate(
            """() => {
          window.__woTrain.clear();
          const mol = [...document.querySelectorAll('button')]
            .find((b) => /MOLNIYA/i.test(b.textContent || ''));
          const grid = mol?.parentElement;
          if (!grid) return;
          window.__woTrain.spotlight([{ ...window.__woTrain.rectOf(grid), pad: 6 }], [
            { text: 'Popular sample TLE', targetIndex: 0, side: 'right' },
          ]);
        }"""
        )
        page.wait_for_timeout(900)
        page.evaluate("() => window.__woTrain.clear()")
        click_button_matching(page, r"MOLNIYA")
        page.wait_for_timeout(2800)

        # 06 — push speed high enough that the eccentric orbit clearly races
        tl.mark("06-speed")
        page.evaluate(
            """() => {
          window.__woTrain.clear();
          const g = [...document.querySelectorAll('.control-group')]
            .find((el) => /Simulation Speed/i.test(el.textContent || ''));
          if (!g) return;
          g.scrollIntoView({ block: 'nearest' });
          window.__woTrain.spotlight([{ ...window.__woTrain.rectOf(g), pad: 6 }], [
            { text: 'Raise speed — watch the orbit', targetIndex: 0, side: 'right' },
          ]);
        }"""
        )
        page.wait_for_timeout(600)
        page.evaluate("() => window.__woTrain.clear()")
        animate_speed(page, 1, 650, steps=26, step_ms=90)
        page.wait_for_timeout(4200)
        click_button_matching(page, r"Pause")
        page.wait_for_timeout(900)
        click_button_matching(page, r"Resume")
        page.wait_for_timeout(2000)

        # 07 — theme toggle light ↔ dark
        tl.mark("07-theme")
        page.evaluate(
            """() => {
          window.__woTrain.clear();
          const btn = document.querySelector('.theme-toggle-float');
          if (!btn) return;
          window.__woTrain.spotlight([{ ...window.__woTrain.rectOf(btn), pad: 10 }], [
            { text: 'Theme toggle', targetIndex: 0, side: 'left' },
          ]);
        }"""
        )
        page.wait_for_timeout(700)
        page.evaluate("() => window.__woTrain.clear()")
        page.click(".theme-toggle-float")
        page.wait_for_timeout(1500)
        page.click(".theme-toggle-float")
        page.wait_for_timeout(1100)

        # 08 — rotate + watch orbit animate at high speed
        tl.mark("08-satellite")
        page.evaluate("() => window.__woTrain.clear()")
        set_speed(page, 700)
        rotate_camera(page, dx=300, dy=-150, steps=32)
        page.wait_for_timeout(400)
        rotate_camera(page, dx=120, dy=-80, steps=20)
        page.wait_for_timeout(4500)

        # 09 — toggle global controls
        tl.mark("09-global")
        page.evaluate(
            """() => {
          window.__woTrain.clear();
          const box = [...document.querySelectorAll('div')].find((d) =>
            /Global Controls/i.test(d.textContent || '') && (d.textContent || '').length < 220
          );
          const target = box?.parentElement || box;
          if (!target) return;
          target.scrollIntoView({ block: 'center' });
          window.__woTrain.spotlight([{ ...window.__woTrain.rectOf(target), pad: 6 }], [
            { text: 'Toggle global layers', targetIndex: 0, side: 'right' },
          ]);
        }"""
        )
        page.wait_for_timeout(800)
        page.evaluate("() => window.__woTrain.clear()")
        for label in ("Coverage", "Beams", "Orbits", "Grid"):
            toggle_checkbox_label(page, label)
            page.wait_for_timeout(600)
        for label in ("Coverage", "Beams", "Orbits", "Grid"):
            toggle_checkbox_label(page, label)
            page.wait_for_timeout(600)
        page.wait_for_timeout(700)

        # 10 — elevation animation
        tl.mark("10-elevation")
        page.evaluate(
            """() => {
          window.__woTrain.clear();
          const g = [...document.querySelectorAll('.control-group')]
            .find((el) => /Minimum Elevation/i.test(el.textContent || ''));
          if (!g) return;
          g.scrollIntoView({ block: 'center' });
          window.__woTrain.spotlight([{ ...window.__woTrain.rectOf(g), pad: 6 }], [
            { text: 'Raise elevation mask', targetIndex: 0, side: 'right' },
          ]);
        }"""
        )
        page.wait_for_timeout(700)
        page.evaluate("() => window.__woTrain.clear()")
        animate_elevation(page, 0, 55, steps=16, step_ms=100)
        page.wait_for_timeout(1100)
        animate_elevation(page, 55, 0, steps=12, step_ms=90)
        page.wait_for_timeout(700)

        # 12 — paste TLE UI (keep current sample satellite; no constellation)
        tl.mark("12-paste")
        set_speed(page, 400)
        page.wait_for_timeout(400)
        page.evaluate(
            """() => {
          window.__woTrain.clear();
          const btn = [...document.querySelectorAll('button')]
            .find((b) => /Add TLE Satellite/i.test(b.textContent || ''));
          if (!btn) return;
          btn.scrollIntoView({ block: 'center' });
          window.__woTrain.spotlight([{ ...window.__woTrain.rectOf(btn), pad: 8 }], [
            { text: 'Open TLE paste', targetIndex: 0, side: 'right' },
          ]);
        }"""
        )
        page.wait_for_timeout(700)
        page.evaluate("() => window.__woTrain.clear()")
        click_button_matching(page, r"Add TLE Satellite")
        page.wait_for_timeout(2200)
        click_button_matching(page, r"Cancel")
        page.wait_for_timeout(700)

        # 13 — exports menu
        tl.mark("13-exports")
        page.evaluate(
            """() => {
          window.__woTrain.clear();
          const btn = [...document.querySelectorAll('button')]
            .find((b) => /^Exports/i.test((b.textContent || '').trim()));
          btn?.scrollIntoView({ block: 'center' });
          if (!btn) return;
          window.__woTrain.spotlight([{ ...window.__woTrain.rectOf(btn), pad: 8 }], [
            { text: 'Open Exports', targetIndex: 0, side: 'right' },
          ]);
        }"""
        )
        page.wait_for_timeout(700)
        page.evaluate("() => window.__woTrain.clear()")
        click_button_matching(page, r"Exports")
        page.wait_for_timeout(800)
        page.evaluate(
            """() => {
          window.__woTrain.clear();
          const menu = document.querySelector('.exports-dropdown-menu');
          if (!menu) return;
          window.__woTrain.spotlight([{ ...window.__woTrain.rectOf(menu), pad: 8 }], [
            { text: 'GLB · SVG · Animation · TLE', targetIndex: 0, side: 'right' },
          ]);
        }"""
        )
        page.wait_for_timeout(2400)
        page.evaluate("() => window.__woTrain.clear()")
        page.mouse.click(900, 200)
        page.wait_for_timeout(900)

        end_t = time.perf_counter() - tl.t0
        print(f"recording length ~{end_t:.1f}s")

        # Finalize video
        video = page.video
        page.close()
        webm = Path(video.path()) if video else None
        context.close()
        browser.close()

    if not webm or not webm.exists():
        # Playwright may move file after close
        candidates = sorted(RAW.glob("*.webm"), key=lambda p: p.stat().st_mtime, reverse=True)
        if not candidates:
            raise RuntimeError("No recorded video found")
        webm = candidates[0]

    master = RAW / "walkthrough.mp4"
    subprocess.run(
        [
            FFMPEG,
            "-y",
            "-i",
            str(webm),
            "-vf",
            f"scale={VW}:{VH}:force_original_aspect_ratio=decrease,pad={VW}:{VH}:(ow-iw)/2:(oh-ih)/2,fps=30",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-an",
            "-movflags",
            "+faststart",
            str(master),
        ],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    print("master", master)

    (RAW / "timeline.json").write_text(
        json.dumps({"marks": tl.marks, "end": end_t}, indent=2),
        encoding="utf-8",
    )
    cut_clips(master, tl.marks, end_t + 0.3)
    print("done live capture ->", CLIPS)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("ERROR:", e, file=sys.stderr)
        sys.exit(1)
