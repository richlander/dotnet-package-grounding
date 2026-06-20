import json, os, glob, sys
sys.path.insert(0, 'eng')
from rescore import arm_iet, q, clamp, W_QUALITY, W_COST, DEFAULT_OUTPUT_MULT

LIB = {'CommandLine': 'SCL', 'System.CommandLine': 'SCL', 'McMaster': 'SCL',
       'Text.Json': 'STJ', 'Newtonsoft': 'STJ', 'Native AOT': 'STJ', 'AOT': 'STJ',
       'Extensions.AI': 'M.E.AI'}


def lib_of(name):
    for k, v in LIB.items():
        if k in name:
            return v
    return '?'


def pct(x):
    return f"{x*100:+.1f}%" if x is not None else "   n/a"


w = DEFAULT_OUTPUT_MULT
rows = []
for d in sorted(glob.glob('.skill-validator-results/*')):
    f = os.path.join(d, 'results.json')
    if not os.path.isfile(f):
        continue
    j = json.load(open(f))
    model = j.get('model') or '?'
    for v in j.get('verdicts', []):
        for s in v.get('scenarios', []):
            name = s.get('name') or s.get('scenarioName') or ''
            base = s.get('baseline')
            if not base:
                continue
            bq = q(base)
            biet = arm_iet(base['metrics'], w)
            arms = {}
            for a in ('skilledIsolated', 'skilledPlugin'):
                if s.get(a):
                    m = s[a]
                    dq = q(m) - bq
                    iet = arm_iet(m['metrics'], w)
                    cr = clamp((biet - iet) / biet) if biet else 0
                    arms[a] = (dq, cr, W_QUALITY * clamp(dq) + W_COST * cr)
            if not arms:
                continue
            gate = min(arms.values(), key=lambda t: t[2])
            best = max(arms.values(), key=lambda t: t[2])
            rows.append((lib_of(name), name[:48], model.replace('claude-', ''),
                         bq * 5, s.get('improvementScore'), gate[0], gate[1],
                         gate[2], best[1], biet, os.path.basename(d)))

rows.sort(key=lambda r: (r[0], r[1], r[10]))
hdr = f"{'lib':<7}{'scenario':<50}{'agent':<13}{'baseQ':>6}{'harness':>9}{'gate dQ':>9}{'gate cRed':>10}{'OUR':>8}{'best cRed':>10}"
print(hdr)
print('-' * len(hdr))
last = None
for r in rows:
    if last and last != r[0]:
        print()
    last = r[0]
    print(f"{r[0]:<7}{r[1]:<50}{r[2]:<13}{r[3]:>6.1f}{pct(r[4]):>9}{pct(r[5]):>9}{pct(r[6]):>10}{pct(r[7]):>8}{pct(r[8]):>10}")
