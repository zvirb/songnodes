#!/usr/bin/env python3
"""Dependency-free reference linter. Usage: check.py <file|dir>... [--json]. Each finding cites a rule id from rules/rules.yaml."""
import re,sys,json,os
def sel(p): return lambda t,ln:[(i+1,m) for i,l in enumerate(t.split('\n')) if (m:=p.search(l))]
CHECKS=[ # (rule-hint, id, regex, applies-to extension tuple, message)
 ('COL','COL-HEX',r'(?<![\w&-])#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b(?![\w-]*\s*\{)',('.css','.html','.js'),'hex colour literal'),
 ('COL','COL-FN',r'\b(?:rgba?|hsla?)\(',('.css','.html'),'rgb/hsl colour function'),
 ('TYP','TYP-PX',r'font-size:\s*\d+(?:\.\d+)?px',('.css','.html'),'font-size in px'),
 ('TYP','TYP-FAM',r'font-family:\s*(?!var\()[^;]*(?:Arial|Helvetica|Roboto|Times)',('.css','.html'),'hard-coded font family'),
 ('LAY','LAY-Z',r'z-index:\s*\d+',('.css','.html'),'raw z-index'),
 ('MOT','MOT-DUR',r'(?:transition|animation)[^;{]*\b\d+(?:ms|s)\b',('.css','.html'),'raw duration'),
 ('FBK','FBK-DLG',r'\b(?:alert|confirm|prompt)\s*\(',('.js','.html'),'browser dialog'),
 ('WRT','WRT-EMO',r'[\U0001F300-\U0001FAFF☀-✔✖-➿]',('.html','.js','.css','.md'),'emoji'),
 ('WRT','WRT-BANG',r'>[^<>]*\w!(?:\s|<)',('.html',),'exclamation mark in copy'),
 ('WRT','WRT-DATE',r'toLocale(?:Date|Time)String',('.js','.html'),'locale date formatting instead of SongNodes.format'),
 ('A11Y','A11Y-OUTLINE',r'outline:\s*(?:none|0)\b',('.css','.html'),'focus outline removed'),
 ('A11Y','A11Y-IMG',r'<img(?![^>]*\balt=)[^>]*>',('.html',),'img without alt'),
 ('A11Y','A11Y-ICONBTN',r'<button(?![^>]*aria-label)[^>]*>\s*<svg',('.html',),'icon-only button without aria-label'),
 ('LAY','LAY-IMP',r'!important',('.css','.html'),'!important'),
 ('LAY','LAY-ID',r'^\s*#[a-z][\w-]*\s*\{',('.css','.html'),'id selector'),
 ('INP','INP-PLACEH',r'<input(?![^>]*\b(?:aria-label|id)=)[^>]*placeholder=',('.html',),'input labelled only by placeholder'),
 ('MOT','MOT-AUTOPLAY',r'\bautoplay\b',('.html',),'autoplay media'),
 ('NAV','NAV-HASHLINK',r'href="#"',('.html',),'dead link href="#"'),
 ('WRT','WRT-CAPS',r'>[^<>a-z]{6,}[A-Z]{3,}[^<>a-z]*<',('.html',),'ALL CAPS copy'),
 ('DATA','DATA-NULL',r'>\s*(?:N/A|null|undefined|NaN|Unknown(?:\s+[^<>]*)?)\s*<',('.html',),'raw missing-value text; use "–"'),
 ('WRT','WRT-CASE',r'(?:(?:<button\b|role=["\']tab["\']|class=["\'][^"\']*\bsn-tab\b)[^>]*>(?:<[^>]+>|\s)*|\b(?:label|title):\s*[\'"])[A-Z][a-z]+(?:\s+(?!(?:Spotify|Beatport|TIDAL|Rekordbox|Apple|MusicBrainz|Discogs|Deezer|SoundCloud|YouTube|Google|Camelot|SongNodes)\b)[A-Z][a-z]+)+(?:\s*(?:<[^>]+>|\s)*</(?:button|a|div|span)>|[\'"])',('.html',),'button or tab label in Title Case; use sentence case'),
]
def lint(path):
    t=open(path,encoding='utf-8',errors='ignore').read(); ext=os.path.splitext(path)[1]; out=[]
    for fam,cid,rx,exts,msg in CHECKS:
        if ext not in exts: continue
        for i,l in enumerate(t.split('\n')):
            if re.search(rx,l): out.append({'file':path,'line':i+1,'check':cid,'rule_family':fam,'message':msg})
    return out
if __name__=='__main__':
    args=[a for a in sys.argv[1:] if not a.startswith('--')];res=[]
    for a in args:
        if os.path.isdir(a):
            for d,_,fs in os.walk(a):
                for f in fs:
                    if f.endswith(('.css','.html','.js')): res+=lint(os.path.join(d,f))
        else: res+=lint(a)
    if '--json' in sys.argv: print(json.dumps(res,indent=1))
    else:
        for r in res: print(f"{r['file']}:{r['line']}  {r['check']}  {r['message']}")
        print(len(res),'findings')
    sys.exit(1 if res else 0)
