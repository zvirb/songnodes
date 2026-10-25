with open('tests/requirements.txt', 'r') as f:
    lines = f.readlines()
with open('tests/requirements.txt', 'w') as f:
    for line in lines:
        if 'twisted' in line:
            f.write('twisted==26.10.0rc1\n')
        elif 'filelock' in line:
            f.write('filelock>=4.2.1\n')
        else:
            f.write(line)
