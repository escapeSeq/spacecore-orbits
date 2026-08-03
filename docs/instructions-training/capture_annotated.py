"""
Capture annotated Spacecore Orbits frames from the running app.
Interactive demo: add a sample satellite, open menus, annotate with callouts.
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "screenshots"
BASE = os.environ.get("SPACECORE_URL", "http://localhost:3001")

OVERLAY_CSS = """
#wo-train-root{position:fixed;inset:0;z-index:2147483646;pointer-events:none;overflow:hidden}
#wo-train-root .glow{
  position:absolute;border-radius:10px;background:transparent;
  border:1.5px solid rgba(125,211,252,0.95);
  box-shadow:
    0 0 0 1px rgba(56,189,248,0.35),
    0 0 10px 2px rgba(56,189,248,0.45),
    0 0 22px 4px rgba(56,189,248,0.22);
}
#wo-train-root .label{
  position:absolute;background:rgba(15,23,42,0.92);color:#f1f5f9;
  border:1px solid rgba(125,211,252,0.55);border-radius:10px;
  padding:8px 12px;font:600 13px/1.3 "Avenir Next",Helvetica,Arial,sans-serif;
  max-width:280px;box-shadow:0 10px 28px rgba(0,0,0,0.28);
  white-space:nowrap;
}
#wo-train-root svg.arrows{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
"""

OVERLAY_JS = """
(() => {
  const old = document.getElementById("wo-train-root");
  if (old) old.remove();
  const root = document.createElement("div");
  root.id = "wo-train-root";
  document.body.appendChild(root);

  function padRect(r, pad = 8) {
    return { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
  }
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }
  function nearestEdgePoint(box, towardX, towardY) {
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const dx = towardX - cx;
    const dy = towardY - cy;
    if (Math.abs(dx) * box.h > Math.abs(dy) * box.w) {
      return {
        x: dx > 0 ? box.x + box.w : box.x,
        y: clamp(towardY, box.y + 8, box.y + box.h - 8),
      };
    }
    return {
      x: clamp(towardX, box.x + 8, box.x + box.w - 8),
      y: dy > 0 ? box.y + box.h : box.y,
    };
  }
  function placeCallout(target, text, side = "auto") {
    const gap = 18;
    const approxW = Math.min(300, 12 + text.length * 8.2);
    const approxH = 38;
    const cx = target.x + target.w / 2;
    const cy = target.y + target.h / 2;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let preferred = side;
    if (preferred === "auto") {
      const space = {
        left: target.x,
        right: vw - (target.x + target.w),
        top: target.y,
        bottom: vh - (target.y + target.h),
      };
      preferred = Object.entries(space).sort((a, b) => b[1] - a[1])[0][0];
    }
    let lx, ly;
    if (preferred === "left") {
      lx = target.x - gap - approxW;
      ly = cy - approxH / 2;
    } else if (preferred === "right") {
      lx = target.x + target.w + gap;
      ly = cy - approxH / 2;
    } else if (preferred === "top") {
      lx = cx - approxW / 2;
      ly = target.y - gap - approxH;
    } else {
      lx = cx - approxW / 2;
      ly = target.y + target.h + gap;
    }
    lx = clamp(lx, 12, vw - approxW - 12);
    ly = clamp(ly, 12, vh - approxH - 12);
    return { labelBox: { x: lx, y: ly, w: approxW, h: approxH }, preferred };
  }
  function curvedPath(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy) || 1;
    const bend = Math.min(48, dist * 0.28);
    const nx = -dy / dist;
    const ny = dx / dist;
    const c1x = from.x + dx * 0.35 + nx * bend;
    const c1y = from.y + dy * 0.35 + ny * bend;
    const c2x = from.x + dx * 0.7 + nx * bend * 0.35;
    const c2y = from.y + dy * 0.7 + ny * bend * 0.35;
    return `M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}`;
  }

  window.__woTrain = {
    clear() { root.innerHTML = ""; },
    rectOf(el) {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    },
    findByText(selector, re) {
      const rx = new RegExp(re, "i");
      return [...document.querySelectorAll(selector)].find((el) =>
        rx.test((el.textContent || "").trim())
      );
    },
    spotlight(rects, callouts = []) {
      root.innerHTML = "";
      const padded = rects.map((r) => padRect(r, r.pad ?? 8));
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const svgNS = "http://www.w3.org/2000/svg";

      const dimSvg = document.createElementNS(svgNS, "svg");
      dimSvg.setAttribute("width", String(vw));
      dimSvg.setAttribute("height", String(vh));
      dimSvg.setAttribute("style", "position:absolute;inset:0;width:100%;height:100%;pointer-events:none");
      const defs = document.createElementNS(svgNS, "defs");
      const mask = document.createElementNS(svgNS, "mask");
      mask.setAttribute("id", "wo-frost-mask");
      mask.setAttribute("maskUnits", "userSpaceOnUse");
      const full = document.createElementNS(svgNS, "rect");
      full.setAttribute("x", "0"); full.setAttribute("y", "0");
      full.setAttribute("width", String(vw)); full.setAttribute("height", String(vh));
      full.setAttribute("fill", "white");
      mask.appendChild(full);
      padded.forEach((r) => {
        const hole = document.createElementNS(svgNS, "rect");
        hole.setAttribute("x", String(r.x)); hole.setAttribute("y", String(r.y));
        hole.setAttribute("width", String(r.w)); hole.setAttribute("height", String(r.h));
        hole.setAttribute("rx", "10"); hole.setAttribute("ry", "10");
        hole.setAttribute("fill", "black");
        mask.appendChild(hole);
      });
      defs.appendChild(mask);
      dimSvg.appendChild(defs);
      const dim = document.createElementNS(svgNS, "rect");
      dim.setAttribute("x", "0"); dim.setAttribute("y", "0");
      dim.setAttribute("width", String(vw)); dim.setAttribute("height", String(vh));
      dim.setAttribute("fill", "rgba(15, 23, 42, 0.42)");
      dim.setAttribute("mask", "url(#wo-frost-mask)");
      dimSvg.appendChild(dim);
      root.appendChild(dimSvg);

      padded.forEach((r) => {
        const glow = document.createElement("div");
        glow.className = "glow";
        glow.style.left = `${r.x}px`;
        glow.style.top = `${r.y}px`;
        glow.style.width = `${r.w}px`;
        glow.style.height = `${r.h}px`;
        root.appendChild(glow);
      });

      const arrowSvg = document.createElementNS(svgNS, "svg");
      arrowSvg.classList.add("arrows");
      arrowSvg.setAttribute("width", String(vw));
      arrowSvg.setAttribute("height", String(vh));
      const aDefs = document.createElementNS(svgNS, "defs");
      aDefs.innerHTML = `
        <marker id="wo-arrowhead" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
          <path d="M0,0.6 L8,4.5 L0,8.4 Z" fill="#7dd3fc"/>
        </marker>
        <filter id="wo-arrow-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>`;
      arrowSvg.appendChild(aDefs);
      root.appendChild(arrowSvg);

      callouts.forEach((c) => {
        const target = padded[c.targetIndex ?? 0] || padded[0];
        if (!target) return;
        let { labelBox } = placeCallout(target, c.text, c.side || "auto");
        const lab = document.createElement("div");
        lab.className = "label";
        lab.textContent = c.text;
        lab.style.left = `${labelBox.x}px`;
        lab.style.top = `${labelBox.y}px`;
        root.appendChild(lab);
        const lr = lab.getBoundingClientRect();
        labelBox = { x: lr.x, y: lr.y, w: lr.width, h: lr.height };
        const from = nearestEdgePoint(labelBox, target.x + target.w / 2, target.y + target.h / 2);
        const to = nearestEdgePoint(target, from.x, from.y);
        const pathEl = document.createElementNS(svgNS, "path");
        pathEl.setAttribute("d", curvedPath(from, to));
        pathEl.setAttribute("fill", "none");
        pathEl.setAttribute("stroke", "#7dd3fc");
        pathEl.setAttribute("stroke-width", "2.25");
        pathEl.setAttribute("stroke-linecap", "round");
        pathEl.setAttribute("marker-end", "url(#wo-arrowhead)");
        pathEl.setAttribute("filter", "url(#wo-arrow-glow)");
        arrowSvg.appendChild(pathEl);
      });
    },
  };
})();
"""


def inject_overlay(page):
    page.add_style_tag(content=OVERLAY_CSS)
    page.evaluate(OVERLAY_JS)


def shot(page, name: str):
    page.wait_for_timeout(120)
    path = OUT / f"{name}.png"
    page.screenshot(path=str(path), type="png", full_page=False)
    print(f"saved {name}")


def wait_app(page):
    page.goto(BASE, wait_until="domcontentloaded", timeout=120_000)
    page.wait_for_selector(".control-panel", timeout=120_000)
    # WebGL / Earth may take a moment
    page.wait_for_timeout(2500)
    # Dismiss any alert leftovers
    page.on("dialog", lambda d: d.dismiss())


def set_simulation_speed(page, value: float) -> None:
    page.evaluate(
        """(value) => {
      const groups = [...document.querySelectorAll('.control-group')];
      const g = groups.find((el) => /Simulation Speed/i.test(el.textContent || ''));
      const input = g?.querySelector('input[type=range]');
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, String(value));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }""",
        value,
    )


def rotate_camera(page, dx: int = 280, dy: int = -120, steps: int = 28) -> None:
    """Drag on the WebGL canvas to orbit to a new viewing angle."""
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
    page.wait_for_timeout(350)
    # Second nudge for a more distinctive elevation angle
    page.mouse.move(cx + dx * 0.2, cy + dy * 0.2)
    page.mouse.down()
    page.mouse.move(cx + dx * 0.2, cy + dy * 0.2 - 90, steps=16)
    page.mouse.up()
    page.wait_for_timeout(400)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    print("Capturing from", BASE)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1600, "height": 1000},
            device_scale_factor=2,
        )
        page = context.new_page()
        wait_app(page)
        inject_overlay(page)

        # Ensure dark theme for consistent look
        page.evaluate(
            """() => {
          const btn = document.querySelector('.theme-toggle-float');
          if (!btn) return;
          // If currently light (moon icon path often present when light), click to dark
          const root = document.querySelector('.App');
          if (root && root.getAttribute('data-theme') === 'light') btn.click();
        }"""
        )
        page.wait_for_timeout(400)

        # 03 — full app
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
        shot(page, "ann-03-app")

        # 04 — time + instructions
        page.evaluate(
            """() => {
          window.__woTrain.clear();
          const row = document.querySelector('.panel-time-row');
          if (!row) return;
          window.__woTrain.spotlight([{ ...window.__woTrain.rectOf(row), pad: 8 }], [
            { text: 'Simulation time · Instructions', targetIndex: 0, side: 'right' },
          ]);
        }"""
        )
        shot(page, "ann-04-time")

        # Raise speed first so the speed shot shows the high value
        set_simulation_speed(page, 220)
        page.wait_for_timeout(400)

        # 05 — speed (illustrated at high speed)
        page.evaluate(
            """() => {
          window.__woTrain.clear();
          const groups = [...document.querySelectorAll('.control-group')];
          const g = groups.find((el) => /Simulation Speed/i.test(el.textContent || ''));
          if (!g) return;
          window.__woTrain.spotlight([{ ...window.__woTrain.rectOf(g), pad: 6 }], [
            { text: 'High speed · Pause / Resume', targetIndex: 0, side: 'right' },
          ]);
        }"""
        )
        shot(page, "ann-05-speed")

        # 06 — theme toggle
        page.evaluate(
            """() => {
          window.__woTrain.clear();
          const btn = document.querySelector('.theme-toggle-float');
          if (!btn) return;
          window.__woTrain.spotlight([{ ...window.__woTrain.rectOf(btn), pad: 10 }], [
            { text: 'Light / dark theme', targetIndex: 0, side: 'left' },
          ]);
        }"""
        )
        shot(page, "ann-06-theme")

        # 07 — popular TLEs → highlight MOLNIYA
        page.evaluate(
            """() => {
          const mol = [...document.querySelectorAll('button')].find((b) =>
            /MOLNIYA/i.test(b.textContent || '')
          );
          mol?.scrollIntoView({ block: 'center' });
        }"""
        )
        page.wait_for_timeout(300)
        page.evaluate(
            """() => {
          window.__woTrain.clear();
          const mol = [...document.querySelectorAll('button')].find((b) =>
            /MOLNIYA/i.test(b.textContent || '')
          );
          const grid = mol?.parentElement;
          if (!grid) return;
          window.__woTrain.spotlight([{ ...window.__woTrain.rectOf(grid), pad: 6 }], [
            { text: 'Popular · click Molniya', targetIndex: 0, side: 'right' },
          ]);
        }"""
        )
        shot(page, "ann-07-add-tle")

        # Click MOLNIYA
        page.evaluate(
            """() => {
          window.__woTrain.clear();
          const mol = [...document.querySelectorAll('button')].find((b) =>
            /MOLNIYA/i.test(b.textContent || '')
          );
          mol?.click();
        }"""
        )
        page.wait_for_timeout(1800)

        # Clear overlay, rotate camera, let high-speed orbit animate
        page.evaluate("() => window.__woTrain.clear()")
        rotate_camera(page, dx=320, dy=-140)
        page.wait_for_timeout(2800)

        # 08 — Molniya orbit from new angle at high speed
        page.evaluate(
            """() => {
          window.__woTrain.clear();
          const panel = document.querySelector('.control-panel');
          const satBlocks = [...panel.querySelectorAll('div')].filter((d) => {
            const t = d.textContent || '';
            return /MOLNIYA/i.test(t) && /orbit|coverage|beam|altitude|inclination/i.test(t)
              && d.getBoundingClientRect().height > 40;
          });
          const block = satBlocks.sort(
            (a, b) => a.getBoundingClientRect().height - b.getBoundingClientRect().height
          )[0] || satBlocks[0];
          const scene = document.querySelector('.canvas-scene') || document.querySelector('canvas');
          const rects = [];
          if (block) {
            block.scrollIntoView({ block: 'nearest' });
            rects.push({ ...window.__woTrain.rectOf(block), pad: 6 });
          }
          if (scene) rects.push({ ...window.__woTrain.rectOf(scene), pad: 4 });
          const callouts = [];
          if (rects.length) {
            callouts.push({ text: 'Molniya · eccentric orbit', targetIndex: 0, side: 'right' });
          }
          if (rects.length > 1) {
            callouts.push({ text: 'Rotated view · high speed', targetIndex: 1, side: 'left' });
          }
          window.__woTrain.spotlight(rects, callouts);
        }"""
        )
        shot(page, "ann-08-satellite")

        # 09 — global controls
        page.evaluate(
            """() => {
          window.__woTrain.clear();
          const box = [...document.querySelectorAll('div')].find((d) =>
            /Global Controls/i.test(d.textContent || '') && (d.textContent || '').length < 200
          );
          const target = box?.parentElement || box;
          if (!target) return;
          target.scrollIntoView({ block: 'center' });
          window.__woTrain.spotlight([{ ...window.__woTrain.rectOf(target), pad: 6 }], [
            { text: 'Orbits · Coverage · Beams · Globe · Grid', targetIndex: 0, side: 'right' },
          ]);
        }"""
        )
        page.wait_for_timeout(200)
        shot(page, "ann-09-global")

        # 10 — elevation
        page.evaluate(
            """() => {
          window.__woTrain.clear();
          const groups = [...document.querySelectorAll('.control-group')];
          const g = groups.find((el) => /Minimum Elevation/i.test(el.textContent || ''));
          if (!g) return;
          g.scrollIntoView({ block: 'center' });
          window.__woTrain.spotlight([{ ...window.__woTrain.rectOf(g), pad: 6 }], [
            { text: 'Minimum elevation angle', targetIndex: 0, side: 'right' },
          ]);
        }"""
        )
        page.wait_for_timeout(200)
        shot(page, "ann-10-elevation")

        # 11 — constellation button
        page.evaluate(
            """() => {
          window.__woTrain.clear();
          const btn = [...document.querySelectorAll('button')].find((b) =>
            /minimal constellation/i.test(b.textContent || '')
          );
          if (!btn) return;
          btn.scrollIntoView({ block: 'center' });
          window.__woTrain.spotlight([{ ...window.__woTrain.rectOf(btn), pad: 8 }], [
            { text: 'Build minimal constellation', targetIndex: 0, side: 'right' },
          ]);
        }"""
        )
        page.wait_for_timeout(200)
        shot(page, "ann-11-constellation")

        # 12 — paste TLE UI
        page.evaluate(
            """() => {
          window.__woTrain.clear();
              const btn = [...document.querySelectorAll('button')].find((b) =>
            /Add TLE Satellite/i.test(b.textContent || '')
          );
          btn?.click();
        }"""
        )
        page.wait_for_timeout(500)
        page.evaluate(
            """() => {
          window.__woTrain.clear();
          const area = document.querySelector('.control-panel textarea');
          const wrap = area?.closest('div')?.parentElement || area;
          if (!wrap) return;
          wrap.scrollIntoView({ block: 'center' });
          window.__woTrain.spotlight([{ ...window.__woTrain.rectOf(wrap), pad: 6 }], [
            { text: 'Paste bulk TLE data', targetIndex: 0, side: 'right' },
          ]);
        }"""
        )
        shot(page, "ann-12-paste")

        # Close paste UI
        page.evaluate(
            """() => {
          const btn = [...document.querySelectorAll('button')].find((b) =>
            /Cancel/i.test(b.textContent || '')
          );
          btn?.click();
        }"""
        )
        page.wait_for_timeout(300)

        # 13 — exports menu
        page.evaluate(
            """() => {
          window.__woTrain.clear();
          const btn = [...document.querySelectorAll('button')].find((b) =>
            /^Exports/i.test((b.textContent || '').trim())
          );
          btn?.scrollIntoView({ block: 'center' });
          btn?.click();
        }"""
        )
        page.wait_for_timeout(400)
        page.evaluate(
            """() => {
          window.__woTrain.clear();
          const menu = document.querySelector('.exports-dropdown-menu');
          const drop = document.querySelector('.exports-dropdown');
          const target = menu || drop;
          if (!target) return;
          window.__woTrain.spotlight([{ ...window.__woTrain.rectOf(target), pad: 8 }], [
            { text: 'GLB · SVG · Animation · TLE', targetIndex: 0, side: 'right' },
          ]);
        }"""
        )
        shot(page, "ann-13-exports")

        print("done annotated captures")
        context.close()
        browser.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("ERROR:", e, file=sys.stderr)
        sys.exit(1)
