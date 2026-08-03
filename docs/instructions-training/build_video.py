"""
Spacecore Orbits instructions video — LibbyNeural + live clips + animated title cards.
"""
from __future__ import annotations

import asyncio
import os
import shutil
import subprocess
import sys
from pathlib import Path

from beats import BEATS, RATE, VOICE
from illustrations import hero_html, loop_html, map_html

ROOT = Path(__file__).resolve().parent
CLIPS = ROOT / "captures" / "clips"
SLIDES = ROOT / "build" / "slides"
ILLUS = ROOT / "build" / "illustrations"
AUDIO = ROOT / "audio"
BUILD = ROOT / "build"
OUT_VIDEO = ROOT / "Spacecore-Orbits-Instructions.mp4"
PUBLIC_VIDEO = ROOT.parent.parent / "public" / "videos" / "instructions.mp4"
W, H = 1920, 1080

FFMPEG = os.environ.get(
    "FFMPEG",
    shutil.which("ffmpeg")
    or r"C:\Users\gutte\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin\ffmpeg.exe",
)
FFPROBE = os.environ.get(
    "FFPROBE",
    shutil.which("ffprobe")
    or str(Path(FFMPEG).with_name("ffprobe.exe")),
)


def run(cmd: list[str], quiet: bool = False) -> None:
    kwargs = {"check": True}
    if quiet:
        kwargs["stdout"] = subprocess.PIPE
        kwargs["stderr"] = subprocess.PIPE
    subprocess.run(cmd, **kwargs)


