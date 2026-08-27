#!/usr/bin/env python3
"""Generate the 12 Snoo-style preset profile avatars for bcrm.

Why a generator and not 12 hand-written files: the twelve characters share one
skeleton (antenna, side ears, oval head, shirt dome) and differ only in palette,
expression and accessory. Keeping the skeleton in one place is what stops them
drifting out of alignment, and it makes "add a 13th" a one-line change.

Two constraints drove the drawing:

* The picker renders these at 40px, so every feature is a bold filled shape.
  Thin outlines were the first thing tried and they vanish at that size, which is
  why the eyes are solid dark ovals with a highlight rather than Snoo's classic
  white-with-black-outline eyes.
* Background hues are deliberately the same twelve the old flat silhouettes used.
  Someone whose saved avatar was the green one still gets a green one, so nobody's
  profile picture appears to change colour behind their back.

Output is plain SVG using only circle/ellipse/path/rect/line with presentation
attributes -- no <g>, no transforms, no CSS -- so it renders identically in
browsers and in ImageMagick's rasterizer used to eyeball the result.
"""

from __future__ import annotations

import argparse
from pathlib import Path

SNOO = "#F8FAFC"  # the body white; slate-50 rather than pure white so it reads soft
INK = "#1F2937"  # eyes, mouth, dark accessories
HILITE = "#FFFFFF"

# (background, shirt, antenna, expression, accessory)
# Backgrounds are the twelve hues the previous silhouettes used, in the same slot
# order, so an existing saved pick keeps its colour identity.
SPECS = [
    ("#0F766E", "#F59E0B", "#FDE68A", "smile", None),
    ("#1D4ED8", "#F97316", "#FDBA74", "smile", "glasses"),
    ("#B45309", "#0EA5E9", "#FDE68A", "grin", "cap"),
    ("#BE123C", "#FBBF24", "#FCA5A5", "happy", "bowtie"),
    ("#047857", "#38BDF8", "#A7F3D0", "smile", "headphones"),
    ("#6D28D9", "#F472B6", "#DDD6FE", "wink", "tuft"),
    ("#0E7490", "#FACC15", "#A5F3FC", "calm", "shades"),
    ("#C2410C", "#22D3EE", "#FED7AA", "tongue", "freckles"),
    ("#334155", "#EF4444", "#CBD5E1", "smile", "scarf"),
    ("#A16207", "#6366F1", "#FEF08A", "surprised", "headband"),
    ("#155E75", "#34D399", "#67E8F9", "smile", "earring"),
    ("#9F1239", "#A78BFA", "#FDA4AF", "grin", "flower"),
]

# Must stay identical to PROFILE_AVATAR_NAMES in bcrm/src/lib/avatars.ts. The name
# lands in the SVG's own aria-label as well as the picker's, so a mismatch means a
# screen reader can announce two different names for one avatar.
NAMES = [
    "Teal, plain",
    "Blue, glasses",
    "Amber, cap",
    "Rose, bow tie",
    "Green, headphones",
    "Violet, hair tuft",
    "Cyan, sunglasses",
    "Orange, freckles",
    "Slate, scarf",
    "Gold, headband",
    "Deep sea, earring",
    "Crimson, flower",
]

# --- skeleton geometry -------------------------------------------------------
HEAD_CX, HEAD_CY, HEAD_RX, HEAD_RY = 64, 55, 27, 24
EAR_L_CX, EAR_R_CX, EAR_CY, EAR_R = 36, 92, 56, 7.5
EYE_L_CX, EYE_R_CX, EYE_CY = 53.5, 74.5, 53
EYE_RX, EYE_RY = 9.0, 10.0


def eyes_open(size: str = "normal") -> list[str]:
    """Solid dark ovals with an offset highlight. Legible down to ~24px.

    `size="small"` exists for the spectacles variant: at full size the eye fills the
    lens exactly, so the rim disappears and the result reads as goggles.
    """
    rx, ry = {
        "normal": (EYE_RX, EYE_RY),
        "big": (EYE_RX + 0.8, EYE_RY + 0.8),
        "small": (6.4, 7.2),
    }[size]
    hi = 2.9 if size != "small" else 2.2
    out: list[str] = []
    for cx in (EYE_L_CX, EYE_R_CX):
        out.append(
            f'<ellipse cx="{cx}" cy="{EYE_CY}" rx="{rx}" ry="{ry}" fill="{INK}"/>'
        )
        out.append(
            f'<circle cx="{cx - rx * 0.29}" cy="{EYE_CY - ry * 0.34}" r="{hi}" '
            f'fill="{HILITE}"/>'
        )
    return out


def eye_closed(cx: float) -> str:
    """A downward arc -- a happily shut eye."""
    return (
        f'<path d="M{cx - 8} {EYE_CY + 1} Q{cx} {EYE_CY - 7} {cx + 8} {EYE_CY + 1}" '
        f'fill="none" stroke="{INK}" stroke-width="4" stroke-linecap="round"/>'
    )


