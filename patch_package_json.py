import json

with open('frontend/package.json', 'r') as f:
    data = json.load(f)

# The frontend Dockerfile `npm ci` step is failing due to an ERESOLVE dependency conflict for `@typescript-eslint/eslint-plugin`.
# We need to downgrade it to something compatible with typescript 6.0.3, or update typescript. Let's downgrade the plugin
# to 8.7.0 (or just pass --legacy-peer-deps, but since we can't easily change the Dockerfile without breaking other things, let's patch package.json).
# Actually, the error says `@typescript-eslint/eslint-plugin@8.72.0` requires `typescript@">=4.8.4 <6.1.0"` but typescript is `6.0.3` which should theoretically fit in that semver range in regular circumstances EXCEPT that there is another conflict `Found: typescript@7.0.2` somewhere. Wait, `npm error Found: typescript@7.0.2`.
# Let's just fix it by forcing `typescript` to `^5.0.0` or something that is fully compliant.
# Wait, `typescript` 7.0.2 is in `dev typescript@"^7.0.2" from the root project`.
# Wait, `typescript@"^6.0.3"` is what is in package.json but npm resolves it to `7.0.2`? No, typescript is currently at version 5.x.
# Oh, the error says:
# `dev typescript@"^7.0.2" from the root project`
# Let's just change typescript to `~5.5.4` which is the current stable v5 branch, and see.

data['devDependencies']['typescript'] = '~5.5.4'
data['devDependencies']['@typescript-eslint/eslint-plugin'] = '^8.0.0'
data['devDependencies']['@typescript-eslint/parser'] = '^8.0.0'

with open('frontend/package.json', 'w') as f:
    json.dump(data, f, indent=2)
