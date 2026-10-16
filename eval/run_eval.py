"""
Grading accuracy evaluation.

Runs each test set through the same backend endpoints the app uses
(question paper -> rubric -> answer key -> handwriting OCR -> grading) and compares
the AI marks with reference marks.

Usage (backend running on :8000):
  backend/venv/bin/python eval/run_eval.py <test files dir> [--sets 2,3,4] [--out eval/results]

Expected layout of the test files dir:
  question paper/BDA_Set_<n>_Question_Paper.pdf
  rubrics/BDA_Set_<n>_Rubric.pdf
  answer key/BDA_Set_<n>_Answer_Key.pdf
  answer_sheets/Set<n>_Student<k>_<roll>_<name>.pdf
Reference marks: eval/bda_reference_marks.csv
The backend requires a login: set SMARTCHECK_SERVICE_TOKEN to the BACKEND_SERVICE_TOKEN
value in backend/.env.
"""

import argparse
import csv
import json
import os
import sys
import time
import uuid
import urllib.request
from pathlib import Path

API = "http://127.0.0.1:8000"
AUTH = {"X-Service-Token": os.environ["SMARTCHECK_SERVICE_TOKEN"]} if os.getenv("SMARTCHECK_SERVICE_TOKEN") else {}
HERE = Path(__file__).resolve().parent


def post_json(path, payload, timeout=900):
    req = urllib.request.Request(API + path, json.dumps(payload).encode(), {"Content-Type": "application/json", **AUTH})
    return json.load(urllib.request.urlopen(req, timeout=timeout))


def post_form(path, files=None, fields=None, timeout=900):
    boundary = uuid.uuid4().hex
    body = b""
    for name, value in (fields or {}).items():
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
    for name, path_ in (files or {}).items():
        data = Path(path_).read_bytes()
        body += (f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{Path(path_).name}"\r\n'
                 f"Content-Type: application/octet-stream\r\n\r\n").encode() + data + b"\r\n"
    body += f"--{boundary}--\r\n".encode()
    req = urllib.request.Request(API + path, body, {"Content-Type": f"multipart/form-data; boundary={boundary}", **AUTH})
    return json.load(urllib.request.urlopen(req, timeout=timeout))


def norm(label):
    return "".join(str(label).split()).upper()


def run_set(root: Path, n: int, log):
    qp = next((root / "question paper").glob(f"*Set_{n}_*"))
    rb = next((root / "rubrics").glob(f"*Set_{n}_*"))
    ak = next((root / "answer key").glob(f"*Set_{n}_*"))
    sheets = sorted((root / "answer_sheets").glob(f"Set{n}_*.pdf"))

    q = post_form("/ocr/extract-questions", {"file": qp})
    questions = q.get("questions", [])
    log(f"Set {n}: {len(questions)} questions via {q.get('engine')}: {[x['id'] for x in questions]}")

    r = post_form("/ocr/extract-rubric", {"file": rb})
    rubric = r.get("rubrics", [])
    kinds = {t: sum(1 for x in rubric if x.get("type", "criterion") == t) for t in ("criterion", "deduction", "guideline")}
    log(f"Set {n}: {len(rubric)} rubric rows via {r.get('engine')} {kinds}")

    guidelines = [x.get("description", "") for x in rubric if x.get("type") == "guideline"]
    spec = []
    for item in questions:
        rows = [x for x in rubric if norm(x.get("question_id")) == norm(item["id"])]
        crit = [{"criterion": x.get("criterion", ""), "description": x.get("description", ""), "marks": x.get("max_marks", 0)}
                for x in rows if x.get("type", "criterion") == "criterion"]
        rules = guidelines + [x.get("description", "") for x in rows if x.get("type") == "deduction"]
        spec.append({"label": item["id"], "text": item["text"], "max_marks": item.get("marks", 5), "criteria": crit, "rules": rules})
    k = post_form("/knowledge/build", {"file": ak}, {"questions": json.dumps(spec)})
    knowledge = k.get("knowledge", {})
    log(f"Set {n}: answer key split via {k.get('split_engine')}; missing {k.get('missing')}")
    for s in spec:
        kb = knowledge.get(s["label"], {})
        log(f"   {s['label']}: {len(s['criteria'])} rubric criteria -> {[(c['criterion'], c['marks'], len(c.get('concepts', []))) for c in kb.get('criteria', [])]}")

    labels = [s["label"] for s in spec]
    results = []
    for sheet in sheets:
        t0 = time.time()
        ocr = post_form("/ocr/process", {"file": sheet}, {"question_labels": json.dumps(labels)})
        answers = {norm(a): (a, t) for a, t in ocr.get("answers", {}).items()}
        confs = ocr.get("answer_confidences", {})
        payload = {"use_gemini": True, "answers": []}
        for s in spec:
            orig, text = answers.get(norm(s["label"]), (None, ""))
            kb = knowledge.get(s["label"], {})
            payload["answers"].append({
                "question_id": s["label"], "question_text": s["text"], "max_marks": s["max_marks"],
                "model_answer": kb.get("model_answer", ""), "criteria": kb.get("criteria", []), "rules": kb.get("rules", []),
                "student_answer": text, "ocr_confidence": confs.get(orig) if orig else None,
            })
        graded = post_json("/evaluation/evaluate", payload)["results"]
        results.append({
            "file": sheet.name, "ocr_engine": ocr.get("engine"), "ocr": ocr.get("answers", {}),
            "grades": {g["question_id"]: g for g in graded}, "seconds": round(time.time() - t0, 1),
        })
        log(f"   {sheet.name}: OCR {ocr.get('engine')} | " + ", ".join(
            f"{g['question_id']}={g['marks_awarded']}{'*' if g['needs_review'] else ''}({g['engine']})" for g in graded
        ) + f" | {results[-1]['seconds']}s")
    return {"set": n, "questions": spec, "knowledge": knowledge, "results": results}


