"""
Load one style from the MRKD ad styles kit into The Lab (public.style_kit_files,
migration 3400) so Ad Studio can render it. docs/ad-studio.md

    python3 scripts/style-kit/load_style.py EC /path/to/mrkd-ad-styles-kit/styles/EC-echo

Uses the Supabase management API (SQL endpoint). The access token is never in
this file: in Claude's cloud environment it is added by the network proxy; run
locally, set SUPABASE_ACCESS_TOKEN. One file per request (people photos ~1 MB).
Also makes the small person previews (thumbs/) and example previews.
"""
import base64, io, json, os, sys, urllib.request
from PIL import Image
REF = 'mhayvuxqrlwyvalceerw'
style, root = sys.argv[1], sys.argv[2]
def q(sql):
    req = urllib.request.Request(f'https://api.supabase.com/v1/projects/{REF}/database/query', data=json.dumps({'query': sql}).encode(),
        headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + os.environ.get('SUPABASE_ACCESS_TOKEN', 'proxy-injected')})
    try:
        return urllib.request.urlopen(req).read().decode()
    except urllib.error.HTTPError as e:
        return e.read().decode()
def put(path, kind, data):
    b = base64.b64encode(data).decode()
    out = q(f"insert into public.style_kit_files (path, style, kind, content) values ('{style}/{path}', '{style}', '{kind}', decode('{b}', 'base64')) "
            f"on conflict (path) do update set content = excluded.content, kind = excluded.kind, updated_at = now() returning size;")
    ok = '"size"' in out
    print(('ok  ' if ok else 'FAIL'), kind, path, len(data), '' if ok else out[:200])
    return ok
def thumb(src, w):
    im = Image.open(src)
    if im.mode in ('RGBA', 'LA'):
        bg = Image.new('RGB', im.size, (238, 234, 226)); bg.paste(im, mask=im.getchannel('A')); im = bg
        im = im.crop(Image.open(src).getchannel('A').getbbox())
    im.thumbnail((w, w)); buf = io.BytesIO(); im.convert('RGB').save(buf, 'JPEG', quality=82); return buf.getvalue()
code = os.path.join(root, 'code')
for dirpath, _, files in os.walk(code):
    for f in sorted(files):
        full = os.path.join(dirpath, f); rel = os.path.relpath(full, root)
        if '/people/' in '/' + rel + '/' or rel.startswith('code/people'):
            put(rel, 'person', open(full, 'rb').read())
            put('thumbs/' + f.replace('-cutout.png', '.jpg'), 'thumb', thumb(full, 260))
        elif f.endswith('.ttf') or f.endswith('.otf'): put(rel, 'font', open(full, 'rb').read())
        elif f.endswith('.json'): put(rel, 'config', open(full, 'rb').read())
        elif f.endswith('.py'): put(rel, 'code', open(full, 'rb').read())
ex = os.path.join(root, 'examples')
for f in sorted(os.listdir(ex))[:6]:
    put('examples/' + f.rsplit('.', 1)[0] + '.jpg', 'example', thumb(os.path.join(ex, f), 520))
put('BUILD.md', 'code', open(os.path.join(root, 'BUILD.md'), 'rb').read())
