import numpy as np

def generate_synthetic_audio(bpm, key_name, duration=30.0, sample_rate=44100):
    num_samples = int(duration * sample_rate)
    t = np.linspace(0, duration, num_samples, endpoint=False)

    beat_interval = 60.0 / bpm
    audio = np.zeros(num_samples, dtype=np.float32)

    # 1. 4-on-the-floor kick (strong impulse)
    kick_samples = int(0.1 * sample_rate)
    t_kick = np.linspace(0, 0.1, kick_samples, endpoint=False)
    kick_env = np.exp(-30.0 * t_kick)
    kick = np.sin(2 * np.pi * 60 * t_kick) * kick_env

    # 2. Hi-hats (off-beat)
    hat_samples = int(0.05 * sample_rate)
    t_hat = np.linspace(0, 0.05, hat_samples, endpoint=False)
    hat_env = np.exp(-50.0 * t_hat)
    hat = np.random.normal(0, 1, hat_samples) * hat_env

    # 3. Claps (on every 2nd beat)
    clap_samples = int(0.15 * sample_rate)
    t_clap = np.linspace(0, 0.15, clap_samples, endpoint=False)
    clap_env = np.exp(-20.0 * t_clap)
    clap = np.random.normal(0, 1, clap_samples) * clap_env

    # 4. Sustained chord progression
    midi_map = {'C': 60, 'Db': 61, 'D': 62, 'Eb': 63, 'E': 64, 'F': 65,
                'Gb': 66, 'G': 67, 'Ab': 68, 'A': 69, 'Bb': 70, 'B': 71}
    parts = key_name.split()
    tonic = parts[0]
    mode = parts[1].lower() if len(parts) > 1 else 'major'
    base_midi = midi_map.get(tonic, 60)
    intervals = [0, 3, 7] if mode == 'minor' else [0, 4, 7]

    chord_audio = np.zeros(num_samples, dtype=np.float32)
    for interval in intervals:
        freq = 440.0 * (2.0 ** ((base_midi + interval - 69) / 12.0))
        chord_audio += 0.2 * np.sin(2.0 * np.pi * freq * t)

    audio += chord_audio

    num_beats = int(duration / beat_interval) + 1
    for i in range(num_beats):
        # Kick on every beat
        start_idx_kick = int(round(i * beat_interval * sample_rate))
        if start_idx_kick < num_samples:
            end_idx = min(start_idx_kick + kick_samples, num_samples)
            audio[start_idx_kick:end_idx] += kick[:end_idx - start_idx_kick]

        # Hat on off-beat
        start_idx_hat = int(round((i + 0.5) * beat_interval * sample_rate))
        if start_idx_hat < num_samples:
            end_idx = min(start_idx_hat + hat_samples, num_samples)
            audio[start_idx_hat:end_idx] += 0.5 * hat[:end_idx - start_idx_hat]

        # Clap on 2nd and 4th beat
        if i % 2 == 1:
            start_idx_clap = int(round(i * beat_interval * sample_rate))
            if start_idx_clap < num_samples:
                end_idx = min(start_idx_clap + clap_samples, num_samples)
                audio[start_idx_clap:end_idx] += 0.8 * clap[:end_idx - start_idx_clap]

    max_val = np.max(np.abs(audio))
    if max_val > 0:
        audio = audio / max_val * 0.9

    return audio.astype(np.float32)
