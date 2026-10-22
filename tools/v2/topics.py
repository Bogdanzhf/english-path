"""v2, этап 2: темы и уроки. _scratch/v2/wordlist.csv → _scratch/v2/cards.csv (с темой) и units.csv.

    .venv/Scripts/python tools/v2/topics.py

Тема карточки: метка IELTS → тема CEFR-J → смысловая категория WordNet (lexname + «предки»)
→ часть речи. Ручные правки — tools/v2/topic_overrides.txt. Внутри уровня тема делится на уроки
по 15–25 карточек: похожие по смыслу рядом, частотные раньше.
"""

from __future__ import annotations

import csv
import math
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import nltk

ROOT = Path(__file__).resolve().parents[2]
V2 = ROOT / "_scratch" / "v2"
nltk.data.path.insert(0, str(ROOT / "_scratch" / "nltk_data"))
from nltk.corpus import wordnet as wn  # noqa: E402

LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"]

# id → (русское название, английское название)
TOPICS = {
    "people": ("Люди и отношения", "People and relationships"),
    "body": ("Тело и здоровье", "Body and health"),
    "food": ("Еда и напитки", "Food and drink"),
    "home": ("Дом и быт", "Home and everyday life"),
    "clothes": ("Одежда и внешность", "Clothes and appearance"),
    "shopping": ("Покупки и деньги", "Shopping and money"),
    "work": ("Работа и профессии", "Work and jobs"),
    "education": ("Учёба", "Education"),
    "travel": ("Путешествия и транспорт", "Travel and transport"),
    "city": ("Город и места", "Places and the city"),
    "nature": ("Природа, погода и животные", "Nature, weather and animals"),
    "animals": ("Животные", "Animals"),
    "time": ("Время и даты", "Time and dates"),
    "numbers": ("Числа и количество", "Numbers and quantity"),
    "leisure": ("Досуг и спорт", "Free time and sport"),
    "arts": ("Искусство и медиа", "Arts and media"),
    "tech": ("Технологии", "Technology"),
    "communication": ("Общение и язык", "Communication and language"),
    "feelings": ("Чувства и характер", "Feelings and character"),
    "mind": ("Мысли и мнения", "Thinking and opinions"),
    "society": ("Общество и политика", "Society and politics"),
    "law": ("Закон и преступность", "Law and crime"),
    "economy": ("Экономика и бизнес", "Economy and business"),
    "science": ("Наука и исследования", "Science and research"),
    "environment": ("Экология и энергия", "Environment and energy"),
    "actions": ("Действия и движение", "Actions and movement"),
    "describing": ("Описание: качества и признаки", "Describing things"),
    "manner": ("Как и насколько: наречия", "How and how much: adverbs"),
    "place": ("Место и направление", "Place and direction"),
    "objects": ("Предметы и материалы", "Objects and materials"),
    "drop": ("—", "—"),
    "events": ("События и ситуации", "Events and situations"),
    "grammar": ("Служебные слова", "Function words"),
    "phrases": ("Разговорные фразы", "Everyday phrases"),
    "idioms": ("Идиомы", "Idioms"),
    "phrasal": ("Фразовые глаголы", "Phrasal verbs"),
    "essay": ("Язык аргументации", "Language for essays"),
}

IELTS = {
    "education": "education", "work": "work", "technology": "tech", "environment": "environment", "energy": "environment",
    "health": "body", "food": "food", "crime": "law", "government": "society", "economy": "economy",
    "globalisation": "society", "media": "arts", "science": "science", "space": "science", "cities": "city",
    "family": "people", "travel": "travel", "arts": "arts", "sport": "leisure", "animals": "animals",
    "language": "communication", "essay": "essay", "idioms": "idioms", "phrasal": "phrasal",
}

