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
 ('INP','INP-RANGE',r'<input\b[^>]*\btype=["\']?range\b',('.html',),'native input[type=range]; use RangeSlider (INP-125)'),
 ('INP','INP-STEPPER',r'<button\b(?![^>]*sn-number-field__step)[^>]*>\s*(?:−|\+|-|−1|\+1)\s*</button>',('.html',),'hand-built stepper button; use NumberField (INP-148)'),
 ('COG','COG-HOWWORKS',r'<(?:h[1-6]|summary|legend)\b[^>]*>(?:\s|<[^>]*>|[^<>]{0,40}:\s*)*How\s+(?:it|this(?:\s+\w+)?)\s+works\b',('.html',),'a "How this works" section; explanations are InfoTips and method text is the InfoTip panel (COG-103)'),
 ('FBK','FBK-TOASTALERT',r'<[^>]*class=["\'][^"\']*\bsn-toast(?:__region)?\b[^"\']*["\'][^>]*\brole=["\']alert["\']|<[^>]*\brole=["\']alert["\'][^>]*class=["\'][^"\']*\bsn-toast(?:__region)?\b',('.html',),'a toast with role="alert"; toasts are confirmations with role="status" (FBK-077)'),
 ('FBK','FBK-TIPTITLE',r'<button\b(?=[^>]*\bsn-infotip__btn\b)[^>]*\stitle=',('.html',),'title attribute on an InfoTip button (FBK-084)'),
 ('DATA','DATA-NULL',r'>\s*(?:N/A|null|undefined|NaN|Unknown(?:\s+[^<>]*)?)\s*<',('.html',),'raw missing-value text; use "–"'),
 ('WRT','WRT-CASE',r'(?:(?:<button\b|role=["\']tab["\']|class=["\'][^"\']*\bsn-tab\b)[^>]*>(?:<[^>]+>|\s)*|\b(?:label|title):\s*[\'"])[A-Z][a-z]+(?:\s+(?!(?:Spotify|Beatport|TIDAL|Rekordbox|Apple|MusicBrainz|Discogs|Deezer|SoundCloud|YouTube|Google|Camelot|SongNodes)\b)[A-Z][a-z]+)+(?:\s*(?:<[^>]+>|\s)*</(?:button|a|div|span)>|[\'"])',('.html',),'button or tab label in Title Case; use sentence case'),
]
SKIP={}
# INP-OVERRIDE / GOV-038: a page never carries its own copy or override of a design-system rule. Every sn- class the bundle defines is
# the design system's; a rule that selects one in a page stylesheet or a page's <style> block is a finding. The design system's own CSS
# (source/css/, components/bundle.css) is skipped: it is where the classes are defined.
OWN_CSS=re.compile(r'(?:^|/)source/css/|(?:^|/)bundle\.css$|(?:^|/)tokens\.css$')
SN_RULE=re.compile(r'^[^/@{}]*\.sn-[\w-]+[^{]*\{')
_BUNDLE=None
def bundle_classes():
    global _BUNDLE
    if _BUNDLE is None:
        here=os.path.dirname(os.path.abspath(__file__)); _BUNDLE=set()
        for c in (os.environ.get('SN_BUNDLE'),os.path.join(here,'..','components','bundle.css'),os.path.join(here,'bundle.css')):
            if c and os.path.exists(c):
                _BUNDLE=set(re.findall(r'\.(sn-[\w-]+)',re.sub(r'/\*.*?\*/','',open(c,encoding='utf-8',errors='ignore').read(),flags=re.S))); break
    return _BUNDLE
def override(path,t,ext):
    if OWN_CSS.search(path.replace(os.sep,'/')): return []
    known=bundle_classes(); out=[]; css=ext=='.css'
    for i,l in enumerate(t.split('\n')):
        if ext=='.html':
            parts=re.split(r'(<style\b[^>]*>|</style>)',l,flags=re.I); seg=''
            for x in parts:
                if re.match(r'<style\b',x,re.I): css=True
                elif re.match(r'</style>',x,re.I): css=False
                elif css: seg+=x+' '
            l=seg
        elif not css: continue
        for sel in re.findall(r'(?:^|[;{}])\s*([^;{}@/]*\.sn-[\w-]+[^;{}]*)\{',l):
            hit=[c for c in re.findall(r'\.(sn-[\w-]+)',sel) if not known or c in known]
            if hit: out.append({'file':path,'line':i+1,'check':'INP-OVERRIDE','rule_family':'INP','message':'page rule for a design-system class (.%s); change the design system instead (INP-149, GOV-038)'%hit[0]}); break
    return out
def lint(path):
    t=open(path,encoding='utf-8',errors='ignore').read(); ext=os.path.splitext(path)[1]; out=[]
    for fam,cid,rx,exts,msg in CHECKS:
        if ext not in exts: continue
        if cid in SKIP and SKIP[cid].search(path.replace(os.sep,'/')): continue
        for i,l in enumerate(t.split('\n')):
            if re.search(rx,l): out.append({'file':path,'line':i+1,'check':cid,'rule_family':fam,'message':msg})
    if ext in ('.css','.html'): out+=override(path,t,ext)
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
