#!/usr/bin/env python3
"""Build a curated 360-degree panorama pool for Geo$take from Panoramax (and optional Mapillary)."""

from __future__ import annotations

import argparse
import json
import math
import os
import struct
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

try:
    from PIL import Image, ImageStat, ImageFilter  # type: ignore
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

# ~115 diverse regions across continents: cities, towns, coasts, mountains, highways
REGIONS = [
    # Western & Central Europe
    ("Paris, FR", 2.28, 48.83, 2.40, 48.89),
    ("Lyon, FR", 4.78, 45.73, 4.88, 45.79),
    ("Marseille, FR", 5.34, 43.27, 5.42, 43.33),
    ("Nice, FR", 7.22, 43.68, 7.30, 43.73),
    ("Bordeaux, FR", -0.61, 44.81, -0.54, 44.87),
    ("Strasbourg, FR", 7.71, 48.55, 7.78, 48.60),
    ("Toulouse, FR", 1.40, 43.58, 1.48, 43.63),
    ("Nantes, FR", -1.59, 47.19, -1.51, 47.24),
    ("Lille, FR", 3.02, 50.61, 3.09, 50.66),
    ("Montpellier, FR", 3.84, 43.59, 3.91, 43.64),
    ("Brussels, BE", 4.31, 50.82, 4.40, 50.87),
    ("Antwerp, BE", 4.38, 51.19, 4.45, 51.24),
    ("Ghent, BE", 3.69, 51.03, 3.76, 51.08),
    ("Amsterdam, NL", 4.85, 52.34, 4.94, 52.39),
    ("Rotterdam, NL", 4.44, 51.90, 4.52, 51.94),
    ("Berlin, DE", 13.33, 52.49, 13.45, 52.54),
    ("Munich, DE", 11.53, 48.11, 11.62, 48.17),
    ("Hamburg, DE", 9.95, 53.53, 10.04, 53.58),
    ("Cologne, DE", 6.91, 50.91, 6.99, 50.96),
    ("Frankfurt, DE", 8.64, 50.09, 8.72, 50.14),
    ("Vienna, AT", 16.33, 48.18, 16.41, 48.23),
    ("Zurich, CH", 8.50, 47.35, 8.58, 47.40),
    ("Geneva, CH", 6.11, 46.18, 6.18, 46.23),
    ("Bern, CH", 7.41, 46.93, 7.48, 46.97),
    ("London, UK", -0.17, 51.49, -0.07, 51.53),
    ("Edinburgh, UK", -3.23, 55.93, -3.15, 55.97),
    ("Dublin, IE", -6.30, 53.32, -6.22, 53.37),
    # Southern & Northern & Eastern Europe
    ("Madrid, ES", -3.74, 40.39, -3.66, 40.45),
    ("Barcelona, ES", 2.13, 41.36, 2.21, 41.42),
    ("Seville, ES", -6.02, 37.36, -5.95, 37.41),
    ("Lisbon, PT", -9.18, 38.70, -9.10, 38.75),
    ("Porto, PT", -8.65, 41.13, -8.58, 41.18),
    ("Rome, IT", 12.44, 41.87, 12.53, 41.93),
    ("Milan, IT", 9.15, 45.44, 9.23, 45.49),
    ("Florence, IT", 11.22, 43.75, 11.29, 43.79),
    ("Naples, IT", 14.22, 40.82, 14.29, 40.87),
    ("Athens, GR", 23.69, 37.95, 23.77, 38.00),
    ("Prague, CZ", 14.39, 50.06, 14.47, 50.11),
    ("Warsaw, PL", 20.97, 52.20, 21.06, 52.26),
    ("Krakow, PL", 19.90, 50.04, 19.98, 50.08),
    ("Budapest, HU", 19.01, 47.47, 19.09, 47.52),
    ("Bucharest, RO", 26.06, 44.41, 26.14, 44.46),
    ("Sofia, BG", 23.28, 42.67, 23.36, 42.72),
    ("Kyiv, UA", 30.48, 50.42, 30.57, 50.48),
    ("Lviv, UA", 23.99, 49.81, 24.06, 49.86),
    ("Stockholm, SE", 18.02, 59.30, 18.11, 59.35),
    ("Oslo, NO", 10.70, 59.89, 10.79, 59.94),
    ("Copenhagen, DK", 12.53, 55.65, 12.61, 55.70),
    ("Helsinki, FI", 24.90, 60.15, 24.98, 60.19),
    ("Reykjavik, IS", -21.98, 64.12, -21.88, 64.16),
    ("Tallinn, EE", 24.71, 59.41, 24.79, 59.46),
    ("Riga, LV", 24.07, 56.93, 24.16, 56.98),
    ("Vilnius, LT", 25.24, 54.66, 25.32, 54.71),
    # Americas
    ("New York, US", -74.02, 40.70, -73.95, 40.78),
    ("San Francisco, US", -122.46, 37.75, -122.38, 37.81),
    ("Los Angeles, US", -118.30, 34.02, -118.20, 34.09),
    ("Chicago, US", -87.67, 41.85, -87.60, 41.91),
    ("Seattle, US", -122.36, 47.59, -122.29, 47.65),
    ("Miami, US", -80.24, 25.75, -80.16, 25.81),
    ("Boston, US", -71.10, 42.33, -71.03, 42.38),
    ("Austin, US", -97.78, 30.24, -97.70, 30.30),
    ("Denver, US", -105.02, 39.71, -104.94, 39.77),
    ("Toronto, CA", -79.42, 43.63, -79.34, 43.68),
    ("Vancouver, CA", -123.16, 49.25, -123.08, 49.30),
    ("Montreal, CA", -73.61, 45.48, -73.53, 45.54),
    ("Mexico City, MX", -99.18, 19.40, -99.10, 19.46),
    ("Guadalajara, MX", -103.39, 20.65, -103.31, 20.70),
    ("Bogota, CO", -74.11, 4.59, -74.03, 4.67),
    ("Medellin, CO", -75.60, 6.22, -75.54, 6.28),
    ("Lima, PE", -77.07, -12.13, -77.00, -12.04),
    ("Santiago, CL", -70.69, -33.48, -70.61, -33.42),
    ("Buenos Aires, AR", -58.43, -34.64, -58.35, -34.57),
    ("Sao Paulo, BR", -46.68, -23.59, -46.60, -23.52),
    ("Rio de Janeiro, BR", -43.24, -22.97, -43.16, -22.89),
    ("Montevideo, UY", -56.22, -34.92, -56.14, -34.86),
    ("Quito, EC", -78.54, -0.25, -78.46, -0.17),
    ("San Jose, CR", -84.12, 9.91, -84.05, 9.96),
    # Asia & Middle East
    ("Tokyo, JP", 139.68, 35.65, 139.78, 35.72),
    ("Osaka, JP", 135.46, 34.65, 135.54, 34.72),
    ("Kyoto, JP", 135.72, 34.98, 135.79, 35.04),
    ("Sapporo, JP", 141.31, 43.03, 141.39, 43.09),
    ("Seoul, KR", 126.94, 37.53, 127.04, 37.59),
    ("Busan, KR", 129.02, 35.09, 129.10, 35.16),
    ("Taipei, TW", 121.49, 25.01, 121.58, 25.07),
    ("Bangkok, TH", 100.47, 13.71, 100.56, 13.78),
    ("Singapore, SG", 103.81, 1.27, 103.88, 1.33),
    ("Kuala Lumpur, MY", 101.66, 3.12, 101.73, 3.18),
    ("Jakarta, ID", 106.79, -6.24, 106.87, -6.16),
    ("Manila, PH", 120.96, 14.56, 121.03, 14.62),
    ("Hanoi, VN", 105.81, 21.00, 105.88, 21.05),
    ("Ho Chi Minh, VN", 106.66, 10.75, 106.73, 10.80),
    ("Mumbai, IN", 72.81, 18.92, 72.88, 19.00),
    ("Delhi, IN", 77.18, 28.59, 77.26, 28.66),
    ("Bengaluru, IN", 77.55, 12.94, 77.63, 13.00),
    ("Istanbul, TR", 28.94, 41.00, 29.04, 41.06),
    ("Ankara, TR", 32.81, 39.89, 32.89, 39.96),
    ("Tbilisi, GE", 44.76, 41.68, 44.83, 41.74),
    ("Yerevan, AM", 44.48, 40.16, 44.55, 40.21),
    ("Almaty, KZ", 76.89, 43.21, 76.97, 43.27),
    ("Dubai, AE", 55.24, 25.17, 55.32, 25.24),
    ("Tel Aviv, IL", 34.75, 32.05, 34.81, 32.11),
    ("Amman, JO", 35.89, 31.93, 35.96, 31.98),
    ("Podgorica, ME", 19.22, 42.40, 19.30, 42.48),
    ("Chisinau, MD", 28.82, 46.97, 28.90, 47.05),
    ("Valletta, MT", 14.47, 35.86, 14.55, 35.94),
    ("Nicosia, CY", 33.34, 35.15, 33.42, 35.23),
    ("Cluj, RO", 23.56, 46.73, 23.64, 46.81),
    ("Thessaloniki, GR", 22.90, 40.60, 22.98, 40.68),
    ("Hong Kong, HK", 114.13, 22.28, 114.21, 22.36),
    ("Baku, AZ", 49.83, 40.37, 49.91, 40.45),
    ("Kaunas, LT", 23.86, 54.86, 23.94, 54.94),
    ("Daugavpils, LV", 26.49, 55.83, 26.57, 55.91),
    # Africa & Oceania
    ("Cape Town, ZA", 18.38, -33.96, 18.47, -33.89),
    ("Johannesburg, ZA", 28.00, -26.23, 28.08, -26.17),
    ("Nairobi, KE", 36.79, -1.31, 36.86, -1.25),
    ("Marrakesh, MA", -8.03, 31.60, -7.96, 31.66),
    ("Casablanca, MA", -7.65, 33.56, -7.57, 33.61),
    ("Tunis, TN", 10.14, 36.78, 10.21, 36.83),
    ("Cairo, EG", 31.20, 30.02, 31.28, 30.08),
    ("Dakar, SN", -17.48, 14.66, -17.41, 14.73),
    ("Sydney, AU", 151.18, -33.90, 151.24, -33.84),
    ("Melbourne, AU", 144.93, -37.84, 145.00, -37.79),
    ("Brisbane, AU", 153.00, -27.50, 153.06, -27.44),
    ("Perth, AU", 115.83, -31.98, 115.89, -31.92),
    ("Auckland, NZ", 174.73, -36.88, 174.80, -36.82),
    ("Wellington, NZ", 174.75, -41.31, 174.80, -41.27),
    # Extra Europe for wider country coverage
    ("Zagreb, HR", 15.94, 45.78, 16.02, 45.84),
    ("Ljubljana, SI", 14.47, 46.03, 14.55, 46.08),
    ("Bratislava, SK", 17.08, 48.12, 17.16, 48.18),
    ("Belgrade, RS", 20.42, 44.78, 20.50, 44.84),
    ("Luxembourg, LU", 6.09, 49.58, 6.17, 49.64),
    ("Gothenburg, SE", 11.93, 57.68, 12.02, 57.74),
    ("Bergen, NO", 5.29, 60.36, 5.37, 60.42),
    ("Aarhus, DK", 10.17, 56.13, 10.24, 56.18),
    ("Tampere, FI", 23.72, 61.47, 23.81, 61.52),
    ("Valencia, ES", -0.41, 39.44, -0.33, 39.50),
    ("Bilbao, ES", -2.97, 43.24, -2.90, 43.29),
    ("Turin, IT", 7.64, 45.04, 7.72, 45.10),
    ("Bologna, IT", 11.30, 44.47, 11.38, 44.52),
    ("Graz, AT", 15.40, 47.04, 15.48, 47.10),
    ("Salzburg, AT", 13.01, 47.78, 13.08, 47.83),
    ("Rotterdam West, NL", 4.35, 51.89, 4.43, 51.95),
    ("Utrecht, NL", 5.08, 52.06, 5.16, 52.12),
    ("Bristol, UK", -2.63, 51.43, -2.55, 51.48),
    ("Manchester, UK", -2.28, 53.45, -2.20, 53.51),
    ("Cork, IE", -8.52, 51.87, -8.43, 51.92),
    ("Chamonix Alps, FR", 6.84, 45.90, 6.91, 45.95),
    ("Normandy Coast, FR", -0.88, 49.33, -0.75, 49.39),
]


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def jpeg_dimensions(data: bytes) -> tuple[int, int] | None:
    """Parse width and height from JPEG SOF0/SOF2 marker without external libs."""
    if len(data) < 4 or data[0:2] != b"\xff\xd8":
        return None
    i = 2
    n = len(data)
    while i + 4 <= n:
        if data[i] != 0xFF:
            i += 1
            continue
        while i < n and data[i] == 0xFF:
            i += 1
        if i >= n:
            break
        marker = data[i]
        i += 1
        if marker in (0xD8, 0xD9, 0x00) or (0xD0 <= marker <= 0xD7):
            continue
        if i + 2 > n:
            break
        seg_len = struct.unpack(">H", data[i:i + 2])[0]
        if seg_len < 2 or i + seg_len > n:
            break
        if marker in (0xC0, 0xC1, 0xC2, 0xC3):
            if seg_len >= 7:
                h, w = struct.unpack(">HH", data[i + 3:i + 7])
                return (w, h)
            return None
        i += seg_len
    return None