CEFRJ = {
    "Work and Jobs": "work", "Work and jobs": "work", "Education": "education", "Objects and rooms": "home",
    "News, lifestyles and current affairs": "society", "Things in the town, shops and shopping": "city",
    "Travel and services vocab": "travel", "Food and drink": "food", "Hobbies and pastimes": "leisure",
    "Hobbies and lifestyles": "leisure", "Leisure activities": "leisure", "Nationalities and countries": "city",
    "Family life": "people", "Clothes": "clothes", "Media": "arts", "Books and literature": "arts", "Shopping": "shopping",
    "Ways of travelling": "travel", "Ways of traveling": "travel", "Personal information": "people", "Arts": "arts",
    "Art": "arts", "Colours": "describing", "Film": "arts", "Holidays": "travel", "Scientific development": "science",
    "Personal identification": "people", "Free time, entertainment": "leisure", "House and home, environment": "home",
    "Travel": "travel", "Health and body care": "body", "Relations with other people": "people",
    "Adjectives: personality, description, feelings": "feelings", "Dimensions": "describing",
}

NOUN = {
    "noun.food": "food", "noun.animal": "animals", "noun.plant": "nature", "noun.body": "body", "noun.person": "people",
    "noun.location": "city", "noun.time": "time", "noun.quantity": "numbers", "noun.communication": "communication",
    "noun.cognition": "mind", "noun.feeling": "feelings", "noun.attribute": "mind", "noun.shape": "describing",
    "noun.group": "society", "noun.possession": "shopping", "noun.act": "events", "noun.event": "events",
    "noun.state": "events", "noun.process": "science", "noun.phenomenon": "nature", "noun.object": "nature",
    "noun.substance": "objects", "noun.artifact": "objects", "noun.relation": "mind", "noun.motive": "mind",
    "noun.Tops": "mind",
}
VERB = {
    "verb.motion": "actions", "verb.contact": "actions", "verb.change": "actions", "verb.creation": "actions",
    "verb.consumption": "food", "verb.body": "body", "verb.emotion": "feelings", "verb.perception": "actions",
    "verb.cognition": "mind", "verb.communication": "communication", "verb.social": "society",
    "verb.competition": "leisure", "verb.possession": "shopping", "verb.stative": "actions", "verb.weather": "nature",
}
# «предки» в WordNet, уточняющие тему (проверяются по порядку)
HYPERNYMS = [
    ("criminal.n.01", "law"), ("lawyer.n.01", "law"), ("law.n.02", "law"), ("crime.n.01", "law"), ("judge.n.01", "law"),
    ("legal_document.n.01", "law"), ("prison.n.01", "law"), ("sovereign.n.01", "society"), ("aristocrat.n.01", "society"),
    ("deity.n.01", "society"), ("religion.n.01", "society"), ("body_part.n.01", "body"), ("symptom.n.01", "body"),
    ("pain.n.01", "body"), ("disorder.n.01", "body"), ("animal.n.01", "animals"), ("vegetation.n.01", "nature"),
    ("atmospheric_phenomenon.n.01", "nature"), ("land.n.04", "nature"), ("natural_elevation.n.01", "nature"),
    ("sky.n.01", "nature"), ("toiletry.n.01", "home"), ("cutlery.n.02", "home"), ("bedclothes.n.01", "home"),
    ("cooking_utensil.n.01", "home"), ("electronic_device.n.01", "tech"), ("telephone.n.01", "tech"),
    ("worker.n.01", "work"), ("professional.n.01", "work"), ("skilled_worker.n.01", "work"), ("employee.n.01", "work"),
    ("relative.n.01", "people"), ("clothing.n.01", "clothes"), ("footwear.n.02", "clothes"), ("jewelry.n.01", "clothes"),
    ("furniture.n.01", "home"), ("home_appliance.n.01", "home"), ("room.n.01", "home"), ("kitchen_utensil.n.01", "home"),
    ("tableware.n.01", "home"), ("housing.n.01", "home"), ("vehicle.n.01", "travel"), ("conveyance.n.03", "travel"),
    ("building.n.01", "city"), ("structure.n.01", "city"), ("way.n.06", "city"), ("computer.n.01", "tech"),
    ("electronic_equipment.n.01", "tech"), ("software.n.01", "tech"), ("musical_instrument.n.01", "arts"),
    ("art.n.01", "arts"), ("music.n.01", "arts"), ("literary_composition.n.01", "arts"), ("sport.n.01", "leisure"),
    ("game.n.01", "leisure"), ("illness.n.01", "body"), ("medicine.n.02", "body"), ("drug.n.01", "body"),
    ("injury.n.01", "body"), ("money.n.01", "shopping"), ("crime.n.01", "law"), ("weather.n.01", "nature"),
    ("body_of_water.n.01", "nature"), ("geological_formation.n.01", "nature"), ("celestial_body.n.01", "science"),
    ("science.n.01", "science"), ("chemical_element.n.01", "science"), ("educational_institution.n.01", "education"),
    ("time_period.n.01", "time"), ("time_unit.n.01", "time"), ("container.n.01", "objects"), ("tool.n.01", "objects"),
    ("feeling.n.01", "feelings"), ("emotion.n.01", "feelings"), ("communication.n.02", "communication"),
    ("country.n.02", "city"), ("region.n.03", "city"),
]
CONTENT = {"food", "body", "nature", "animals", "tech", "economy", "law", "society", "science", "environment", "arts",
           "feelings", "people", "education", "time", "travel", "clothes", "work", "leisure", "home"}
