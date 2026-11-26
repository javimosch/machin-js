"""python3 corpus.py <out-dir> <git-repo>... : Markdown inputs from tracked .md files, plus random fragments."""
import json, subprocess, random, os, sys
docs = []
for repo in sys.argv[2:]:
    for f in subprocess.run(["git","-C",repo,"ls-files","*.md"],capture_output=True,text=True).stdout.splitlines():
        try: docs.append(open(os.path.join(repo,f),encoding="utf-8").read())
        except (OSError, UnicodeDecodeError): pass
random.seed(7)
chunks = []
for d in docs:
    parts = d.split("\n\n")
    for i in range(0, len(parts), 3): chunks.append("\n\n".join(parts[i:i+3]))
chunks = random.sample(chunks, min(3000, len(chunks)))
atoms = ["# ","## ","- ","* ","1. ","> ","```\n","`","**","*","_","~~","[","]","(",")","<",">","&","|","---","===","\n","\n\n"," ","  ","\t","\\","!","http://a.b/c?d=1&e=\"f\"","a@b.io","<div>","</div>","<!--","-->","é","ß","İ","中文","😀","𝔘","\u2028","\u00a0","\r\n","text","x","[^1]",": ","&amp;","&#128;","|---|:-:|\n","    ","- [ ] ","<script>"]
rand = ["".join(random.choice(atoms) for _ in range(random.randint(1,60))) for _ in range(3000)]
for name, items in [("docs",docs),("chunks",chunks),("random",rand)]:
    with open(f"{sys.argv[1]}/{name}.jsonl","w",encoding="utf-8") as f:
        for s in items: f.write(json.dumps([s.replace("\u0000","")],ensure_ascii=False).replace("\u2028","\\u2028").replace("\u2029","\\u2029")+"\n")
    print(name, len(items), "inputs", round(sum(len(s.encode()) for s in items)/1e6,2), "MB, largest", max(len(s.encode()) for s in items))