def media_duration(path: Path) -> float:
    out = subprocess.check_output(
        [
            FFPROBE,
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        text=True,
    )
    try:
        return max(0.5, float(out.strip()))
    except ValueError:
        return 3.0


def audio_duration(path: Path) -> float:
    return max(1.8, media_duration(path))


def write_script() -> None:
    lines = [
        "# Spacecore Orbits — narration script",
        "",
        f"Voice: {VOICE} · rate {RATE} · live interactive capture + animated title cards",
        "",
    ]
    for beat in BEATS:
        lines.append(f"## {beat['id']}")
        if beat.get("video"):
            lines.append(f"Clip: `{beat['video']}`")
        if beat.get("illustration"):
            lines.append(f"Illustration: {beat['illustration']}")
        if beat.get("themes"):
            lines.append(
                "Themes: "
                + ", ".join(f"“{t['title']}”" for t in beat["themes"])
            )
        if beat.get("bullets"):
            lines.append("Bullets: " + ", ".join(f"“{b}”" for b in beat["bullets"]))
        if beat.get("marks"):
            lines.append(
                "Marked UI text: " + ", ".join(f"“{m}”" for m in beat["marks"])
            )
        lines.append("")
        lines.append(beat["narration"])
        lines.append("")
    (ROOT / "SCRIPT.md").write_text("\n".join(lines), encoding="utf-8")
    print("wrote SCRIPT.md")


async def _speak(beat: dict, mp3: Path) -> None:
    import edge_tts

    communicate = edge_tts.Communicate(beat["narration"], VOICE, rate=RATE)
    await communicate.save(str(mp3))


def render_narration() -> None:
    AUDIO.mkdir(parents=True, exist_ok=True)
    for beat in BEATS:
        mp3 = AUDIO / f"{beat['id']}.mp3"
        m4a = AUDIO / f"{beat['id']}.m4a"
        asyncio.run(_speak(beat, mp3))
        run(
            [FFMPEG, "-y", "-i", str(mp3), "-c:a", "aac", "-b:a", "192k", str(m4a)],
            quiet=True,
        )
        print("audio", beat["id"])


def render_illustrations() -> None:
    """Record animated HTML cards (wireframe hero + timed bullets) as video."""
    from playwright.sync_api import sync_playwright

    ILLUS.mkdir(parents=True, exist_ok=True)
    SLIDES.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for beat in BEATS:
            if beat["kind"] != "illustrate":
                continue
            audio = AUDIO / f"{beat['id']}.m4a"
            dur = audio_duration(audio) + 0.45
            kind = beat["illustration"]
            if kind == "hero":
                html = hero_html(dur)
            elif kind == "map":
                html = map_html(
                    dur,
                    themes=beat.get("themes"),
                    bullets=beat.get("bullets"),
                )
            elif kind == "loop":
                html = loop_html()
            else:
                raise ValueError(kind)

            html_path = ILLUS / f"{beat['id']}.html"
            html_path.write_text(html, encoding="utf-8")

            context = browser.new_context(
                viewport={"width": W, "height": H},
                device_scale_factor=1,
                record_video_dir=str(ILLUS),
                record_video_size={"width": W, "height": H},
            )
            page = context.new_page()
            page.goto(html_path.resolve().as_uri(), wait_until="load")
            page.wait_for_timeout(int(dur * 1000))
            video = page.video
            page.close()
            webm = Path(video.path()) if video else None
            context.close()
            if not webm or not webm.exists():
                cands = sorted(ILLUS.glob("*.webm"), key=lambda x: x.stat().st_mtime, reverse=True)
                webm = cands[0]
            out = ILLUS / f"{beat['id']}.mp4"
            run(
                [
                    FFMPEG,
                    "-y",
                    "-i",
                    str(webm),
                    "-t",
                    f"{dur:.3f}",
                    "-vf",
                    f"scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30",
                    "-c:v",
                    "libx264",
                    "-pix_fmt",
                    "yuv420p",
                    "-an",
                    "-movflags",
                    "+faststart",
                    str(out),
                ],
                quiet=True,
            )
            # Still fallback for debugging
            # (kept unused by assemble — assemble uses ILLUS mp4)
            print("illustration", beat["id"], f"{dur:.1f}s")
        browser.close()


def assemble_illustration_chapter(beat: dict, audio: Path, out: Path) -> float:
    src = ILLUS / f"{beat['id']}.mp4"
    if not src.exists():
        raise FileNotFoundError(src)
    adur = audio_duration(audio)
    vdur = media_duration(src)
    target = max(adur + 0.35, vdur)
    pad_v = max(0.0, target - vdur)
    vf = f"scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30"
    if pad_v > 0.05:
        vf += f",tpad=stop_mode=clone:stop_duration={pad_v:.3f}"
    run(
        [
            FFMPEG,
            "-y",
            "-i",
            str(src),
            "-i",
            str(audio),
            "-filter_complex",
            f"[0:v]{vf}[v];[1:a]apad[a]",
            "-map",
            "[v]",
            "-map",
            "[a]",
            "-t",
            f"{target:.3f}",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            str(out),
        ],
        quiet=True,
    )
    return target


def assemble_live_chapter(beat: dict, audio: Path, out: Path) -> float:
    """Mux live capture with delayed narration so speech lands on the action."""
    src = CLIPS / beat["video"]
    if not src.exists():
        raise FileNotFoundError(f"Missing live clip for {beat['id']}: {src}")
    vdur = media_duration(src)
    adur = audio_duration(audio)
    delay = float(beat.get("audio_delay") or 0.0)
    # Full interaction + room for delayed voice
    target = max(vdur, delay + adur + 0.35)
    pad_v = max(0.0, target - vdur)
    vf = (
        f"scale={W}:{H}:force_original_aspect_ratio=decrease,"
        f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30"
    )
    if pad_v > 0.05:
        vf += f",tpad=stop_mode=clone:stop_duration={pad_v:.3f}"
    delay_ms = int(delay * 1000)
    af = f"adelay={delay_ms}|{delay_ms},apad"
    run(
        [
            FFMPEG,
            "-y",
            "-i",
            str(src),
            "-i",
            str(audio),
            "-filter_complex",
            f"[0:v]{vf}[v];[1:a]{af}[a]",
            "-map",
            "[v]",
            "-map",
            "[a]",
            "-t",
            f"{target:.3f}",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            str(out),
        ],
        quiet=True,
    )
    return target


def assemble_video() -> None:
    BUILD.mkdir(parents=True, exist_ok=True)
    chapter_files: list[Path] = []
    total = 0.0

    for beat in BEATS:
        audio = AUDIO / f"{beat['id']}.m4a"
        clip = BUILD / f"clip-{beat['id']}.mp4"
        if beat["kind"] == "live":
            dur = assemble_live_chapter(beat, audio, clip)
        else:
            dur = assemble_illustration_chapter(beat, audio, clip)
        chapter_files.append(clip)
        total += dur
        print(f"clip {beat['id']} {dur:.1f}s ({beat['kind']})")

    concat_list = BUILD / "concat.txt"
    concat_list.write_text(
        "\n".join(f"file '{c.resolve().as_posix()}'" for c in chapter_files) + "\n",
        encoding="utf-8",
    )

    run(
        [
            FFMPEG,
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_list),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-af",
            "aresample=async=1:first_pts=0",
            "-movflags",
            "+faststart",
            str(OUT_VIDEO),
        ]
    )
    print(f"\nWrote {OUT_VIDEO} (~{round(total)}s)")

    PUBLIC_VIDEO.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(OUT_VIDEO, PUBLIC_VIDEO)
    print(f"Copied to {PUBLIC_VIDEO}")


def main() -> None:
    write_script()
    if os.environ.get("SKIP_NARRATION") == "1":
        print("skipping narration (reusing audio)")
    else:
        render_narration()
    render_illustrations()
    assemble_video()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("ERROR:", e, file=sys.stderr)
        sys.exit(1)