# формы глаголов и сокращения — не отдельные слова (входят в be / do / have)
FORMS = {"'m", "'re", "'s", "'ve", "'d", "'ll", "am", "are", "is", "was", "were", "did", "does", "doing", "done", "had",
         "has", "having", "been", "being", "n't"}
MODALS = {"can", "cannot", "could", "must", "should", "will", "would", "may", "might", "shall", "ought to", "have to",
          "need", "had better", "be able to", "used to"}
PLACE = set("""above below behind around across away back down downstairs upstairs up out outside inside indoors outdoors
far near nearby here there everywhere somewhere anywhere nowhere front left right north south east west opposite
between under over along through towards toward forward backwards ahead abroad overseas underneath beneath beside
within throughout among amid onto upward downward sideways aside apart""".split())
TIME = set("""ago again always already early late lately ever never often sometimes usually rarely seldom soon still yet
then now today tomorrow yesterday tonight once twice recently currently finally eventually immediately suddenly
meanwhile afterwards later before after since until while during formerly previously presently nowadays occasionally
frequently constantly daily weekly monthly yearly annually forever temporarily permanently instantly""".split())

POS_TOPIC = {"pron": "grammar", "prep": "grammar", "conj": "grammar", "det": "grammar", "part": "grammar",
             "interj": "phrases", "num": "numbers"}


def wn_pos(pos: str) -> str | None:
    return {"n": wn.NOUN, "v": wn.VERB, "adj": wn.ADJ, "adv": wn.ADV, "phv": wn.VERB}.get(pos)


def wordnet_topic(word: str, pos: str) -> tuple[str, str]:
    """(тема, подгруппа) по первому значению слова в WordNet."""
    p = wn_pos(pos)
    synsets = wn.synsets(word.replace(" ", "_"), pos=p) if p else wn.synsets(word.replace(" ", "_"))
    if not synsets:
        return "", ""
    s = synsets[0]
    lex = s.lexname()
    if lex.startswith("noun."):
        paths = {h.name() for path in s.hypernym_paths() for h in path}
        for hyp, topic in HYPERNYMS:
            if hyp in paths:
                return topic, hyp.split(".")[0]
        return NOUN.get(lex, ""), lex
    if lex.startswith("verb."):
        return VERB.get(lex, ""), lex
    # прилагательные и наречия: тема однокоренного существительного (medical → medicine → body)
    for lemma in s.lemmas():
        for rel in lemma.pertainyms() + lemma.derivationally_related_forms():
            rs = rel.synset()
            if rs.pos() == "n":
                t = NOUN.get(rs.lexname(), "")
                paths = {h.name() for path in rs.hypernym_paths() for h in path}
                t = next((topic for hyp, topic in HYPERNYMS if hyp in paths), t)
                if t in CONTENT:
                    return t, rs.lexname()
    if pos == "adv":
        return "manner", "adv"
    return describe_group(s)


