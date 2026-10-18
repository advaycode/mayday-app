"""
Generate docs/MEDICAL_SOURCES.md from the protocol files: every line the app
speaks, next to the guideline it comes from and whether that has been checked.
This is the document the CPR-certified reviewer signs off.

    python tools/medical_sources.py

Generated, never edited by hand: change the protocol JSON, then re-run.
"""
import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / "mobile" / "src" / "protocols" / "corpus"
SYSTEM = ROOT / "mobile" / "src" / "audio" / "systemLines.json"
OUT = ROOT / "docs" / "MEDICAL_SOURCES.md"
ORDER = ["cpr_adult", "cpr_child", "cpr_infant", "choking", "choking_infant", "bleeding", "stroke", "opioid_overdose", "burns", "recovery_position"]


def spoken(step):
    lines = list(step["say"])
    for key in ("resumeSay", "reminders", "breathsSay", "doneSay"):
        lines += step.get(key, [])
    if "depthSay" in step:
        lines.append(step["depthSay"])
    return lines


def main():
    sources = {s["id"]: s for s in json.loads((CORPUS / "sources.json").read_text(encoding="utf-8"))["sources"]}
    protocols = {}
    for f in CORPUS.glob("*.json"):
        d = json.loads(f.read_text(encoding="utf-8"))
        if d.get("$schema") == "mayday.protocol.v2":
            protocols[d["id"]] = d

    total = sum(len(p["steps"]) for p in protocols.values())
    verified = sum(s["verified"] for p in protocols.values() for s in p["steps"])
    out = [
        "# Medical sources",
        "",
        f"Generated {date.today().isoformat()} by `tools/medical_sources.py` from `mobile/src/protocols/corpus/`. Do not edit by hand.",
        "",
        f"**{total} protocol steps. {verified} are quoted word for word from a retrieved source. {total - verified} are awaiting review** "
        "(marked ⚠ below): the content is long-standing first-aid teaching, but the exact 2025 sentence could not be downloaded "
        "(ahajournals.org, cpr.heart.org and redcross.org block automated access). A CPR-certified reviewer should open each source "
        "in a browser, confirm or correct the step, and set `verified: true` with the quote.",
        "",
        "## For the reviewer",
        "",
        "1. Read each protocol's table top to bottom: it is the order a rescuer hears it.",
        "2. For every ⚠ row, find the sentence in the named source and either paste it into the step's `quote` or change the step.",
        "3. Check the flagged decisions at the end of this file.",
        "4. Sign and date the bottom of this file.",
        "",
        "## Sources",
        "",
        "| ID | Source | How we read it |",
        "|---|---|---|",
    ]
    method = {"local-copy": "Downloaded copy in `research/`", "direct-fetch": "Fetched directly", "search-excerpt": "Read through a search index (publisher blocks downloads)", "not-retrieved": "**Not retrieved**"}
    for s in sources.values():
        out.append(f"| `{s['id']}` | {s['title']}. {s['publisher']}. {s['url']} | {method[s['method']]} |")

    for pid in ORDER:
        p = protocols[pid]
        out += ["", f"## {p['title']} ({'Adult and child' if p.get('appliesTo') else p['ageGroup'].replace('any', 'any age')}) · v{p['version']}", "",
                "| Step | Screen | Spoken | Source | Quote or note |", "|---|---|---|---|---|"]
        for s in p["steps"]:
            mark = "" if s["verified"] else "⚠ "
            evidence = f"\"{s['quote']}\"" if s.get("quote") else f"_{s.get('note', '')}_"
            if s.get("quote") and s.get("note"):
                evidence += f"<br>_{s['note']}_"
            said = "<br>".join(spoken(s)).replace("|", "/")
            screen = s["text"] + (f"<br><small>{s['sub']}</small>" if s.get("sub") else "")
            out.append(f"| {mark}`{s['id']}` | {screen} | {said} | `{s['source']}` | {evidence.replace('|', '/')} |")

    answers = json.loads((ROOT / "mobile" / "src" / "voice" / "answers.json").read_text(encoding="utf-8"))["cards"]
    out += ["", "## Answers to open questions", "", "Spoken when someone asks a question mid-emergency (`mobile/src/voice/answers.json`).", "",
            "| Card | Asked as | Spoken | Source | Quote or note |", "|---|---|---|---|---|"]
    for c in answers:
        mark = "" if c["verified"] else "⚠ "
        evidence = f"\"{c['quote']}\"" if c.get("quote") else f"_{c.get('note', '')}_"
        scope = ", ".join(c["protocols"]) or "any"
        out.append(f"| {mark}`{c['id']}` ({scope}) | {c['ask'][0]}? | {'<br>'.join(c['say'])} | `{c['source']}` | {evidence.replace('|', '/')} |")

    system = json.loads(SYSTEM.read_text(encoding="utf-8"))
    out += ["", "## App lines (not medical instructions)", "",
            "Spoken outside protocol steps: confirmations, questions and status. None gives a medical instruction.", ""]
    for k, v in {**system["lines"], **system["confirm"]}.items():
        out.append(f"- `{k}`: {v}")

    out += [
        "",
        "## Decisions the reviewer should confirm",
        "",
        "1. **FAST instead of BE-FAST.** The 2024 AHA/Red Cross First Aid guidelines recommend FAST or the Cincinnati Prehospital Stroke Scale for lay recognition. The app uses FAST.",
        "2. **Burn cooling for severe burns.** MedlinePlus advises against putting a severe burn in cold water; the Red Cross advisory recommends cool running water for all thermal burns (10 minutes minimum, ideally 20, never past 40). The app follows the Red Cross and says \"cool running water\", never \"cold\" or \"soak\".",
        "3. **Adult CPR defaults to hands-only** if the rescuer does not answer the breaths question within 6 seconds.",
        "4. **Opioid overdose with abnormal breathing** goes to naloxone first (6-second question), then CPR. The 2024 guideline says both; it does not set an order. Confirm.",
        "",
        "## Sign-off",
        "",
        "Reviewed by: ______________________  Certification: ______________________  Date: __________",
    ]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}: {total} steps, {total - verified} awaiting review")


if __name__ == "__main__":
    main()
