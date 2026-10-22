"""Раскладывает тексты (tools/v2/readings/<lv>.yaml) по тематическим урокам того же уровня.

Для каждой пары «текст — урок» считаем, сколько слов урока встречается в тексте; затем жадно
назначаем пары с наибольшим совпадением, по одному тексту на урок. Результат — tools/v2/reading_map.txt
(«a1.012 = a1-05»); его можно поправить руками, build_content.py вставляет тексты в уроки.

    python tools/v2/attach_readings.py
"""
import math, re, sys, yaml
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
V2 = ROOT / "tools" / "v2"
VOCAB = ROOT / "backend" / "content" / "vocab"
LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"]


def tokens(text: str) -> list[str]:
    return re.findall(r"[a-z]+(?:'[a-z]+)?", text.lower())


def matches(word: str, toks: set[str], text: str) -> bool:
    w = word.lower()
    if " " in w or "-" in w:
        core = re.sub(r"\b(sb|sth|somebody|something|someone|one's|yourself)\b", "", w).strip()
        return len(core) > 3 and core in text
    if len(w) < 3:
        return False
    return any(t == w or (t.startswith(w) and len(t) - len(w) <= 3) or (w.endswith("e") and t.startswith(w[:-1]) and len(t) - len(w) <= 3) for t in toks)


# содержательные темы: служебные уроки (наречия, фразы, идиомы…) текстов не получают
CONTENT_TOPICS = {"people", "body", "work", "food", "arts", "city", "education", "nature", "objects", "home", "travel",
                  "science", "shopping", "leisure", "animals", "tech", "law", "environment", "clothes", "economy",
                  "society", "events", "feelings", "mind", "communication"}


def topic_vectors() -> tuple[dict[str, dict[str, float]], dict[str, float]]:
    """TF-IDF каждой темы по словам, определениям и примерам всех уровней."""
    docs: dict[str, list[str]] = {}
    for p in VOCAB.glob("*/u*.yaml"):
        d = yaml.safe_load(p.read_text(encoding="utf-8"))
        if d.get("topic") not in CONTENT_TOPICS:
            continue
        for line in d["words"]:
            f = [x.strip() for x in line.split("|")]
            docs.setdefault(d["topic"], []).extend(tokens(" ".join([f[0], f[0], f[5], f[6]])))
    df: dict[str, int] = {}
    for toks in docs.values():
        for t in set(toks):
            df[t] = df.get(t, 0) + 1
    n = len(docs)
    idf = {t: math.log((n + 1) / (c + 0.5)) for t, c in df.items()}
    vecs = {}
    for topic, toks in docs.items():
        tf: dict[str, float] = {}
        for t in toks:
            tf[t] = tf.get(t, 0) + 1
        v = {t: (1 + math.log(c)) * idf[t] for t, c in tf.items() if len(t) > 2}
        norm = math.sqrt(sum(x * x for x in v.values()))
        vecs[topic] = {t: x / norm for t, x in v.items()}
    return vecs, idf


def similarity(text: str, vec: dict[str, float], idf: dict[str, float]) -> float:
    tf: dict[str, float] = {}
    for t in tokens(text):
        if len(t) > 2 and t in idf:
            tf[t] = tf.get(t, 0) + 1
    v = {t: (1 + math.log(c)) * idf[t] for t, c in tf.items()}
    norm = math.sqrt(sum(x * x for x in v.values())) or 1
    return sum(x / norm * vec.get(t, 0) for t, x in v.items())


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    vecs, idf = topic_vectors()
    lines = ["# урок = текст (сгенерировано attach_readings.py; можно править вручную)"]
    for lv in LEVELS:
        readings = yaml.safe_load((V2 / "readings" / f"{lv}.yaml").read_text(encoding="utf-8")) or []
        lessons = {}
        for p in sorted((VOCAB / lv).glob("u*.yaml")):
            d = yaml.safe_load(p.read_text(encoding="utf-8"))
            lessons[f"{lv}.{p.stem[1:]}"] = (d.get("title", ""), [l.split("|")[0].strip() for l in d["words"]], d.get("topic"))
        pairs = []
        for r in readings:
            text = (r["title"] + " " + r["title"] + " " + r["text"]).lower()
            toks = set(tokens(text))
            sims = {t: similarity(text, v, idf) for t, v in vecs.items()}
            for key, (_, words, topic) in lessons.items():
                if topic not in CONTENT_TOPICS:
                    continue
                overlap = sum(matches(w, toks, text) for w in words)
                pairs.append((sims[topic] + 0.01 * overlap, r["id"], key, overlap))
        pairs.sort(reverse=True)
        used_r, used_l = set(), set()
        chosen = []
        for score, rid, key, overlap in pairs:
            if rid in used_r or key in used_l:
                continue
            used_r.add(rid); used_l.add(key); chosen.append((key, rid, overlap))
        # остаток (на уровне мало содержательных уроков) — в любые свободные уроки по совпадению слов
        rest = []
        for r in readings:
            if r["id"] in used_r:
                continue
            text = (r["title"] + " " + r["text"]).lower()
            toks = set(tokens(text))
            for key, (_, words, _topic) in lessons.items():
                if key not in used_l:
                    rest.append((sum(matches(w, toks, text) for w in words), r["id"], key))
        for overlap, rid, key in sorted(rest, reverse=True):
            if rid in used_r or key in used_l:
                continue
            used_r.add(rid); used_l.add(key); chosen.append((key, rid, overlap))
        titles = {r["id"]: r["title"] for r in readings}
        for key, rid, overlap in sorted(chosen):
            lines.append(f"{key} = {rid}  # {lessons[key][0]} ← «{titles[rid]}» ({overlap} слов урока)")
        print(lv, "текстов", len(chosen), "из", len(readings))
    (V2 / "reading_map.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
