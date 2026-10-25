with open('tests/requirements.txt', 'r') as f:
    lines = f.readlines()
with open('tests/requirements.txt', 'w') as f:
    for line in lines:
        if 'typer' in line:
            f.write('typer>=0.15.0\n')
        elif 'safety==' in line:
            f.write('safety==3.10.1\n')
        else:
            f.write(line)