def face(expression: str, eyes: str = "normal") -> list[str]:
    parts: list[str] = []
    if eyes == "none":
        pass  # shades cover the eye area entirely; eyes would leave a dark sliver
    elif expression == "happy":
        parts += [eye_closed(EYE_L_CX), eye_closed(EYE_R_CX)]
    elif expression == "wink":
        parts += eyes_open(eyes)[:2]  # left eye + its highlight
        parts.append(eye_closed(EYE_R_CX))
    elif expression == "surprised":
        parts += eyes_open("big")
    else:
        parts += eyes_open(eyes)

    if expression == "smile":
        parts.append(
            f'<path d="M55 68 Q64 75.5 73 68" fill="none" stroke="{INK}" '
            f'stroke-width="3.6" stroke-linecap="round"/>'
        )
    elif expression == "grin":
        # A filled mouth reads as an open laugh where a stroke would just look thick.
        parts.append(f'<path d="M53 67 Q64 79 75 67 Z" fill="{INK}"/>')
    elif expression == "happy":
        parts.append(
            f'<path d="M54 67 Q64 76.5 74 67" fill="none" stroke="{INK}" '
            f'stroke-width="3.6" stroke-linecap="round"/>'
        )
    elif expression == "calm":
        parts.append(
            f'<path d="M57 70 L71 70" fill="none" stroke="{INK}" '
            f'stroke-width="3.4" stroke-linecap="round"/>'
        )
    elif expression == "surprised":
        parts.append(f'<circle cx="64" cy="70" r="4.6" fill="{INK}"/>')
    elif expression == "tongue":
        parts.append(
            f'<path d="M55 67 Q64 75 73 67" fill="none" stroke="{INK}" '
            f'stroke-width="3.6" stroke-linecap="round"/>'
        )
        parts.append(f'<path d="M61 72 Q64 79 67 72 Z" fill="#FB7185"/>')
    elif expression == "wink":
        parts.append(
            f'<path d="M55 68 Q64 76 73 67" fill="none" stroke="{INK}" '
            f'stroke-width="3.6" stroke-linecap="round"/>'
        )
    return parts


def accessory(kind: str | None, shirt: str, antenna: str) -> list[str]:
    if kind is None:
        return []
    if kind == "glasses":
        # Lenses sit well clear of the (deliberately shrunk) eyes so white face shows
        # inside the rim. Round lenses at eye size read as binoculars; lenses the same
        # height as the eye read as a solid dark mask. Both were tried.
        return [
            f'<rect x="41" y="42" width="23" height="22" rx="6" fill="none" '
            f'stroke="{INK}" stroke-width="3"/>',
            f'<rect x="65" y="42" width="23" height="22" rx="6" fill="none" '
            f'stroke="{INK}" stroke-width="3"/>',
            f'<path d="M64 52 L65 52" stroke="{INK}" stroke-width="3"/>',
            f'<path d="M41 50 L34 52" stroke="{INK}" stroke-width="3" '
            f'stroke-linecap="round"/>',
            f'<path d="M88 50 L95 52" stroke="{INK}" stroke-width="3" '
            f'stroke-linecap="round"/>',
        ]
    if kind == "shades":
        # Two lenses with a bridge. A single wide bar read as a VR visor.
        return [
            f'<rect x="41" y="45" width="21" height="15" rx="7" fill="{INK}"/>',
            f'<rect x="66" y="45" width="21" height="15" rx="7" fill="{INK}"/>',
            f'<path d="M62 50 L66 50" stroke="{INK}" stroke-width="3.4"/>',
            f'<path d="M41 48 L34 51" stroke="{INK}" stroke-width="3.4" '
            f'stroke-linecap="round"/>',
            f'<path d="M87 48 L94 51" stroke="{INK}" stroke-width="3.4" '
            f'stroke-linecap="round"/>',
            f'<path d="M45 49 L51 49" stroke="{HILITE}" stroke-width="2.2" '
            f'stroke-linecap="round" opacity="0.5"/>',
        ]
    if kind == "cap":
        return [
            f'<path d="M37 44 A27 27 0 0 1 91 44 Z" fill="{INK}"/>',
            f'<path d="M88 44 H108 Q108 52 88 52 Z" fill="{INK}"/>',
        ]
    if kind == "headband":
        # Sits in the forehead strip above the eyes (head top y=31, eyes start y~42).
        # Uses the shirt colour: a white band on a white head is invisible.
        return [
            f'<path d="M40 33 H88 V42 H40 Z" fill="{shirt}"/>',
            f'<path d="M40 37 H88" stroke="{INK}" stroke-width="1.6" opacity="0.18"/>',
        ]
    if kind == "headphones":
        return [
            f'<path d="M34 54 A30 30 0 0 1 94 54" fill="none" stroke="{INK}" '
            f'stroke-width="5" stroke-linecap="round"/>',
            f'<rect x="27" y="50" width="13" height="20" rx="6.5" fill="{INK}"/>',
            f'<rect x="88" y="50" width="13" height="20" rx="6.5" fill="{INK}"/>',
        ]
    if kind == "tuft":
        # Two tall swoops either side of the antenna. The first attempt sat low and
        # small against the head and simply did not register at picker size.
        return [
            f'<path d="M53 33 Q42 15 60 26 Z" fill="{antenna}"/>',
            f'<path d="M75 33 Q86 15 68 26 Z" fill="{antenna}"/>',
        ]
    if kind == "bowtie":
        return [
            f'<path d="M64 84 L51 77 L51 91 Z" fill="{INK}"/>',
            f'<path d="M64 84 L77 77 L77 91 Z" fill="{INK}"/>',
            f'<circle cx="64" cy="84" r="3.8" fill="{INK}"/>',
        ]
    if kind == "scarf":
        return [
            f'<path d="M47 83 Q64 96 81 83 L81 94 Q64 106 47 94 Z" fill="#FBBF24"/>',
        ]
    if kind == "freckles":
        return [
            f'<circle cx="42" cy="64" r="2.1" fill="{INK}" opacity="0.35"/>',
            f'<circle cx="47" cy="68" r="2.1" fill="{INK}" opacity="0.35"/>',
            f'<circle cx="86" cy="64" r="2.1" fill="{INK}" opacity="0.35"/>',
            f'<circle cx="81" cy="68" r="2.1" fill="{INK}" opacity="0.35"/>',
        ]
    if kind == "earring":
        return [
            f'<circle cx="93" cy="67" r="5" fill="none" stroke="#FDE047" '
            f'stroke-width="3"/>'
        ]
    if kind == "flower":
        petals = "".join(
            f'<circle cx="{41 + dx}" cy="{41 + dy}" r="4.2" fill="#FDE047"/>'
            for dx, dy in ((0, -4.6), (4.6, 0), (0, 4.6), (-4.6, 0))
        )
        return [petals, f'<circle cx="41" cy="41" r="3" fill="#F97316"/>']
    raise ValueError(f"unknown accessory {kind!r}")


