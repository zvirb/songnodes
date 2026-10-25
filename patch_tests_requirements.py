with open('tests/requirements.txt', 'r') as f:
    lines = f.readlines()
with open('tests/requirements.txt', 'w') as f:
    for line in lines:
        if 'safety-schemas' in line:
            f.write('safety-schemas==0.0.16\n')
        else:
            f.write(line)
