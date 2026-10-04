# Perfect Dawn Time (PDT)

A public, mobile-first, purely client-side website about **Perfect Dawn Time**: wherever a standard astronomical sunrise occurs, the clock reads **06:00** at that instant. The clock ticks in ordinary SI seconds between sunrises and performs its daily correction *at dawn*. A small, explicit virtual-dawn convention covers polar days when sunrise does not occur.

An idea by **Emlyn O’Regan** and an extension of his earlier **Continuous Local Time** (longitude-only, no time zones). **Dedicated to Wayne Radinsky.**

## Structure

- `source/` – authored HTML, CSS and vanilla ES modules: home clock (including a mobile clock-only mode), astronomy/maths, equation of time, annual adjustments, converter.
- `site/` – generated static output, not committed.
- `scripts/build.mjs` – copies source into site; no transpiler or framework.
- `scripts/publish_hou_site.py` – publishes to House of Ur Sites.
- `tests/astro.test.js` – deterministic astronomical behaviour checks.
- Planning and deployment notes: sibling `../docs/projects/perfect-dawn-time/`.

```powershell
npm test
npm run build
python -m http.server 8080 --directory site
# open http://localhost:8080/
```

HTTPS is required for device geolocation. Visitors may also enter latitude and longitude. The chosen precise location is stored locally in the browser only; for a friendly nearby place name, the browser optionally sends coordinates rounded to two decimal places (roughly 1 km) to OpenStreetMap Nominatim's reverse-geocoding endpoint. Lookups happen on location selection, not per clock tick. Successful place names are cached in localStorage for 30 days and reused across visits. A failed or unavailable lookup leaves a coordinate label. OpenStreetMap also supplies map tiles and user-requested name search; the map/library and custom Google Fonts require an external connection. The mathematical clock, charts and manual coordinate converter require no external API.

### Definitions and limitations

The standard apparent-horizon approximation uses solar centre altitude −0.8333° (upper limb and average refraction). Solar coordinates and equation-of-time terms are approximate NOAA/Meeus equations; they are suitable for an educational demonstration, not a safety-critical or navigational time service. The coordinate system is latitude north/east longitude positive. Polar no-rise periods use the clipped hour-angle convention, explicitly labelled **virtual dawn**. Clock times can repeat/skip around resets; UTC remains authoritative for an instant. Conversion uses the shortest signed ±12h difference of clock readings, which is ambiguous at the seam; this is a clock comparison, not a globally orderable timeline.

### Sharing on social platforms

Each public page has its own static Open Graph and Twitter/X large-image card, canonical URL, description and accessible image description. All images are self-hosted, absolute HTTPS URLs: social crawlers do not need JavaScript, geolocation or the map provider. Five 1200 × 630 PNG share images live in `source/social/`, and the app has SVG, PNG and Apple touch icons.

To regenerate the art and icons, install Pillow (`python -m pip install pillow`) and run `python scripts/generate_social_cards.py`. Commit the generated assets: the static build copies `source/` verbatim. `npm test` includes checks of the metadata, image formats, dimensions and URLs. Social services can cache older previews; after republishing, refresh their link previews or wait for their caches to expire.

Resources:
- NOAA equations: https://gml.noaa.gov/grad/solcalc/solareqns.PDF
- USNO sunrise definitions: https://aa.usno.navy.mil/faq/RST_defs

To publish, set `HOU_PROD_API_KEY` or `HOU_API_KEY` in a process environment or local `scripts/.env`. The publisher is scoped to its own House, Library folder and Site slug and does not remove old remote files. See `scripts/publish_hou_site.py --help`.

**Deployment:** publishing to House of Ur Sites is a separate step; committing or pushing this repository does not update the hosted site automatically. The configured site lives in the Bronze Arch House under `/sites/pdt/`, at `https://pdt-bronzearch.house-of-ur.com/` once deployed. Never commit credentials or build output.