def build(index: int) -> str:
    bg, shirt, antenna, expression, extra = SPECS[index]
    name = NAMES[index]

    parts = [
        f'<circle cx="64" cy="64" r="64" fill="{bg}"/>',
        # shirt dome, then neck, then ears -- all behind the head
        f'<path d="M27 128 C27 103 43 87 64 87 C85 87 101 103 101 128 Z" fill="{shirt}"/>',
        f'<rect x="56" y="70" width="16" height="21" rx="7" fill="{SNOO}"/>',
        f'<circle cx="{EAR_L_CX}" cy="{EAR_CY}" r="{EAR_R}" fill="{SNOO}"/>',
        f'<circle cx="{EAR_R_CX}" cy="{EAR_CY}" r="{EAR_R}" fill="{SNOO}"/>',
        f'<ellipse cx="{HEAD_CX}" cy="{HEAD_CY}" rx="{HEAD_RX}" ry="{HEAD_RY}" fill="{SNOO}"/>',
    ]
    EYE_MODE = {"glasses": "small", "shades": "none"}
    parts += face(expression, eyes=EYE_MODE.get(extra or "", "normal"))
    parts += accessory(extra, shirt, antenna)
    # Antenna last so it reads as poking through a cap or headband.
    parts += [
        f'<path d="M64 32 L64 14" stroke="{antenna}" stroke-width="5" stroke-linecap="round"/>',
        f'<circle cx="64" cy="11" r="7" fill="{antenna}"/>',
    ]

    body = "\n  ".join(parts)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" '
        f'viewBox="0 0 128 128" role="img" aria-label="{name} avatar">\n  '
        f"{body}\n</svg>\n"
    )


# Regenerate in place (the twelve filenames are the values stored in `users.avatar`
# and are pinned by ALLOWED_AVATARS in bcrm-backend/app/modules/users/service.py, so
# never rename them):
#
#     python3 scripts/gen_avatars.py public/images/avatars
#
# Keep NAMES in step with PROFILE_AVATAR_NAMES in src/lib/avatars.ts.


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("outdir", type=Path)
    args = ap.parse_args()
    args.outdir.mkdir(parents=True, exist_ok=True)
    for i in range(len(SPECS)):
        path = args.outdir / f"avatar-{i + 1:02d}.svg"
        path.write_text(build(i), encoding="utf-8")
    print(f"wrote {len(SPECS)} avatars to {args.outdir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
