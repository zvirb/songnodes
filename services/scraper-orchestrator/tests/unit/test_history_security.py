import json

def parse_history_entry(h):
    if isinstance(h, str):
        return json.loads(h)
    return h

def test_parse_history_entry_valid_json():
    entry_str = '{"status": "success", "timestamp": "2026-10-25T00:00:00"}'
    parsed = parse_history_entry(entry_str)
    assert parsed == {"status": "success", "timestamp": "2026-10-25T00:00:00"}

def test_parse_history_entry_dict():
    entry_dict = {"status": "success"}
    parsed = parse_history_entry(entry_dict)
    assert parsed == {"status": "success"}
