"""Compose captured phone frames into a 1080x1920 video with captions.

Usage: python3 compose.py  (runs ffmpeg in Docker)
"""

import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "out"
INK, BG, MUTED = "0x1C2430", "0xE9ECEF", "0x5B6673"
W, H = 1080, 1920
PHONE_H = 1520
BEZEL = 14
FPS = 30


def main() -> None:
    frames = json.loads((OUT / "frames.json").read_text())
    data = json.loads((OUT / "captions.json").read_text())
    start = frames[0]["t"]
    duration = frames[-1]["t"] - start + 1.0

    # Variable frame rate input: each screenshot lasts until the next one
    lines = []
    for i, f in enumerate(frames):
        nxt = frames[i + 1]["t"] if i + 1 < len(frames) else f["t"] + 1.0
        lines += [f"file 'frames/{f['name']}'", f"duration {max(nxt - f['t'], 0.001):.3f}"]
    lines.append(f"file 'frames/{frames[-1]['name']}'")
    (OUT / "frames.txt").write_text("\n".join(lines) + "\n")

    caps = [{**c, "t": max(0.0, c["t"] - start)} for c in data["captions"]]
    text_dir = OUT / "captions"
    text_dir.mkdir(exist_ok=True)
    phone_w = round(780 * PHONE_H / 1688 / 2) * 2
    x = (W - phone_w - 2 * BEZEL) // 2
    filters = [
        f"[0:v]fps={FPS},scale={phone_w}:{PHONE_H}:flags=lanczos,"
        f"pad={phone_w + 2 * BEZEL}:{PHONE_H + 2 * BEZEL}:{BEZEL}:{BEZEL}:color={INK}[phone]",
        f"color=c={BG}:s={W}x{H}:d={duration:.2f}:r={FPS}[bg]",
        f"[bg][phone]overlay={x}:300:shortest=1[v0]",
    ]
    last = "v0"
    for i, c in enumerate(caps):
        begin = c["t"]
        end = caps[i + 1]["t"] if i + 1 < len(caps) else duration
        (text_dir / f"{i}_title.txt").write_text(c["title"])
        (text_dir / f"{i}_sub.txt").write_text(c["sub"])
        common = f"enable='between(t,{begin:.2f},{end:.2f})':alpha='min(1,(t-{begin:.2f})/0.35)':x=(w-text_w)/2"
        filters.append(
            f"[{last}]drawtext=fontfile=/work/fonts/FiraSansExtraCondensed-SemiBold.ttf:"
            f"textfile=/work/out/captions/{i}_title.txt:fontsize=76:fontcolor={INK}:y=92:{common}[t{i}]"
        )
        filters.append(
            f"[t{i}]drawtext=fontfile=/work/fonts/GolosText.ttf:"
            f"textfile=/work/out/captions/{i}_sub.txt:fontsize=38:fontcolor={MUTED}:y=196:{common}[s{i}]"
        )
        last = f"s{i}"
    (OUT / "filter.txt").write_text(";\n".join(filters))

    cmd = [
        "docker", "run", "--rm", "-v", f"{ROOT}:/work", "-w", "/work",
        "jrottenberg/ffmpeg:7.1-ubuntu2404", "-y", "-hide_banner", "-loglevel", "error",
        "-f", "concat", "-safe", "0", "-i", "/work/out/frames.txt",
        "-filter_complex_script", "/work/out/filter.txt",
        "-map", f"[{last}]", "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        "/work/out/magistral-400-mobile.mp4",
    ]
    subprocess.run(cmd, check=True)
    print("Saved", OUT / "magistral-400-mobile.mp4", f"({duration:.0f} s)")


if __name__ == "__main__":
    main()
