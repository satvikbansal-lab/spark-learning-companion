"""Independently recomputes every expected answer in tests/maths-cases.js with Python's exact Fraction type and
sympy, so a typo in a hand-written expectation can't silently turn a correct model answer into a "failure".

    python3 tests/verify_expected.py
"""
import json, subprocess, sys, os
from fractions import Fraction as F
import sympy as sp

here = os.path.dirname(os.path.abspath(__file__))
cases = json.loads(subprocess.check_output(['node', '-e', "const c=require('./tests/maths-cases.js');console.log(JSON.stringify(c,(k,v)=>v instanceof RegExp?String(v):v))"], cwd=os.path.dirname(here)))
x, y, a, b = sp.symbols('x y a b')

def to_frac(v):
    if isinstance(v, (list, tuple)):
        return [to_frac(i) for i in v]
    if isinstance(v, sp.Basic):
        v = sp.nsimplify(v)
        return F(int(v.p), int(v.q)) if v.is_Rational else v
    return F(v)

def flat(v):
    return [i for s in v for i in flat(s)] if isinstance(v, list) else [v]

bad, checked, skipped = [], 0, 0
for c in cases:
    if 'py' not in c:
        skipped += 1
        continue
    got = eval(c['py'], {'F': F, 'sp': sp, 'x': x, 'y': y, 'a': a, 'b': b})
    if 'expr' in c:
        e = sp.sympify(c['expr'].replace('^', '**').replace('x', '*x').replace('a', '*a').replace('b', '*b').replace('y', '*y').replace('(*', '(').lstrip('*').replace('+*', '+').replace('-*', '-'))
        ok = sp.expand(e - got) == 0
    else:
        want = sorted(F(v) for v in c['expect'])
        have = sorted(to_frac(i) for i in flat(got if isinstance(got, list) else [got]))
        ok = set(want) <= set(have) and set(have) <= set(want) | set(have)
        ok = ok and all(w in have for w in want) and all(h in want for h in have)
    checked += 1
    if not ok:
        bad.append((c['id'], c.get('expect') or c.get('expr'), str(got)))

print(f"{checked} expected answers recomputed, {skipped} cases without a single numeric answer (graded by rubric).")
for i, want, got in bad:
    print(f"MISMATCH {i}: expected {want}, python/sympy says {got}")
sys.exit(1 if bad else 0)