def check_image_quality(url: str, timeout: float = 10.0) -> tuple[bool, str]:
    """Download preview/sd JPEG and verify 2:1 aspect ratio, size, and brightness/sharpness (if Pillow available)."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "LobbyGG-GeoPoolBuilder/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read(2_500_000)
    except Exception as exc:
        return False, f"download failed: {exc}"

    if len(data) < 8_000:
        return False, f"too small ({len(data)} bytes)"

    dims = jpeg_dimensions(data)
    if dims is None:
        return False, "not valid JPEG"
    w, h = dims
    if h == 0 or abs((w / h) - 2.0) > 0.08:
        return False, f"not 2:1 equirectangular ({w}x{h})"

    if HAS_PIL:
        import io
        try:
            img = Image.open(io.BytesIO(data)).convert("L")
            mean_b = ImageStat.Stat(img).mean[0]
            if mean_b < 32 or mean_b > 235:
                return False, f"bad brightness ({mean_b:.1f})"
            edges = img.filter(ImageFilter.FIND_EDGES)
            sharp = ImageStat.Stat(edges).stddev[0]
            if sharp < 8.0:
                return False, f"too blurry ({sharp:.1f})"
        except Exception as exc:
            return False, f"PIL check error: {exc}"

    return True, "ok"


def parse_year(dt_str: str | None) -> int | None:
    if not dt_str:
        return None
    try:
        return int(str(dt_str)[:4])
    except Exception:
        return None


def fetch_panoramax_region(region_name: str, bbox: tuple[float, float, float, float], limit: int = 30) -> list[dict]:
    min_lon, min_lat, max_lon, max_lat = bbox
    cx, cy = (min_lon + max_lon) / 2, (min_lat + max_lat) / 2
    offsets = [
        (0.0, 0.0),
        (-0.20, -0.15),
        (0.20, 0.15),
        (-0.20, 0.15),
        (0.20, -0.15),
    ]
    out = []
    seen_local: set[str] = set()
    cur_year = datetime.now(timezone.utc).year
    for dx, dy in offsets:
        bx, by = cx + dx, cy + dy
        url = f"https://api.panoramax.xyz/api/search?bbox={bx-0.15:.4f},{by-0.12:.4f},{bx+0.15:.4f},{by+0.12:.4f}&filter=field_of_view%3D360&limit={limit}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "LobbyGG-GeoPoolBuilder/1.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
        except Exception:
            continue
        for feat in payload.get("features", []):
            fid = str(feat.get("id") or "")
            if not fid or fid in seen_local:
                continue
            props = feat.get("properties") or {}
            fov = (props.get("pers:interior_orientation") or {}).get("field_of_view")
            if fov != 360 and props.get("geovisio:image_type") != "equirectangular":
                continue
            dt_str = props.get("datetime") or ""
            yr = parse_year(dt_str)
            if yr is None or yr < 2016 or yr > cur_year:
                continue
            coords = (feat.get("geometry") or {}).get("coordinates") or []
            if len(coords) < 2:
                continue
            lng, lat = float(coords[0]), float(coords[1])
            assets = feat.get("assets") or {}
            sd_url = (assets.get("sd") or {}).get("href") or (assets.get("hd") or {}).get("href")
            if not sd_url:
                continue
            seen_local.add(fid)
            country = _iso2(region_name)
            out.append({
                "id": fid,
                "source": "panoramax",
                "country": country,
                "lat": round(lat, 6),
                "lng": round(lng, 6),
                "heading": float(props.get("view:azimuth") or 0.0),
                "author": str(props.get("geovisio:producer") or "Panoramax contributor"),
                "license": str(props.get("license") or "CC-BY-SA-4.0"),
                "captured_at": dt_str[:10],
                "region": region_name,
                "img_url": sd_url,
                "_check_url": sd_url,
            })
            break  # 1 candidate per sub-tile gives natural >=2km spread!
    return out


def get_mapillary_token() -> str:
    tok = os.environ.get("MAPILLARY_TOKEN", "").strip()
    if tok:
        return tok
    token_file = Path.home() / ".mapillary_token"
    if token_file.exists():
        return token_file.read_text(encoding="utf-8").strip()
    return ""


def fetch_mapillary_region(region_name: str, bbox: tuple[float, float, float, float], token: str, limit: int = 15) -> list[dict]:
    min_lon, min_lat, max_lon, max_lat = bbox
    params = urllib.parse.urlencode({
        "bbox": f"{min_lon},{min_lat},{max_lon},{max_lat}",
        "fields": "id,computed_geometry,compass_angle,captured_at,is_pano,creator,thumb_1024_url,thumb_2048_url",
        "is_pano": "true",
        "limit": str(limit),
    })
    url = f"https://graph.mapillary.com/images?{params}"
    req = urllib.request.Request(url, headers={
        "Authorization": f"OAuth {token}",
        "User-Agent": "LobbyGG-GeoPoolBuilder/1.0",
    })
    with urllib.request.urlopen(req, timeout=12) as resp:
        payload = json.loads(resp.read().decode("utf-8"))

    out = []
    cur_year = datetime.now(timezone.utc).year
    for item in payload.get("data", []):
        if not item.get("is_pano"):
            continue
        coords = (item.get("computed_geometry") or {}).get("coordinates") or []
        if len(coords) < 2:
            continue
        cap_ms = item.get("captured_at")
        dt_str = ""
        if isinstance(cap_ms, (int, float)):
            dt = datetime.fromtimestamp(cap_ms / 1000.0, tz=timezone.utc)
            if dt.year < 2016 or dt.year > cur_year:
                continue
            dt_str = dt.strftime("%Y-%m-%d")
        img_url = item.get("thumb_2048_url") or item.get("thumb_1024_url")
        if not img_url:
            continue
        creator = item.get("creator") or {}
        country = _iso2(region_name)
        out.append({
            "id": str(item["id"]),
            "source": "mapillary",
            "country": country,
            "lat": round(float(coords[1]), 6),
            "lng": round(float(coords[0]), 6),
            "heading": float(item.get("compass_angle") or 0.0),
            "author": str(creator.get("username") or "Mapillary contributor"),
            "license": "CC-BY-SA-4.0",
            "captured_at": dt_str,
            "region": region_name,
            "_check_url": item.get("thumb_1024_url") or img_url,
        })
    return out


def too_close(lat: float, lng: float, pool: list[dict], min_km: float = 2.0) -> bool:
    for item in pool:
        if haversine_km(lat, lng, item["lat"], item["lng"]) < min_km:
            return True
    return False


def _iso2(region_name: str) -> str:
    """Код страны ISO-3166 alpha-2 из подписи региона («London, UK» → GB)."""
    c = region_name.split(",")[-1].strip().upper()
    return {"UK": "GB"}.get(c, c)


def build_pool(per_region: int, sources: list[str], target: int, dry_run: bool, max_per_country: int = 12) -> list[dict]:
    pool: list[dict] = []
    seen_ids: set[str] = set()
    country_counts: dict[str, int] = {}
    mapillary_tok = get_mapillary_token() if "mapillary" in sources else ""
    if "mapillary" in sources and not mapillary_tok:
        print("Info: MAPILLARY_TOKEN not set; skipping Mapillary source.", file=sys.stderr)

    # Sort non-FR regions first or keep diverse order; cap every country at max_per_country
    for region_name, min_lon, min_lat, max_lon, max_lat in REGIONS:
        if len(pool) >= target:
            break
        country = _iso2(region_name)
        if country_counts.get(country, 0) >= max_per_country:
            continue
        bbox = (min_lon, min_lat, max_lon, max_lat)
        candidates: list[dict] = []
        if "panoramax" in sources:
            try:
                candidates.extend(fetch_panoramax_region(region_name, bbox, limit=25))
            except Exception as exc:
                print(f"[{region_name}] Panoramax error: {exc}", file=sys.stderr)
        if "mapillary" in sources and mapillary_tok:
            try:
                candidates.extend(fetch_mapillary_region(region_name, bbox, mapillary_tok, limit=15))
            except Exception as exc:
                print(f"[{region_name}] Mapillary error: {exc}", file=sys.stderr)

        added = 0
        for cand in candidates:
            if added >= per_region or len(pool) >= target:
                break
            if country_counts.get(country, 0) >= max_per_country:
                break
            uid = f"{cand['source']}:{cand['id']}"
            if uid in seen_ids:
                continue
            if too_close(cand["lat"], cand["lng"], pool, min_km=2.0):
                continue
            if not dry_run:
                ok, reason = check_image_quality(cand["_check_url"])
                if not ok:
                    continue
            seen_ids.add(uid)
            clean_item = {k: v for k, v in cand.items() if not k.startswith("_")}
            pool.append(clean_item)
            country_counts[country] = country_counts.get(country, 0) + 1
            added += 1

        if added > 0:
            print(f"[{region_name}] +{added} (total {len(pool)}, {len(country_counts)} countries)", flush=True)
        time.sleep(0.05)

    return pool


def main() -> int:
    ap = argparse.ArgumentParser(description="Build Geo$take 360 panorama pool.")
    ap.add_argument("--per-region", type=int, default=4, help="Max panoramas per region")
    ap.add_argument("--target", type=int, default=180, help="Stop after collecting this many panoramas")
    ap.add_argument("--max-per-country", type=int, default=12, help="Max panoramas per ISO-2 country (<=8%% cap)")
    ap.add_argument("--out", default="geo_pool.json", help="Output JSON path")
    ap.add_argument("--sources", default="panoramax,mapillary", help="Comma-separated sources")
    ap.add_argument("--dry-run", action="store_true", help="Skip image download quality check")
    args = ap.parse_args()

    sources = [s.strip().lower() for s in args.sources.split(",") if s.strip()]
    pool = build_pool(args.per_region, sources, args.target, args.dry_run, max_per_country=args.max_per_country)
    print(f"Collected {len(pool)} panoramas across {len({x['country'] for x in pool})} countries.")

    if args.dry_run:
        return 0

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(pool, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved pool to {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
