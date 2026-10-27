with open('frontend/design-system-pending.txt', 'r') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if line.startswith('<<<<<<<') or line.startswith('=======') or line.startswith('>>>>>>>'):
        continue
    # Keep the commented out lines if there is conflict.
    new_lines.append(line)

# Remove duplicates while maintaining order
seen = set()
deduped_lines = []
for line in new_lines:
    if line not in seen:
        seen.add(line)
        deduped_lines.append(line)

with open('frontend/design-system-pending.txt', 'w') as f:
    f.writelines(deduped_lines)
