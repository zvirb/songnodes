with open('tests/requirements.txt', 'r') as f:
    lines = f.readlines()
with open('tests/requirements.txt', 'w') as f:
    for line in lines:
        if 'safety==' in line:
            f.write('safety==3.8.1\n')
        elif 'safety-schemas==' in line:
            f.write('safety-schemas==0.0.16\n')
        elif 'typer' in line:
            f.write('typer>=0.12.0\n')
        else:
            f.write(line)
