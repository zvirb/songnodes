import os

# Fix scrapers/requirements.txt
with open('scrapers/requirements.txt', 'r') as f:
    lines = f.readlines()
with open('scrapers/requirements.txt', 'w') as f:
    for line in lines:
        if 'python-dateutil' in line:
            f.write('python-dateutil>=2.8.2\n')
        else:
            f.write(line)

# Fix services/audio-analysis/requirements.txt
with open('services/audio-analysis/requirements.txt', 'r') as f:
    lines = f.readlines()
with open('services/audio-analysis/requirements.txt', 'w') as f:
    for line in lines:
        if 'librosa' in line:
            f.write('librosa==0.10.1\n')
        else:
            f.write(line)

# Fix tests/requirements.txt
with open('tests/requirements.txt', 'r') as f:
    lines = f.readlines()
with open('tests/requirements.txt', 'w') as f:
    for line in lines:
        if 'safety-schemas' in line:
            f.write('safety-schemas==0.0.16\n')
        else:
            f.write(line)
