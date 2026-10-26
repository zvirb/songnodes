with open('scrapers/requirements.txt', 'r') as f:
    lines = f.readlines()
with open('scrapers/requirements.txt', 'w') as f:
    for line in lines:
        if 'twisted' in line:
            f.write('twisted>=26.10.0\n')
        else:
            f.write(line)