# подгруппы «Описания» по «атрибуту» прилагательного в WordNet
LOOKS = {"size", "magnitude", "shape", "form", "color", "colour", "weight", "height", "length", "width", "age", "thickness",
         "dimension", "beauty", "appearance", "physical_property"}
SENSES = {"temperature", "sound", "loudness", "light", "brightness", "taste", "smell", "texture", "wetness", "speed",
          "hardness", "softness", "flavor"}
VALUES = {"quality", "goodness", "badness", "worth", "value", "importance", "significance", "excellence", "usefulness",
          "difficulty", "ease", "truth", "correctness", "rightness"}
CHARACTER = {"trait.n.01", "character.n.03", "personality.n.01", "disposition.n.01", "emotionality.n.01", "feeling.n.01"}


def describe_group(s) -> tuple[str, str]:
    synsets = [s, *s.similar_tos()]
    attrs = {a.name().split(".")[0] for x in synsets for a in x.attributes()}
    hyper = {h.name() for a in (a for x in synsets for a in x.attributes()) for path in a.hypernym_paths() for h in path}
    for lemma in s.lemmas():
        for rel in lemma.derivationally_related_forms():
            rs = rel.synset()
            if rs.pos() == "n":
                hyper |= {h.name() for path in rs.hypernym_paths() for h in path}
                attrs.add(rs.name().split(".")[0])
    if hyper & CHARACTER:
        return "feelings", "character"
    if attrs & LOOKS:
        return "describing", "1-looks"
    if attrs & SENSES:
        return "describing", "2-senses"
    if attrs & VALUES:
        return "describing", "3-values"
    return "describing", "4-other"


def load_overrides() -> dict[str, str]:
    out: dict[str, str] = {}
    path = Path(__file__).with_name("topic_overrides.txt")
    if not path.exists():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip() and not line.startswith("#") and ":" in line:
            topic, _, words = line.partition(":")
            for w in words.split(","):
                if w.strip():
                    out[w.strip().lower()] = topic.strip()
    return out


DESCRIBE_GROUPS = {"looks": "1-looks", "senses": "2-senses", "values": "3-values", "time": "5-time", "logic": "6-logic",
                   "degree": "7-degree", "domains": "8-domains", "describing": "4-other"}


def load_adj_groups() -> dict[str, tuple[str, str]]:
    """tools/v2/adj_groups.txt: прилагательное → (тема, подгруппа)."""
    out: dict[str, tuple[str, str]] = {}
    for line in Path(__file__).with_name("adj_groups.txt").read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("#") or ":" not in line:
            continue
        group, _, words = line.partition(":")
        group = group.strip()
        for w in words.split():
            w = w.replace("_", " ").lower()
            if group in ("character", "feelings"):
                out[w] = ("feelings", group)
            elif group in DESCRIBE_GROUPS:
                out[w] = ("describing", DESCRIBE_GROUPS[group])
            else:
                out[w] = (group, "manual")
    return out


ADJ = load_adj_groups()


