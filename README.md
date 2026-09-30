# Least Count - Split Project + Game History Database

Main game entry: `index.html`

Additional page: `game-history.html`

Full updated single-file version: `least_count_full_features.updated.html`

## Game history database behavior

The host writes game history to:
`https://hmfeeaejffcbqyihshre.supabase.co/rest/v1/least_count_game_history`

For each completed round the code checks for an existing row using both `game_host` and `game_code`.
- Existing row: PATCH/update that row.
- No matching row: POST a new row.

Only the host performs the write, preventing every player from creating duplicate history rows.

The same row is updated with the final winner when the tournament ends.
