# Decision: GM SoundFont Selection

Date: 2026-10-01. Owner: Claude. Status: decided, file acquired.

## Options considered

| Name | License | Size | Quality | Gettable via direct URL | Notes |
|------|---------|------|---------|------------------------|-------|
| **FluidR3_GM.sf2** | MIT (Frank Wen) | ~148 MB | High, full GM set | No stable direct URL found | Popular MIT SoundFont; release asset URLs on GitHub were not directly resolvable in this session and SourceForge requires browser redirect. |
| **TimGM6mb.sf2** | GPL v2 (Tim Brechbill) | 5.7 MB | Compact GM | Yes, GitHub raw | Small, redistributable under GPL v2, sufficient for MVP accompaniment. |
| **GeneralUser-GS.sf2** | Custom permissive v2.0 | ~30 MB | GS/GM expanded | Official site only | Better quality than TimGM but requires manual download; license permits software redistribution but requests linking to official page. |

## Decision

Use **TimGM6mb.sf2** for the MVP build.

### Rationale
- Available from a stable direct raw URL on GitHub at acquisition time.
- Compact (5.7 MB), suitable for inclusion in the installer/package.
- GPL v2 is a known, OSI-approved license that permits redistribution when license text is included.
- Sufficient for verifying TinySoundFont rendering and native accompaniment in T13/T17 before committing to a higher-quality SoundFont.

## Acquisition details

- File: `resources/TimGM6mb.sf2`
- Source URL: https://github.com/deepin-community/timgm6mb-soundfont/raw/master/TimGM6mb.sf2
- License: GNU General Public License v2 (credits Tim Brechbill)
- SHA256: `c5378b62028c920cb11e4803327983fee2f2cdff5dc89c708e39da417e51c854`
- File size: 5,969,788 bytes (~5.7 MB)
- Verified: RIFF/SoundFont header (`RIFF....sfbk`) confirmed via `file`.

## Packaging

CMake post-build step copies `${CMAKE_CURRENT_SOURCE_DIR}/resources` to `$<TARGET_FILE_DIR:GuitarLearner>/resources` so the SoundFont is next to `GuitarLearner.exe` in Debug/Release builds.

## Future reconsideration

- If GPL v2 is incompatible with the project's final distribution model, replace with a permissively licensed SoundFont (e.g., FluidR3_GM under MIT or GeneralUser-GS v2.0).
- For production, evaluate GeneralUser-GS as a quality upgrade; ensure download and license text are included in packaging.
- Keep the SoundFile in `resources/` and document any swap as a decision update in this file.
