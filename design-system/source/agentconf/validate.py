#!/usr/bin/env python3
"""Pre-commit validation: rebuild, schema check, fixture detection, INDEX length, ADR links, guideline traceability."""
import subprocess,sys,json,os,yaml,re
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..'))
fail=[]
b=subprocess.run([sys.executable,'source/agentconf/build_agentconf.py'],capture_output=True,text=True)
if ' 0 errors' not in b.stdout: fail.append('rule schema errors:\n'+b.stdout[-800:])
exp=json.load(open('fixtures/violations.expected.json',encoding='utf-8'))
r=json.loads(subprocess.run([sys.executable,'linters/check.py','fixtures/violations.html','--json'],capture_output=True,text=True).stdout)
got={x['check'] for x in r}
if got!=set(exp['expected_checks']): fail.append('fixture detection mismatch: missing %s'%(set(exp['expected_checks'])-got))
if len(got)<20: fail.append('fixture detects fewer than 20 violation kinds')
n=len(open('INDEX.md',encoding='utf-8').read().splitlines())
if n>250: fail.append(f'INDEX.md {n} lines > 250')
rules=yaml.safe_load(open('rules/rules.yaml',encoding='utf-8')); ids={x['id'] for x in rules}
for x in rules:
    if x['status']=='deprecated' and x['replaced_by'] not in ids: fail.append('deprecated without replaced_by '+x['id'])
    if x['history_ref'] and not os.path.exists(f"history/decisions/{x['history_ref'].replace('DR','ADR')}.md"): fail.append('missing ADR for '+x['id'])
src=yaml.safe_load(open('rules/sources.yaml',encoding='utf-8')); cited={re.split(r'[:#]',s.strip())[0] for v in src.values() for s in str(v).split(';')}
for f in sorted(os.listdir('.')):
    if re.match(r'\d\d-.*\.md$',f) and f not in cited: fail.append('guideline not traced: '+f)
print('PASS: %d rules, fixture 20/20, INDEX %d lines'%(len(rules),n) if not fail else 'FAIL')
print('\n'.join(fail)); sys.exit(1 if fail else 0)