def topic_of(c: dict, overrides: dict[str, str]) -> tuple[str, str, str]:
    """(тема, подгруппа, откуда)."""
    w = c["lemma"].lower()
    if w in overrides and not (overrides[w] in ("describing", "feelings") and w in ADJ):
        return overrides[w], "manual", "вручную"
    if w in ADJ and c["card"] != "phrase":
        return (*ADJ[w], "группы прилагательных")
    tags = [IELTS[t] for t in c.get("topics", "").split(",") if t in IELTS]
    if tags:
        return tags[0], "ielts", "IELTS"
    if c["card"] == "phrase":
        if c["source"] == "oxford-phrase":
            return "phrases", "oxford", "фраза Oxford"
        return "phrases", "", "фраза"
    if w in MODALS:
        return "grammar", "modal", "часть речи"
    if w in PLACE and c["pos"] in ("adv", "prep", "adj", ""):
        return "place", c["pos"], "словарь места"
    if w in TIME and c["pos"] in ("adv", "conj", "prep", ""):
        return "time", "adverb", "словарь времени"
    if c["pos"] in POS_TOPIC:
        return POS_TOPIC[c["pos"]], c["pos"], "часть речи"
    t, sub = wordnet_topic(w, c["pos"])
    # «предок» в WordNet (fever → symptom) точнее широких тем CEFR-J
    if t and sub and not sub.startswith(("noun.", "verb.", "adj.", "adv.")) and t != "describing":
        return t, sub, "WordNet"
    if c.get("cefrj_topic") in CEFRJ:
        return CEFRJ[c["cefrj_topic"]], "cefrj", "CEFR-J"
    if t:
        return t, sub, "WordNet"
    return ("actions" if c["pos"] == "v" else "describing" if c["pos"] in ("adj", "adv") else "events"), "", "по умолчанию"


TARGET, MIN_LESSON = 20, 8
DESCRIBE_TITLES = {
    "1-looks": ("Описание: размер, форма, внешний вид", "Describing: size, shape and looks"),
    "2-senses": ("Описание: ощущения — температура, звук, свет, вкус", "Describing: senses"),
    "3-values": ("Описание: оценка — хорошо или плохо", "Describing: good or bad"),
    "4-other": ("Описание: свойства и признаки", "Describing: qualities"),
    "5-time": ("Описание: время, новизна, возраст", "Describing: time and age"),
    "6-logic": ("Описание: сходство, точность, вероятность", "Describing: same, different, true"),
    "7-degree": ("Описание: количество и степень", "Describing: amount and degree"),
    "8-domains": ("Описание: общество, наука, право", "Describing: society and science"),
}
FEELINGS_TITLES = {"character": ("Характер и личность", "Character and personality"),
                   "feelings": ("Чувства и состояния", "Feelings and states")}