def compare(all_sets, reference_csv: Path, log):
    ref = {row["file"]: row for row in csv.DictReader(reference_csv.open())}
    rows, diffs = [], []
    for s in all_sets:
        for res in s["results"]:
            r = ref.get(res["file"])
            if not r:
                continue
            for q in s["questions"]:
                label = q["label"]
                g = res["grades"].get(label, {})
                ai, expected = g.get("marks_awarded"), float(r[label])
                d = None if ai is None else round(ai - expected, 2)
                if d is not None:
                    diffs.append(d)
                rows.append({"set": s["set"], "student": r["student"], "question": label, "reference": expected,
                             "ai": ai, "diff": d, "needs_review": g.get("needs_review"), "engine": g.get("engine")})
    n = len(diffs)
    if n:
        mae = sum(abs(d) for d in diffs) / n
        within_half = sum(abs(d) <= 0.5 for d in diffs) / n
        within_one = sum(abs(d) <= 1 for d in diffs) / n
        bias = sum(diffs) / n
        log(f"\nAnswers compared: {n}\nMean absolute error: {mae:.2f} marks (of 5)\n"
            f"Within ±0.5: {within_half:.0%}   Within ±1: {within_one:.0%}\nBias (AI − reference): {bias:+.2f}")
        flagged_big = sum(1 for r in rows if r["diff"] is not None and abs(r["diff"]) > 1 and r["needs_review"])
        big = sum(1 for r in rows if r["diff"] is not None and abs(r["diff"]) > 1)
        log(f"Errors > 1 mark: {big}, of which flagged for review: {flagged_big}")
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("root")
    ap.add_argument("--sets", default="2,3,4")
    ap.add_argument("--out", default=str(HERE / "results"))
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    log_file = (out / "log.txt").open("w")

    def log(msg):
        print(msg)
        log_file.write(msg + "\n")
        log_file.flush()

    all_sets = [run_set(Path(args.root), int(n), log) for n in args.sets.split(",")]
    (out / "raw.json").write_text(json.dumps(all_sets, indent=2))
    rows = compare(all_sets, HERE / "bda_reference_marks.csv", log)
    with (out / "comparison.csv").open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    log(f"\nWrote {out}/raw.json, comparison.csv, log.txt")


if __name__ == "__main__":
    sys.exit(main())
