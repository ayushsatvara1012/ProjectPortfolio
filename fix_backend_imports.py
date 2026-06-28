import re
import os

files_to_fix = []
for root, _, files in os.walk('sapybase_ai_engine'):
    for f in files:
        if f.endswith('.py'):
            files_to_fix.append(os.path.join(root, f))

for filepath in files_to_fix:
    with open(filepath, 'r') as f:
        content = f.read()
    
    # We want to change "import api.routers.byod_admin" to "from api.routers import byod_admin"
    # and "import db.byod_store" to "from db import byod_store"
    # because the code uses "byod_admin.foo" and "byod_store.bar".
    
    # General regex: import a.b.c -> from a.b import c (if used like c.foo)
    # Wait, the code was originally "import byod_admin". I replaced it with "import api.routers.byod_admin".
    # I should change "import api.routers.byod_admin" -> "from api.routers import byod_admin"
    
    new_content = re.sub(r'^import (api\.routers|core|services|db|utils)\.([a-zA-Z0-9_]+)$', r'from \1 import \2', content, flags=re.MULTILINE)
    
    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Fixed {filepath}")
