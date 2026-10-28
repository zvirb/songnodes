#!/usr/bin/env python
import os
import sys
import argparse
import csv
from mutagen.easyid3 import EasyID3
from mutagen.mp3 import MP3
from mutagen.flac import FLAC

# Add root to pythonpath
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import importlib.util
spec = importlib.util.spec_from_file_location("key_bpm", os.path.join(os.path.dirname(__file__), "../services/audio-analysis/analysis_modules/key_bpm.py"))
key_bpm = importlib.util.module_from_spec(spec)
sys.modules["key_bpm"] = key_bpm
spec.loader.exec_module(key_bpm)
analyse_file = key_bpm.analyse_file
analyse = key_bpm.analyse
from services.common.metadata.camelot import to_camelot, relative_camelot
import essentia.standard as es

def get_tags(filepath):
    """Extract key and BPM from file tags."""
    tags = {'key': None, 'bpm': None}
    try:
        if filepath.lower().endswith('.mp3'):
            audio = MP3(filepath)
            # Try EasyID3 first
            try:
                easy_tags = EasyID3(filepath)
                if 'bpm' in easy_tags:
                    tags['bpm'] = easy_tags['bpm'][0]
            except Exception:
                pass

            if audio.tags:
                if 'TKEY' in audio.tags:
                    tags['key'] = audio.tags['TKEY'].text[0]
                elif 'initialkey' in audio.tags: # Some parsers expose this
                    tags['key'] = audio.tags['initialkey'].text[0]

                # Check for Mixed In Key style comments "8A - A minor"
                for key in audio.tags.keys():
                    if key.startswith('COMM'):
                        comment = audio.tags[key].text[0]
                        if '-' in comment and ('A' in comment.split('-')[0] or 'B' in comment.split('-')[0]):
                            parts = comment.split('-')
                            possible_camelot = parts[0].strip()
                            if to_camelot(possible_camelot):
                                tags['key'] = possible_camelot

                if 'TBPM' in audio.tags and not tags['bpm']:
                    tags['bpm'] = audio.tags['TBPM'].text[0]

        elif filepath.lower().endswith('.flac'):
            audio = FLAC(filepath)
            if 'bpm' in audio:
                tags['bpm'] = audio['bpm'][0]
            if 'initialkey' in audio:
                tags['key'] = audio['initialkey'][0]
    except Exception as e:
        print(f"Error reading tags from {filepath}: {e}")

    # Convert tags
    if tags['key']:
        tags['key'] = to_camelot(tags['key'])
    if tags['bpm']:
        try:
            tags['bpm'] = float(tags['bpm'])
        except ValueError:
            tags['bpm'] = None

    return tags

def main():
    parser = argparse.ArgumentParser(description="Benchmark audio analysis against tagged files.")
    parser.add_argument('folder', help="Folder containing audio files with key/BPM tags.")
    parser.add_argument('--csv', help="Output CSV file path.", default=None)
    parser.add_argument('--clip', type=float, help="Analyse only the first N seconds.", default=None)
    args = parser.parse_args()

    files = []
    for root, _, filenames in os.walk(args.folder):
        for f in filenames:
            if f.lower().endswith(('.mp3', '.flac', '.wav')):
                files.append(os.path.join(root, f))

    if not files:
        print(f"No audio files found in {args.folder}")
        return

    results = []

    for filepath in files:
        tags = get_tags(filepath)
        if not tags['key'] and not tags['bpm']:
            continue # Skip files without tags to benchmark against

        print(f"Processing {os.path.basename(filepath)}...")

        # Load and analyse
        if args.clip:
            try:
                # Need to load only clip
                loader = es.MonoLoader(filename=filepath, sampleRate=44100)
                audio = loader()
                clip_samples = int(args.clip * 44100)
                audio = audio[:clip_samples]
                analysis = analyse(audio, 44100)
            except Exception as e:
                print(f"Error processing {filepath}: {e}")
                continue
        else:
            analysis = analyse_file(filepath)

        res = {
            'filename': os.path.basename(filepath),
            'true_key': tags['key'],
            'true_bpm': tags['bpm'],
            'est_key': analysis['key_camelot'],
            'est_bpm': analysis['bpm'],
            'key_exact': False,
            'key_within_one': False,
            'bpm_within_1_percent': False,
            'bpm_double_half': False
        }

        # Check Key
        if tags['key'] and analysis['key_camelot']:
            if tags['key'] == analysis['key_camelot']:
                res['key_exact'] = True
                res['key_within_one'] = True
            else:
                # Check neighbors and relative
                t_num = int(tags['key'][:-1])
                t_let = tags['key'][-1]
                e_num = int(analysis['key_camelot'][:-1])
                e_let = analysis['key_camelot'][-1]

                # Relative major/minor
                if t_num == e_num and t_let != e_let:
                    res['key_within_one'] = True
                # +/- 1 on circle of fifths (same letter, +/-1 num mod 12)
                elif t_let == e_let and (abs(t_num - e_num) == 1 or abs(t_num - e_num) == 11):
                    res['key_within_one'] = True

        # Check BPM
        if tags['bpm'] and analysis['bpm']:
            diff_ratio = abs(tags['bpm'] - analysis['bpm']) / tags['bpm']
            if diff_ratio <= 0.01:
                res['bpm_within_1_percent'] = True

            # Check half/double
            if not res['bpm_within_1_percent']:
                half_diff = abs(tags['bpm'] / 2 - analysis['bpm']) / (tags['bpm'] / 2)
                double_diff = abs(tags['bpm'] * 2 - analysis['bpm']) / (tags['bpm'] * 2)
                if half_diff <= 0.01 or double_diff <= 0.01:
                    res['bpm_double_half'] = True

        results.append(res)

    if not results:
        print("No valid tagged files found to benchmark against.")
        return

    # Aggregate stats
    total_key = sum(1 for r in results if r['true_key'] is not None)
    total_bpm = sum(1 for r in results if r['true_bpm'] is not None)

    exact_keys = sum(1 for r in results if r['key_exact'])
    within_one_keys = sum(1 for r in results if r['key_within_one'])
    bpm_1_pct = sum(1 for r in results if r['bpm_within_1_percent'])
    bpm_dh = sum(1 for r in results if r['bpm_double_half'])

    print("\nBenchmark Results:")
    print("-" * 20)
    if total_key > 0:
        print(f"Key Exact: {exact_keys}/{total_key} ({(exact_keys/total_key)*100:.1f}%)")
        print(f"Key within 1 step/relative: {within_one_keys}/{total_key} ({(within_one_keys/total_key)*100:.1f}%)")
    if total_bpm > 0:
        print(f"BPM within +/- 1%: {bpm_1_pct}/{total_bpm} ({(bpm_1_pct/total_bpm)*100:.1f}%)")
        print(f"BPM off by double/half: {bpm_dh}/{total_bpm} ({(bpm_dh/total_bpm)*100:.1f}%)")

    # Save CSV
    if args.csv:
        with open(args.csv, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=[
                'filename', 'true_key', 'true_bpm', 'est_key', 'est_bpm',
                'key_exact', 'key_within_one', 'bpm_within_1_percent', 'bpm_double_half'
            ])
            writer.writeheader()
            for r in results:
                writer.writerow(r)
        print(f"Results saved to {args.csv}")

if __name__ == '__main__':
    main()
