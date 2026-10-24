#!/usr/bin/env python3
"""Проверка локальных ресурсов, якорей и разметки без сторонних библиотек."""

import json
import re
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "dist"
errors = []


class SiteParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.references = []
        self.aria_references = []
        self.h1_count = 0
        self.json_blocks = []
        self.json_buffer = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        self.h1_count += tag == "h1"
        for name in ("href", "src"):
            if attrs.get(name):
                self.references.append(attrs[name])
        for name in ("aria-controls", "aria-labelledby"):
            self.aria_references.extend(attrs.get(name, "").split())
        if tag == "img" and "alt" not in attrs:
            errors.append(f"Изображение без alt: {attrs.get('src')}")
        if tag == "iframe" and not attrs.get("title"):
            errors.append("Внешний iframe без названия title")
        if tag == "script" and attrs.get("type") == "application/ld+json":
            self.json_buffer = []

    def handle_data(self, data):
        if self.json_buffer is not None:
            self.json_buffer.append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self.json_buffer is not None:
            self.json_blocks.append("".join(self.json_buffer))
            self.json_buffer = None


def check_reference(reference, source):
    url = urlsplit(reference)
    if url.scheme or url.netloc:
        return
    if url.path:
        path = SITE / unquote(url.path.lstrip("/"))
        if not path.is_file():
            errors.append(f"{source}: отсутствует {url.path}")
    elif url.fragment and unquote(url.fragment) not in parser.ids:
        errors.append(f"{source}: отсутствует якорь #{url.fragment}")


parser = SiteParser()
parser.feed((SITE / "index.html").read_text())
for identifier, count in Counter(parser.ids).items():
    if count > 1:
        errors.append(f"Повторяется id: {identifier}")
if parser.h1_count != 1:
    errors.append(f"Ожидался один H1, найдено: {parser.h1_count}")
for identifier in parser.aria_references:
    if identifier not in parser.ids:
        errors.append(f"ARIA ссылается на отсутствующий id: {identifier}")
for reference in parser.references:
    check_reference(reference, "HTML")
for reference in re.findall(r"url\([\"']?([^\s)'\"]+)", (SITE / "styles.css").read_text()):
    check_reference(reference, "CSS")
if len(parser.json_blocks) != 1:
    errors.append("Ожидался один блок JSON-LD магазина")
for block in parser.json_blocks:
    try:
        data = json.loads(block)
        if data.get("@type") != "AutoPartsStore":
            errors.append("В JSON-LD указан неверный тип организации")
    except json.JSONDecodeError as error:
        errors.append(f"Ошибка JSON-LD: {error}")

if errors:
    print("Проверка не пройдена:\n" + "\n".join(f"- {error}" for error in errors))
    raise SystemExit(1)
print("OK: локальные ресурсы, якоря, ID, ARIA, изображения, iframe и JSON-LD.")
print("Внешние сервисы и поведение интерфейса проверяются отдельно в браузере.")
