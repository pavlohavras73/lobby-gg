#!/usr/bin/env python3
"""Build a worldwide, quality-filtered 360-degree panorama pool for Geo$take.

Primary source: Mapillary vector tiles (mly1_public/2/{z}/{x}/{y}) + Graph API.
Secondary source: Panoramax STAC API.
Offline country geocoding: reverse_geocoder (ISO-3166 alpha-2).
Google Street View is intentionally never called here.

Run locally with:
  uv run --with fastapi==0.141.1 --with pillow --with numpy --with mapbox-vector-tile --with reverse_geocoder \
    python tools/build_geo_pool.py --target 3500 --out geo_pool.json
"""

from __future__ import annotations

import argparse
import concurrent.futures
import csv
import io
import json
import math
import os
import random
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from unittest.mock import patch

import mapbox_vector_tile
import numpy as np
import reverse_geocoder as rg
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent


def _get_mapillary_token() -> str:
    try:
        import fastapi.staticfiles

        orig_init = fastapi.staticfiles.StaticFiles.__init__
        with patch.object(
            fastapi.staticfiles.StaticFiles,
            "__init__",
            lambda self, *a, **kw: orig_init(self, *a, **{**kw, "check_dir": False}),
        ):
            sys.path.insert(0, str(ROOT))
            import geostake

        tok = geostake.mapillary_token()
        if tok:
            return tok
    except Exception:
        pass
    tok = os.environ.get("MAPILLARY_TOKEN", "").strip()
    if tok:
        return tok
    for p in ("/data/mapillary_token", str(Path.home() / ".mapillary_token")):
        try:
            v = Path(p).read_text(encoding="utf-8").strip()
            if v:
                return v
        except OSError:
            continue
    return ""


def _iso2(cc: str) -> str:
    c = (cc or "").strip().upper()
    return {"UK": "GB", "XK": "RS"}.get(c, c)


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2.0 * r * math.asin(min(1.0, math.sqrt(a)))


def latlon_to_tile(lat: float, lon: float, z: int) -> tuple[int, int]:
    lat = max(-85.0, min(85.0, lat))
    lat_r = math.radians(lat)
    n = 2**z
    x = int((lon + 180.0) / 360.0 * n) % n
    y = int((1.0 - math.asinh(math.tan(lat_r)) / math.pi) / 2.0 * n)
    y = max(0, min(n - 1, y))
    return x, y


def tile_xy_to_latlon(x: int, y: int, z: int, tx: float, ty: float, extent: float = 4096.0) -> tuple[float, float]:
    """Convert Mapbox Vector Tile coordinates (Y-up in mapbox_vector_tile) to WGS84 (lat, lng)."""
    n = 2**z
    fx = (x + tx / extent) / n
    # mapbox_vector_tile returns y in [0..extent] with y=0 at bottom by default
    fy = (y + (extent - ty) / extent) / n
    lng = fx * 360.0 - 180.0
    lat = math.degrees(math.atan(math.sinh(math.pi * (1.0 - 2.0 * fy))))
    return lat, lng


def cell_50km(lat: float, lng: float) -> tuple[int, int]:
    lat_step = 0.45  # ~50 km
    cos_lat = max(0.2, math.cos(math.radians(lat)))
    lng_step = 0.45 / cos_lat
    return int(math.floor(lat / lat_step)), int(math.floor(lng / lng_step))


def cell_2km(lat: float, lng: float) -> tuple[int, int]:
    lat_step = 0.018
    cos_lat = max(0.2, math.cos(math.radians(lat)))
    lng_step = 0.018 / cos_lat
    return int(math.floor(lat / lat_step)), int(math.floor(lng / lng_step))


