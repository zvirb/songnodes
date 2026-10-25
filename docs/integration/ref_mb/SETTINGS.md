# Configuration Settings for `ref_mb`

The `ref_mb` database integration is configured via environment variables. This prevents credentials from being hardcoded or accidentally logged.

## Variables

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `MB_LOCAL_ENABLED` | `false` | Set to `true`, `1`, or `yes` to enable connecting to the local MusicBrainz reference database. |
| `MB_LOCAL_HOST` | `host.docker.internal` | The host of the Postgres server hosting the `ref_mb` database. |
| `MB_LOCAL_PORT` | `55433` | The port for the Postgres server. |
| `MB_LOCAL_DATABASE` | `ref_mb` | The database name. |
| `MB_LOCAL_SCHEMA` | `ref_mb` | The schema name. |
| `MB_LOCAL_USER` | `ref_mb_reader` | The database user, which must only have read privileges. |
| `MB_LOCAL_STATEMENT_TIMEOUT_MS` | `2000` | The statement timeout applied to connections (in milliseconds). |
| `MB_LOCAL_PASSWORD_FILE` | (none) | Path to a file containing the password. (Recommended) |
| `MB_LOCAL_PASSWORD` | (none) | Password to use. |

## Important Security Rules
- Passwords **must never be committed** to the repository.
- Use `MB_LOCAL_PASSWORD_FILE` (mapped as a Docker secret or mounted file) on the host machine to provide the database password.
- Do not log the instantiated `RefMBSettings` object or include the password in debugging output.