def lessons(cards: list[dict]) -> list[list[dict]]:
    """Тема уровня → уроки ~20 карточек: подгруппы по смыслу рядом, частотные раньше."""
    cards = sorted(cards, key=lambda c: (c["subgroup"], -(float(c["zipf"]) if c["zipf"] else 0)))
    n = max(1, round(len(cards) / TARGET))
    # равные части: 43 → 22 + 21, а не 22 + 21 + «хвост»
    base, extra = divmod(len(cards), n)
    out, i = [], 0
    for k in range(n):
        size = base + (1 if k < extra else 0)
        out.append(cards[i:i + size])
        i += size
    return out


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    cards = list(csv.DictReader(open(V2 / "wordlist.csv", encoding="utf-8-sig")))
    overrides = load_overrides()
    for c in cards:
        c["topic"], c["subgroup"], c["topic_source"] = topic_of(c, overrides)

    # маленькая тема на уровне (< MIN_LESSON карточек) — в соседнюю крупную
    FALLBACK = {"animals": "nature", "clothes": "home", "time": "numbers", "environment": "science", "law": "society",
                "economy": "shopping", "tech": "science", "objects": "home", "events": "mind", "idioms": "phrases",
                "phrasal": "actions", "essay": "mind", "manner": "describing", "place": "grammar", "numbers": "describing", "shopping": "economy", "home": "objects",
                "science": "mind", "society": "people", "arts": "leisure", "leisure": "arts", "education": "work",
                "work": "education", "city": "travel", "travel": "city", "communication": "mind", "feelings": "describing",
                "body": "people", "food": "home", "people": "feelings", "nature": "animals", "grammar": "describing",
                "phrases": "communication", "mind": "events", "actions": "events", "describing": "mind"}
    cards = [c for c in cards if c["lemma"].lower() not in FORMS and c["topic"] != "drop"]
    for lv in LEVELS:
        counts = Counter(c["topic"] for c in cards if c["level"] == lv)
        if counts["nature"] < MIN_LESSON or counts["animals"] < MIN_LESSON:
            for c in cards:
                if c["level"] == lv and c["topic"] == "animals":
                    c["topic"] = "nature"
        for _ in range(3):
            counts = Counter(c["topic"] for c in cards if c["level"] == lv)
            for c in cards:
                if c["level"] == lv and counts[c["topic"]] < MIN_LESSON:
                    c["topic"] = FALLBACK.get(c["topic"], "mind")

    # учебный порядок тем; общие темы (фразы, служебные слова, описание…) — вперемешку между тематическими
    STUDY_ORDER = ["people", "food", "home", "clothes", "body", "numbers", "time", "city", "travel", "shopping", "work",
                   "education", "leisure", "nature", "animals", "tech", "arts", "feelings", "communication", "society",
                   "economy", "law", "science", "environment", "objects", "events", "essay", "mind"]
    GENERAL = ["phrases", "grammar", "describing", "actions", "place", "manner", "phrasal", "idioms"]
    units = []
    for lv in LEVELS:
        by_topic = defaultdict(list)
        for c in cards:
            if c["level"] == lv:
                by_topic[c["topic"]].append(c)
        made: dict[str, list[dict]] = defaultdict(list)
        for topic in by_topic:
            for i, group in enumerate(lessons(by_topic[topic]), 1):
                uid = f"{lv}.{topic}.{i}"
                for c in group:
                    c["unit"] = uid
                sub = Counter(c["subgroup"] for c in group).most_common(1)[0][0]
                ru, en = TOPICS[topic]
                if topic == "describing" and sub in DESCRIBE_TITLES:
                    ru, en = DESCRIBE_TITLES[sub]
                elif topic == "feelings" and sub in FEELINGS_TITLES:
                    ru, en = FEELINGS_TITLES[sub]
                elif topic == "nature" and "animals" in by_topic:
                    ru, en = "Природа и погода", "Nature and weather"
                made[topic].append({"id": uid, "level": lv, "topic": topic, "n": i, "title": en, "titleRu": ru,
                                    "size": len(group), "words": " · ".join(c["lemma"] for c in group)})
        core = [u for t in STUDY_ORDER for u in made.get(t, [])]
        general = []
        # общие уроки по кругу: фраза, служебные, описание, действия …
        queues = [list(made.get(t, [])) for t in GENERAL]
        while any(queues):
            for q in queues:
                if q:
                    general.append(q.pop(0))
        seq, gi = [], 0
        step = (len(core) + len(general)) / max(1, len(general))
        for k, u in enumerate(core):
            seq.append(u)
            while gi < len(general) and (gi + 1) * step <= len(seq) + 1:
                seq.append(general[gi])
                gi += 1
        seq += general[gi:]
        for k, u in enumerate(seq, 1):
            u["seq"] = k
        units += seq

    fields = list(cards[0].keys())
    with open(V2 / "cards.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(cards)
    with open(V2 / "units.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(units[0].keys()))
        w.writeheader()
        w.writerows(units)
    print("уроков:", len(units), "| по уровням:", Counter(u["level"] for u in units))
    print("источник темы:", Counter(c["topic_source"] for c in cards))
    for lv in LEVELS:
        t = Counter(c["topic"] for c in cards if c["level"] == lv)
        print(lv.upper(), len(t), "тем:", ", ".join(f"{k} {v}" for k, v in t.most_common()))
    sizes = Counter(u["size"] for u in units)
    print("размеры уроков:", min(sizes), "–", max(sizes))


if __name__ == "__main__":
    main()