def _horizon_upright(rot: Any) -> bool:
    """Check if Mapillary computed_rotation (axis-angle) keeps world vertical near camera Y axis."""
    if not isinstance(rot, (list, tuple)) or len(rot) != 3:
        return True
    try:
        rx, ry, rz = float(rot[0]), float(rot[1]), float(rot[2])
    except (TypeError, ValueError):
        return True
    theta = math.sqrt(rx * rx + ry * ry + rz * rz)
    if theta < 1e-8:
        return True
    kx, ky, kz = rx / theta, ry / theta, rz / theta
    c = math.cos(theta)
    s = math.sin(theta)
    v = 1.0 - c
    # Third column of Rodrigues matrix = R @ [0, 0, 1]
    col2_x = kx * kz * v + ky * s
    col2_y = ky * kz * v - kx * s
    col2_z = c + kz * kz * v
    # In OpenSFM equirectangular camera coords, camera vertical is Y (or Z for some rigs);
    # upright horizon means world Z projects mainly onto camera Y (or Z) with small tilt
    up_align = max(abs(col2_y), abs(col2_z))
    return up_align >= 0.90 and abs(col2_x) <= 0.40


def _check_preview_quality(img_bytes: bytes) -> tuple[bool, str]:
    try:
        im = Image.open(io.BytesIO(img_bytes)).convert("L")
    except Exception:
        return False, "decode"
    w, h = im.size
    if w < 64 or h < 32:
        return False, "tiny"
    arr = np.asarray(im, dtype=np.float32)
    luma = float(arr.mean())
    if luma < 45.0:
        return False, "dark"
    if luma > 238.0:
        return False, "overexposed"
    std = float(arr.std())
    if std < 22.0:
        return False, "flat"
    top_luma = float(arr[: h // 3].mean())
    bot_luma = float(arr[(2 * h) // 3 :].mean())
    if top_luma < 32.0 and bot_luma < 32.0:
        return False, "tunnel_indoor"
    lap = arr[1:-1, 1:-1] * -4.0 + arr[:-2, 1:-1] + arr[2:, 1:-1] + arr[1:-1, :-2] + arr[1:-1, 2:]
    lap_var = float(lap.var())
    if lap_var < 150.0:
        return False, "blurry"
    return True, "ok"


def _http_get(url: str, headers: dict[str, str] | None = None, timeout: int = 12, retries: int = 2) -> bytes | None:
    hdrs = {"User-Agent": "LobbyGG-GeoPoolBuilder/2.0"}
    if headers:
        hdrs.update(headers)
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers=hdrs)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries:
                time.sleep(1.5 * (attempt + 1))
                continue
            return None
        except Exception:
            if attempt < retries:
                time.sleep(0.5)
                continue
            return None
    return None


def _land_tiles_from_rg(z: int = 6) -> tuple[list[tuple[int, int]], dict[tuple[int, int], set[str]]]:
    """Use reverse_geocoder's built-in worldwide settlements dataset to find all inhabited land tiles."""
    rg_file = Path(rg.__file__).resolve().parent / "rg_cities1000.csv"
    tiles: set[tuple[int, int]] = set()
    tile_countries: dict[tuple[int, int], set[str]] = defaultdict(set)
    with rg_file.open("r", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            try:
                lat = float(row["lat"])
                lng = float(row["lon"])
                cc = _iso2(row["cc"])
            except Exception:
                continue
            if lat < -58.0 or lat > 72.0:
                continue
            t = latlon_to_tile(lat, lng, z)
            tiles.add(t)
            if cc:
                tile_countries[t].add(cc)
    # Prioritize tiles covering underrepresented / diverse countries first
    country_tile_freq = Counter(cc for ccs in tile_countries.values() for cc in ccs)
    ordered = sorted(
        tiles,
        key=lambda t: (
            min((country_tile_freq[c] for c in tile_countries[t]), default=9999),
            random.random(),
        ),
    )
    return ordered, tile_countries


def _extract_tile_candidates(tile_xy: tuple[int, int], z: int, tok: str, min_ts_ms: int) -> list[dict[str, Any]]:
    x, y = tile_xy
    url = f"https://tiles.mapillary.com/maps/vtp/mly1_public/2/{z}/{x}/{y}?access_token={tok}"
    raw = _http_get(url, timeout=12, retries=2)
    if not raw:
        return []
    try:
        tile = mapbox_vector_tile.decode(raw)
    except Exception:
        return []
    seq_layer = tile.get("sequence") or {}
    feats = seq_layer.get("features") or []
    out = []
    for feat in feats:
        props = feat.get("properties") or {}
        if not props.get("is_pano"):
            continue
        cap = int(props.get("captured_at") or 0)
        if cap < min_ts_ms:
            continue
        qs = props.get("quality_score")
        if qs is not None and float(qs) < 0.45:
            continue
        img_id = props.get("image_id")
        seq_id = str(props.get("id") or "")
        if not img_id or not seq_id:
            continue
        geom = feat.get("geometry") or {}
        coords = geom.get("coordinates") or []
        if geom.get("type") == "MultiLineString" and coords:
            coords = coords[0]
        if not coords or not isinstance(coords[0], (list, tuple)):
            continue
        pt = coords[len(coords) // 2]
        lat, lng = tile_xy_to_latlon(x, y, z, float(pt[0]), float(pt[1]))
        if not (-60.0 <= lat <= 75.0 and -180.0 <= lng <= 180.0):
            continue
        out.append(
            {
                "id": str(img_id),
                "sequence": seq_id,
                "lat": lat,
                "lng": lng,
                "captured_ms": cap,
                "foot": bool(props.get("foot")),
                "qs": float(qs) if qs is not None else 0.7,
            }
        )
    return out


def _verify_mapillary_candidate(cand: dict[str, Any], tok: str) -> dict[str, Any] | None:
    lid = cand["id"]
    api = (
        f"https://graph.mapillary.com/{urllib.parse.quote(lid)}"
        "?fields=id,computed_geometry,geometry,camera_type,width,height,captured_at,"
        "sequence,compass_angle,computed_compass_angle,computed_rotation,quality_score,thumb_256_url,creator"
    )
    raw = _http_get(api, headers={"Authorization": f"OAuth {tok}"}, timeout=12, retries=2)
    if not raw:
        return None
    try:
        gd = json.loads(raw.decode("utf-8"))
    except Exception:
        return None

    cam = str(gd.get("camera_type") or "").lower()
    if cam not in ("spherical", "equirectangular"):
        return None
    w = int(gd.get("width") or 0)
    h = int(gd.get("height") or 0)
    if w < 4096 or h < 2048:
        return None
    ratio = w / max(1, h)
    if not (1.90 <= ratio <= 2.10):
        return None
    qs = gd.get("quality_score")
    if qs is not None and float(qs) < 0.45:
        return None
    if not _horizon_upright(gd.get("computed_rotation")):
        return None

    cap_ms = int(gd.get("captured_at") or cand.get("captured_ms") or 0)
    if cap_ms < 1451606400000:  # 2016-01-01
        return None
    cap_iso = datetime.fromtimestamp(cap_ms / 1000.0, tz=timezone.utc).strftime("%Y-%m-%d")

    turl = gd.get("thumb_256_url") or ""
    if not turl:
        return None
    img_b = _http_get(turl, timeout=12, retries=1)
    if not img_b:
        return None
    ok, _reason = _check_preview_quality(img_b)
    if not ok:
        return None

    geom = gd.get("computed_geometry") or gd.get("geometry") or {}
    coords = geom.get("coordinates") or [cand["lng"], cand["lat"]]
    lng = round(float(coords[0]), 5)
    lat = round(float(coords[1]), 5)
    heading = round(float(gd.get("computed_compass_angle") or gd.get("compass_angle") or 0.0), 1)
    creator = (gd.get("creator") or {}).get("username") or "Mapillary"

    return {
        "id": str(gd.get("id") or lid),
        "source": "mapillary",
        "lat": lat,
        "lng": lng,
        "country": cand["country"],
        "heading": heading,
        "author": str(creator)[:40],
        "license": "CC-BY-SA-4.0",
        "captured_at": cap_iso,
        "sequence": str(gd.get("sequence") or cand["sequence"]),
        "_is_urban": cand.get("is_urban", False),
    }


def _fetch_panoramax_extras(seen_seq: set[str], seen_ids: set[str], limit_total: int = 200) -> list[dict[str, Any]]:
    """Supplemental rural/highway 360 points from Panoramax."""
    # Diverse non-capital highway/rural bboxes
    rural_boxes = [
        (-2.5, 46.5, -1.8, 47.0),    # Western France countryside
        (5.5, 44.0, 6.2, 44.5),      # Provence rural
        (10.2, 51.4, 10.9, 51.9),    # Central Germany
        (-4.5, 56.2, -3.8, 56.7),    # Scottish Highlands
        (15.2, 62.2, 16.0, 62.7),    # Central Sweden
        (-71.2, -39.5, -70.5, -39.0),# Andes / Chile
        (-65.5, -32.2, -64.8, -31.7),# Cordoba rural Argentina
        (120.8, 23.8, 121.3, 24.3),  # Central Taiwan
    ]
    raw_items = []
    for min_lon, min_lat, max_lon, max_lat in rural_boxes:
        url = (
            f"https://api.panoramax.xyz/api/search?"
            f"bbox={min_lon:.3f},{min_lat:.3f},{max_lon:.3f},{max_lat:.3f}"
            "&filter=field_of_view%3D360&limit=40"
        )
        raw = _http_get(url, timeout=10, retries=1)
        if not raw:
            continue
        try:
            feats = json.loads(raw.decode("utf-8")).get("features", [])
        except Exception:
            continue
        for feat in feats:
            fid = str(feat.get("id") or "")
            if not fid or fid in seen_ids:
                continue
            props = feat.get("properties") or {}
            seq = str(props.get("collection") or (feat.get("collection") or fid))
            if seq in seen_seq:
                continue
            dt = str(props.get("datetime") or "")[:10]
            if dt and dt[:4].isdigit() and int(dt[:4]) < 2016:
                continue
            coords = (feat.get("geometry") or {}).get("coordinates") or []
            if len(coords) < 2:
                continue
            assets = feat.get("assets") or {}
            sd = (assets.get("sd") or {}).get("href")
            thumb = (assets.get("thumb") or {}).get("href") or sd
            if not sd:
                continue
            raw_items.append(
                {
                    "id": fid,
                    "source": "panoramax",
                    "lat": round(float(coords[1]), 5),
                    "lng": round(float(coords[0]), 5),
                    "heading": round(float(props.get("view:azimuth") or 0.0), 1),
                    "img_url": sd,
                    "thumb_url": thumb,
                    "author": str((props.get("providers") or [{}])[0].get("name") or "Panoramax")[:40],
                    "license": str(props.get("license") or "CC-BY-SA-4.0"),
                    "captured_at": dt,
                    "sequence": seq,
                }
            )
    if not raw_items:
        return []
    locs = rg.search([(it["lat"], it["lng"]) for it in raw_items], mode=1, verbose=False)
    out = []
    for it, loc in zip(raw_items, locs):
        it["country"] = _iso2(loc.get("cc", ""))
        if not it["country"] or it["sequence"] in seen_seq:
            continue
        tb = _http_get(it.pop("thumb_url"), timeout=8, retries=1)
        if not tb or not _check_preview_quality(tb)[0]:
            continue
        seen_seq.add(it["sequence"])
        seen_ids.add(it["id"])
        out.append(it)
        if len(out) >= limit_total:
            break
    return out


def build_world_pool(target: int, max_tiles: int, workers: int, min_per_country: int) -> list[dict[str, Any]]:
    tok = _get_mapillary_token()
    if not tok:
        raise SystemExit("ERROR: Mapillary token not found (checked env, /data/mapillary_token, ~/.mapillary_token)")

    random.seed(42)
    min_ts_ms = int(datetime(2016, 1, 1, tzinfo=timezone.utc).timestamp() * 1000)

    print("1/4 Discovering inhabited z=6 land tiles...", flush=True)
    tiles_z6, _tile_cc = _land_tiles_from_rg(z=6)
    if max_tiles > 0:
        tiles_z6 = tiles_z6[:max_tiles]
    print(f"    Scanning {len(tiles_z6)} z=6 tiles with {workers} workers...", flush=True)

    raw_by_seq: dict[str, dict[str, Any]] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(_extract_tile_candidates, t, 6, tok, min_ts_ms): t for t in tiles_z6}
        done = 0
        for fut in concurrent.futures.as_completed(futs):
            done += 1
            for c in fut.result():
                seq = c["sequence"]
                # Prefer non-foot (road/highway) and higher quality score per sequence
                prev = raw_by_seq.get(seq)
                if prev is None or (prev["foot"] and not c["foot"]) or (c["foot"] == prev["foot"] and c["qs"] > prev["qs"]):
                    raw_by_seq[seq] = c
            if done % 200 == 0 or done == len(tiles_z6):
                print(f"    Tiles {done}/{len(tiles_z6)} -> {len(raw_by_seq)} unique sequences", flush=True)

    all_cands = list(raw_by_seq.values())
    if not all_cands:
        raise SystemExit("ERROR: No Mapillary 360 candidates found from tiles")

    print(f"2/4 Offline reverse-geocoding {len(all_cands)} candidates...", flush=True)
    geo_res = rg.search([(c["lat"], c["lng"]) for c in all_cands], mode=1, verbose=False)
    by_country: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for c, g in zip(all_cands, geo_res):
        cc = _iso2(g.get("cc", ""))
        if not cc:
            continue
        c["country"] = cc
        try:
            glat, glng = float(g["lat"]), float(g["lon"])
            dist_city = haversine_km(c["lat"], c["lng"], glat, glng)
        except Exception:
            dist_city = 10.0
        # Consider within 2.5 km of a city/town center or foot=True as urban
        c["is_urban"] = (dist_city < 2.5) or c["foot"]
        by_country[cc].append(c)

    print(f"    Found {len(by_country)} raw countries before quality verification.", flush=True)

    # Spatial thinning + country quota (<= 2.7% per country) with 1.8x oversampling before image checks
    max_per_country = max(min_per_country, int(target * 0.027))
    oversample_cap = int(max_per_country * 1.8)
    selected_cands: list[dict[str, Any]] = []
    cell50_counts: Counter[tuple[int, int]] = Counter()
    used_cell2: set[tuple[int, int]] = set()

    for cc, items in sorted(by_country.items(), key=lambda kv: len(kv[1])):
        # Prefer non-urban road points first, then shuffle within each tier
        rural = [x for x in items if not x["is_urban"]]
        urban = [x for x in items if x["is_urban"]]
        random.shuffle(rural)
        random.shuffle(urban)
        ordered = rural + urban

        # Weight ~ sqrt(available), capped at oversample_cap
        quota = min(oversample_cap, max(12, int(round(math.sqrt(len(items)) * 3.2))))
        picked = 0
        for c in ordered:
            if picked >= quota:
                break
            c2 = cell_2km(c["lat"], c["lng"])
            c50 = cell_50km(c["lat"], c["lng"])
            if c2 in used_cell2 or cell50_counts[c50] >= 5:
                continue
            used_cell2.add(c2)
            cell50_counts[c50] += 1
            selected_cands.append(c)
            picked += 1

    print(f"3/4 Verifying {len(selected_cands)} candidates via Graph API + preview quality...", flush=True)
    verified: list[dict[str, Any]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
        futs = [ex.submit(_verify_mapillary_candidate, c, tok) for c in selected_cands]
        done = 0
        for fut in concurrent.futures.as_completed(futs):
            done += 1
            res = fut.result()
            if res is not None:
                verified.append(res)
            if done % 250 == 0 or done == len(selected_cands):
                print(f"    Verified {done}/{len(selected_cands)} -> {len(verified)} passed", flush=True)

    # Final spatial + diversity assembly: min 2km, <=3 per 50km cell, <=30% urban, <=3% per country, >=min_per_country
    print("4/4 Assembling balanced pool...", flush=True)
    final_pool: list[dict[str, Any]] = []
    seen_seq: set[str] = set()
    seen_ids: set[str] = set()
    final_c50: Counter[tuple[int, int]] = Counter()
    final_coords_by_cell2: dict[tuple[int, int], list[tuple[float, float]]] = defaultdict(list)
    country_counts: Counter[str] = Counter()
    urban_count = 0
    max_urban = int(target * 0.30)

    ver_by_cc: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for v in verified:
        ver_by_cc[v["country"]].append(v)

    # Drop countries with < min_per_country verified items
    eligible_countries = [cc for cc, items in ver_by_cc.items() if len(items) >= min_per_country]
    eligible_countries.sort(key=lambda cc: len(ver_by_cc[cc]))

    def _can_add(item: dict[str, Any]) -> bool:
        if item["id"] in seen_ids or item["sequence"] in seen_seq:
            return False
        cc = item["country"]
        if country_counts[cc] >= max_per_country:
            return False
        if item.get("_is_urban") and urban_count >= max_urban:
            return False
        c50 = cell_50km(item["lat"], item["lng"])
        if final_c50[c50] >= 3:
            return False
        c2 = cell_2km(item["lat"], item["lng"])
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for plat, plng in final_coords_by_cell2.get((c2[0] + dx, c2[1] + dy), ()):
                    if haversine_km(item["lat"], item["lng"], plat, plng) < 2.0:
                        return False
        return True

    def _add(item: dict[str, Any]) -> None:
        nonlocal urban_count
        is_urb = bool(item.pop("_is_urban", False))
        if is_urb:
            urban_count += 1
        final_pool.append(item)
        seen_ids.add(item["id"])
        seen_seq.add(item["sequence"])
        final_c50[cell_50km(item["lat"], item["lng"])] += 1
        final_coords_by_cell2[cell_2km(item["lat"], item["lng"])].append((item["lat"], item["lng"]))
        country_counts[item["country"]] += 1

    # Round-robin across eligible countries so rare countries get their >= min_per_country first
    for cc in eligible_countries:
        items = ver_by_cc[cc]
        items.sort(key=lambda x: (1 if x.get("_is_urban") else 0, random.random()))
        cc_cap = min(max_per_country, max(min_per_country, int(round(math.sqrt(len(items)) * 5.0))))
        for it in items:
            if country_counts[cc] >= cc_cap:
                break
            if _can_add(it):
                _add(it)

    # Top up up to target from remaining verified rural-first items
    if len(final_pool) < target:
        leftovers = [it for cc in eligible_countries for it in ver_by_cc[cc] if it["id"] not in seen_ids]
        leftovers.sort(key=lambda x: (1 if x.get("_is_urban") else 0, country_counts[x["country"]], random.random()))
        for it in leftovers:
            if len(final_pool) >= target:
                break
            if _can_add(it):
                _add(it)

    # Add supplemental Panoramax rural points
    pano_extras = _fetch_panoramax_extras(seen_seq, seen_ids, limit_total=150)
    for it in pano_extras:
        if len(final_pool) >= target + 200:
            break
        if it["country"] in country_counts and _can_add(it):
            _add(it)

    # Final prune: ensure no country ended up < min_per_country after spatial thinning
    final_counts = Counter(p["country"] for p in final_pool)
    final_pool = [p for p in final_pool if final_counts[p["country"]] >= min_per_country]
    random.shuffle(final_pool)
    return final_pool


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", type=int, default=3500)
    ap.add_argument("--max-tiles", type=int, default=0, help="0 = scan all inhabited z=6 tiles")
    ap.add_argument("--workers", type=int, default=12)
    ap.add_argument("--min-per-country", type=int, default=5)
    ap.add_argument("--out", default="geo_pool.json")
    args = ap.parse_args()

    pool = build_world_pool(
        target=args.target,
        max_tiles=args.max_tiles,
        workers=args.workers,
        min_per_country=args.min_per_country,
    )
    out_path = Path(args.out)
    out_path.write_text(json.dumps(pool, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    counts = Counter(p["country"] for p in pool)
    size_mb = out_path.stat().st_size / (1024 * 1024)
    print(f"Saved {len(pool)} panoramas across {len(counts)} countries to {out_path} ({size_mb:.2f} MB)")
    if counts:
        top = counts.most_common(1)[0]
        print(f"Top country: {top[0]}={top[1]} ({top[1]/len(pool)*100:.2f}%), Min country count: {min(counts.values())}")


if __name__ == "__main__":
    main()
