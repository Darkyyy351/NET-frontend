# Board catalog, first increment

Catalog schema revision 1 is bundled with the frontend and works offline, including
the MIT-licensed NodeMCU reference image. Source links are for manual verification;
NET does not execute or ingest arbitrary shop pages at runtime.

Initial profile: nodemcu-amica-esp12e-cp2102, matching the user's LaskaKit LA100044
product description. This is a reference, not an attestation of the physical PCB.
PlatformIO nodemcuv2 identifies a build target, not a unique board revision.
Reviewed 2026-09-09. Sources are recorded alongside the profile.

## Catalog priorities

- Seeed Studio, especially XIAO ESP families. Use Seeed Wiki and revision-specific
  schematics: https://wiki.seeedstudio.com/SeeedStudio_XIAO_Series_Introduction/
- Purchase aliases from laskakit.cz, dratek.cz and rpishop.cz.
- Do not claim support for unreviewed models or map all Seeed boards to one profile.
- Manufacturer schematics and chip documentation establish electrical limits;
  shop listings supply product aliases and purchase links.

## Next increments

1. Firmware reports explicit boardId and capabilities; existing clients remain
   unknown until manually assigned. Never infer a PCB from an IP, USB bridge or name.
2. Backend owns versioned profiles and validates assignments. Unknown IDs fail closed.
3. Configuration includes profile revision, purpose and pin assignments. It must
   reject reserved pins, overlapping peripheral assignments and Identify conflicts.
4. ESP acknowledges an applied configuration revision; saved is not applied.
5. Later catalog updates are schema-validated, reviewed and independently versioned.
   Keep a last-known-good offline catalog and asset provenance/license records.

Current UI is a reference-image pin inspector: board assignment and device purpose
are persisted, but no GPIO configuration is saved and no hardware commands are emitted.
The photo has 30 individually focusable/clickable physical contacts. Shared GND,
3V3 and reserved contacts resolve to shared policy descriptions but retain separate
selection IDs. Hover/focus previews do not change the persistent clicked selection.
Coordinates use the LaskaKit 615 x 519 reference cropped and rotated by CSS.
Zoom scrolls within the photo viewport without moving hotspots relative to the image.
Current asset provenance is in public/boards/LASKAKIT-PINOUT-SOURCE.md.
Three third-party reference images are included at the user's request for the
private prototype. Permission has not been obtained and these assets are not
covered by the project's license. Keep the repository private; resolve permission
or replace the images before any public release. The active image is
public/boards/nodemcu-laskakit-pinout.png. Do not substitute another image without
recalibrating hotspot coordinates. Private visibility does not grant a license.
Power budgets and A0 header voltage limits remain unverified for the physical unit.
Historical reference-image capability labels are not firmware guarantees; the
structured profile contains the deliberately restricted initial NET policy.
