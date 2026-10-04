# Perfect Dawn Time (PDT)

A public, mobile-first, purely client-side website about **Perfect Dawn Time**: wherever a standard astronomical sunrise occurs, the clock reads **06:00** at that instant. The clock ticks in ordinary SI seconds between sunrises and performs its daily correction *at dawn*. A small, explicit virtual-dawn convention covers polar days when sunrise does not occur.

An idea by **Emlyn O’Regan** and an extension of his earlier **Continuous Local Time** (longitude-only, no time zones). **Dedicated to Wayne Radinsky.**

## Structure

- `source/` – authored HTML, CSS and vanilla ES modules: home clock, astronomy/maths, equation of time, annual adjustments, converter.
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

HTTPS is required for device geolocation. Visitors may also enter latitude and longitude. The chosen location is stored locally in the browser only. Map tiles are served by OpenStreetMap and name search by Nominatim only on request; the map/library and custom Google Fonts require an external connection. The mathematical clock, charts and manual coordinate converter require no external API.

### Definitions and limitations

The standard apparent-horizon approximation uses solar centre altitude −0.8333° (upper limb and average refraction). Solar coordinates and equation-of-time terms are approximate NOAA/Meeus equations; they are suitable for an educational demonstration, not a safety-critical or navigational time service. The coordinate system is latitude north/east longitude positive. Polar no-rise periods use the clipped hour-angle convention, explicitly labelled **virtual dawn**. Clock times can repeat/skip around resets; UTC remains authoritative for an instant. Conversion uses the shortest signed ±12h difference of clock readings, which is ambiguous at the seam; this is a clock comparison, not a globally orderable timeline.

Resources:
- NOAA equations: https://gml.noaa.gov/grad/solcalc/solareqns.PDF
- USNO sunrise definitions: https://aa.usno.navy.mil/faq/RST_defs

To publish, set `HOU_PROD_API_KEY` or `HOU_API_KEY` in a process environment or local `scripts/.env`. The publisher is scoped to its own House, Library folder and Site slug and does not remove old remote files. See `scripts/publish_hou_site.py --help`.

**Deployment:** House of Ur Sites, not GitHub Pages. Never commit credentials or build output.
