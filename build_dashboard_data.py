import argparse
import csv
import json
from pathlib import Path
from typing import Any, Dict, List


def load_records(path: Path) -> List[Dict[str, Any]]:
    if path.suffix.lower() == ".json":
      data = json.loads(path.read_text())
      if isinstance(data, list):
          return data
      if isinstance(data, dict):
          for key in ("rows", "data", "results"):
              if isinstance(data.get(key), list):
                  return data[key]
      raise ValueError(f"Unsupported JSON shape in {path}")

    if path.suffix.lower() == ".jsonl":
        return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]

    if path.suffix.lower() == ".csv":
        with path.open(newline="", encoding="utf-8") as handle:
            return list(csv.DictReader(handle))

    raise ValueError(f"Unsupported file type: {path.suffix}")


def coerce_json_field(value: Any, fallback: Any) -> Any:
    if value is None:
        return fallback
    if isinstance(value, (list, dict)):
        return value
    text = str(value).strip()
    if not text:
        return fallback
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return fallback


def normalize_reason(value: Any) -> List[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        parts = [part.strip("- ").strip() for part in value.split("\n\n") if part.strip()]
        return [part for part in parts if part]
    return []


def normalize_engine_products(value: Any) -> Dict[str, List[Dict[str, Any]]]:
    parsed = coerce_json_field(value, [])
    if isinstance(parsed, dict):
        return parsed

    result: Dict[str, List[Dict[str, Any]]] = {}
    for item in parsed:
        if not isinstance(item, dict):
            continue
        engine = item.get("engine")
        products = item.get("products", [])
        if engine:
            result[str(engine)] = products
    return result


def normalize_query_records(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized = []
    for row in records:
        normalized.append(
            {
                "country": str(row.get("country", "")).lower(),
                "query": row.get("query", ""),
                "winner": row.get("winner", ""),
                "reason": normalize_reason(row.get("reason", [])),
                "engine_scores": coerce_json_field(row.get("engine_scores"), []),
                "engine_products": normalize_engine_products(row.get("engine_products")),
            }
        )
    return normalized


def normalize_country_records(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized = []
    for row in records:
        engine_summary = row.get("engine_summary", {})
        parsed_engine_summary = coerce_json_field(engine_summary, {})
        normalized.append(
            {
                "country": str(row.get("country", "")).lower(),
                "ranking": coerce_json_field(row.get("ranking"), []),
                "final_verdict": row.get("final_verdict", ""),
                "key_differences": coerce_json_field(row.get("key_differences"), []),
                "engine_summary": parsed_engine_summary,
            }
        )
    return normalized


def build_payload(
    query_rows: List[Dict[str, Any]],
    country_rows: List[Dict[str, Any]],
) -> Dict[str, Any]:
    return {
        "queryResults": normalize_query_records(query_rows),
        "countrySummaries": normalize_country_records(country_rows),
    }


def write_outputs(payload: Dict[str, Any], json_path: Path, js_path: Path) -> None:
    json_path.parent.mkdir(parents=True, exist_ok=True)
    js_path.parent.mkdir(parents=True, exist_ok=True)

    json_text = json.dumps(payload, indent=2, ensure_ascii=True)
    json_path.write_text(json_text + "\n", encoding="utf-8")
    js_path.write_text(f"window.__DASHBOARD_DATA__ = {json_text};\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build dashboard payload files from exported query and country results."
    )
    parser.add_argument("--query-results", required=True, help="JSON, JSONL, or CSV export for query-level dashboard rows")
    parser.add_argument("--country-results", required=True, help="JSON, JSONL, or CSV export for country-level dashboard rows")
    parser.add_argument("--json-output", default="data/dashboard-data.json", help="Output JSON file")
    parser.add_argument("--js-output", default="data/dashboard-data.js", help="Output JS file for the static dashboard")
    args = parser.parse_args()

    query_rows = load_records(Path(args.query_results))
    country_rows = load_records(Path(args.country_results))
    payload = build_payload(query_rows, country_rows)
    write_outputs(payload, Path(args.json_output), Path(args.js_output))
    print(f"Wrote {len(payload['queryResults'])} query rows and {len(payload['countrySummaries'])} country rows")


if __name__ == "__main__":
    main()
