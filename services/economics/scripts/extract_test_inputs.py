"""Extracts the supplied CSV and XLSX inputs into test-friendly JSON."""

from __future__ import annotations

import argparse
import csv
import json
import re
import zipfile
from pathlib import Path
from typing import Any
from xml.etree import ElementTree

NAMESPACE = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
SHEET_PATHS = {
    "Склад": "xl/worksheets/sheet1.xml",
    "Аэропорт": "xl/worksheets/sheet2.xml",
    "Медучреждение": "xl/worksheets/sheet3.xml",
}


def _cell_value(cell: ElementTree.Element, shared_strings: list[str]) -> Any:
    """Returns a cell value decoded from an XLSX worksheet cell."""

    cell_type = cell.attrib.get("t")
    value_element = cell.find(f"{{{NAMESPACE}}}v")
    if cell_type == "inlineStr":
        inline = cell.find(f"{{{NAMESPACE}}}is")
        if inline is None:
            return ""
        return "".join(
            text.text or "" for text in inline.iter(f"{{{NAMESPACE}}}t")
        )
    if value_element is None or value_element.text is None:
        return ""
    value = value_element.text
    if cell_type == "s":
        return shared_strings[int(value)]
    if cell_type == "b":
        return value == "1"
    if cell_type == "str":
        return value
    try:
        number = float(value)
    except ValueError:
        return value
    if number.is_integer():
        return int(number)
    return number


def _column_index(cell_reference: str) -> int:
    """Returns the zero-based column index for an Excel cell reference."""

    letters = re.match(r"[A-Z]+", cell_reference)
    if letters is None:
        raise ValueError(f"Invalid cell reference: {cell_reference}")
    index = 0
    for letter in letters.group():
        index = index * 26 + ord(letter) - ord("A") + 1
    return index - 1


def _read_workbook(workbook_path: Path) -> dict[str, list[dict[str, Any]]]:
    """Extracts facility parameter rows while retaining units and notes."""

    with zipfile.ZipFile(workbook_path) as workbook:
        strings_root = ElementTree.fromstring(
            workbook.read("xl/sharedStrings.xml")
        )
        shared_strings = [
            "".join(text.text or "" for text in item.iter(f"{{{NAMESPACE}}}t"))
            for item in strings_root
        ]
        scenarios: dict[str, list[dict[str, Any]]] = {}
        for scenario, sheet_path in SHEET_PATHS.items():
            sheet = ElementTree.fromstring(workbook.read(sheet_path))
            sheet_data = sheet.find(f"{{{NAMESPACE}}}sheetData")
            if sheet_data is None:
                scenarios[scenario] = []
                continue

            rows: list[dict[str, Any]] = []
            section = None
            for row in sheet_data:
                values = [""] * 6
                for cell in row:
                    index = _column_index(cell.attrib["r"])
                    if index < len(values):
                        values[index] = _cell_value(cell, shared_strings)

                parameter, unit, base, minimum, maximum, note = values
                if not any(value != "" for value in values):
                    continue
                if isinstance(parameter, str) and parameter.startswith("▌"):
                    section = parameter.removeprefix("▌").strip()
                    continue
                if parameter in ("Параметр", "") or str(parameter).startswith(
                    "ДЕМО-ДАТАСЕТ:"
                ):
                    continue
                rows.append(
                    {
                        "section": section,
                        "parameter": parameter,
                        "unit": unit or None,
                        "base_value": base if base != "" else None,
                        "minimum": minimum if minimum != "" else None,
                        "maximum": maximum if maximum != "" else None,
                        "note": note or None,
                    }
                )
            scenarios[scenario] = rows
    return scenarios


def _catalog_rows(catalog_path: Path) -> list[dict[str, Any]]:
    """Extracts catalog rows and adds test-friendly English field names."""

    with catalog_path.open(encoding="utf-8-sig", newline="") as source:
        rows = list(csv.DictReader(source, delimiter=";"))

    products: list[dict[str, Any]] = []
    for row in rows:
        price_text = row["Цена изделия"].strip()
        price_digits = re.sub(r"\s", "", price_text).replace(",", ".")
        products.append(
            {
                "product_id": row["id"],
                "name": row["Название"],
                "product_type": row["тип"],
                "status": row["статус"],
                "company": row["компания"],
                "description": row["описание"],
                "category": row["Тип"],
                "subcategory": row["Подтип"],
                "scenario": row["Сценарий"],
                "cases": row["Кейсы"],
                "technology_readiness_level": row["УГТ"],
                "market_potential": row["Рын Потенциал"],
                "region": row["Регион"],
                "industry": row["Отрасль"],
                "price_as_listed": price_text or None,
                "price_amount": price_digits or None,
                "price_currency": None,
                "raw": row,
            }
        )
    return products


def _parse_args() -> argparse.Namespace:
    """Parses local source-file and snapshot-output paths."""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog-csv", type=Path, required=True)
    parser.add_argument("--scenario-workbook", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    return parser.parse_args()


def main() -> None:
    """Writes deterministic JSON snapshots from the supplied source files."""

    args = _parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    products = _catalog_rows(args.catalog_csv)
    facilities = _read_workbook(args.scenario_workbook)
    outputs = {
        "catalog_products.json": {
            "source_file": args.catalog_csv.name,
            "record_count": len(products),
            "records": products,
        },
        "facility_scenarios.json": {
            "source_file": args.scenario_workbook.name,
            "scenarios": facilities,
            "record_counts": {
                name: len(rows) for name, rows in facilities.items()
            },
        },
    }
    for filename, payload in outputs.items():
        output_path = args.output_dir / filename
        output_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
