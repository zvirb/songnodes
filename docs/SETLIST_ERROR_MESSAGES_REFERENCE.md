# SetlistBuilder Error Messages - Quick Reference

## Import Operation

| Error Case | Message | Trigger |
|------------|---------|---------|
| Empty Data | "Import failed: No data provided. Please paste your setlist JSON data." | User clicks Import without pasting data |
| Invalid JSON | "Import failed: Invalid JSON format. Please check your data and try again." | Malformed JSON syntax |
| Invalid Data Type | "Import failed: Invalid setlist format. Data must be a valid JSON object." | JSON is not an object (e.g., array, string) |
| Missing Name | "Import failed: Missing or invalid setlist name. Please ensure the JSON includes a valid 'name' field." | No `name` field or invalid type |
| Missing Tracks | "Import failed: Missing or invalid tracks array. Please ensure the JSON includes a 'tracks' array." | No `tracks` field or not an array |
| Empty Tracks | "Import failed: Setlist contains no tracks. Please import a setlist with at least one track." | Tracks array is empty |
| File Too Large | "Import failed: File is too large (X.XX MB). Maximum size is 10MB." | Data exceeds 10MB |
| Invalid Tracks | "Import failed: No valid tracks found in the data. Each track must have id, name, and artist fields." | All tracks missing required fields |
| Creation Failed | "Import failed: Could not create setlist. Please try again or contact support." | setlist.createNewSetlist() throws error |
| No Tracks Added | "Import failed: Could not add any tracks to the setlist. Please check the data format." | All track additions fail |
| Unexpected Error | "Import failed: An unexpected error occurred. [error message]" | Any uncaught exception |

## Export Operation

| Error Case | Message | Trigger |
|------------|---------|---------|
| No Setlist | "Export failed: No setlist to export. Please create a setlist first." | currentSetlist is null |
| Empty Setlist | "Export failed: Setlist has no tracks. Add tracks before exporting." | Setlist has no tracks |
| Creation Failed | "Export failed: Could not create export file. [error message]" | Blob/download creation fails |

## Save Operation

| Error Case | Message | Trigger |
|------------|---------|---------|
| No Setlist | "Save failed: No setlist to save. Please create a setlist first." | currentSetlist is null |
| Empty Setlist | "Save failed: Cannot save an empty setlist. Add at least one track before saving." | Setlist has no tracks |
| Save Failed | "Save failed: Could not save setlist. [error message]" | saveCurrentSetlist() throws error |

## Create Setlist Operation

| Error Case | Message | Trigger |
|------------|---------|---------|
| Name Too Long | "Create failed: Setlist name is too long (max 100 characters)." | Name length > 100 |
| Creation Failed | "Create failed: Could not create setlist. [error message]" | createNewSetlist() throws error |

## Update Name Operation

| Error Case | Message | Trigger |
|------------|---------|---------|
| No Setlist | "Update failed: No setlist to update. Please create a setlist first." | currentSetlist is null |
| Empty Name | "Update failed: Setlist name cannot be empty." | Name is empty or whitespace |
| Name Too Long | "Update failed: Setlist name is too long (max 100 characters)." | Name length > 100 |
| Update Failed | "Update failed: Could not update setlist name. [error message]" | loadSetlist() throws error |

## Remove Track Operation

| Error Case | Message | Trigger |
|------------|---------|---------|
| Remove Failed | "Remove failed: Could not remove track from setlist. [error message]" | removeTrackFromSetlist() throws error |

## Error Display Behavior

- **Display Duration**: 7 seconds (auto-dismiss)
- **Manual Dismiss**: Click × button
- **Display Location**: Top of SetlistBuilder component
- **Styling**: Red background (`bg-red-50`), red border (`border-red-200`), red text (`text-red-800`)
- **Console Logging**: All errors logged with prefix "SetlistBuilder Error:"

## Validation Rules

| Field | Rule | Error |
|-------|------|-------|
| Setlist Name | Max 100 characters | "name is too long (max 100 characters)" |
| Setlist Name | Cannot be empty | "name cannot be empty" |
| Import File Size | Max 10MB | "File is too large" |
| Track Fields | Must have id, name, artist | "Each track must have id, name, and artist fields" |
| Tracks Array | Must have at least 1 track | "contains no tracks" |

## Testing Quick Checklist

- [ ] Empty data import
- [ ] Invalid JSON import
- [ ] Missing name field
- [ ] Missing tracks array
- [ ] Empty tracks array
- [ ] Invalid track structure
- [ ] Large file import
- [ ] Export with no setlist
- [ ] Export with empty setlist
- [ ] Save with no setlist
- [ ] Save with empty setlist
- [ ] Create with long name
- [ ] Update with empty name
- [ ] Update with long name
- [ ] Error auto-dismiss (7s)
- [ ] Error manual dismiss (×)
- [ ] Multiple errors (replacement)

## Example Valid Import JSON

```json
{
  "name": "My Setlist",
  "tracks": [
    {
      "track": {
        "id": "uuid-1",
        "name": "Track 1",
        "artist": "Artist 1",
        "bpm": 128,
        "key": "Am"
      },
      "position": 0
    },
    {
      "track": {
        "id": "uuid-2",
        "name": "Track 2",
        "artist": "Artist 2",
        "bpm": 130,
        "key": "G"
      },
      "position": 1
    }
  ],
  "created_at": "2025-10-10T00:00:00.000Z"
}
```

## Common User Mistakes

1. **Pasting CSV instead of JSON** → Invalid JSON format error
2. **Pasting partial JSON** → Missing required fields error
3. **Trying to export empty setlist** → Empty setlist error
4. **Using very long setlist names** → Name too long error
5. **Importing without pasting data** → No data provided error

## Developer Notes

- All error handlers use try-catch blocks
- Error messages follow consistent format: "Operation failed: Reason. Suggested action."
- Console logs include detailed error information
- User messages hide technical details
- Validation happens before state mutations
- Failed operations don't leave partial state

## Update History

- 2025-10-10: Initial implementation with 28 total error cases
