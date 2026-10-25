import os

with open('services/graph-visualization-api/requirements.txt', 'r') as f:
    lines = f.readlines()
with open('services/graph-visualization-api/requirements.txt', 'w') as f:
    for line in lines:
        if 'ecdsa' in line:
            f.write('ecdsa>=0.19.0\n')
        elif 'python-jose' in line:
            f.write('python-jose>=3.3.0\n')
        else:
            f.write(line)
