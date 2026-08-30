# Sample CSVs

Seven files for exercising the importer at **Add people → A whole list** (`/add?tab=csv`).
Every one of them is meant to be dropped in as-is.

| File | What it tests |
| --- | --- |
| `01-minimal-names-only.csv` | The smallest valid file: one column of names, nothing else. |
| `02-typical-church-list.csv` | The ordinary case — name, phone, email, status words, notes. |
| `03-odd-headers-messy.csv` | Headers the importer has to guess at ("Full name", "Where they are on the journey"), a quoted comma inside a name, a blank status. |
| `04-numeric-status.csv` | Status given as the ladder number 1–8 instead of a word. |
| `05-unknown-status-words.csv` | Words that are *not* on the ladder ("Warm contact", "On the fence"). The importer asks what each one means instead of guessing. |
| `06-extra-columns-and-dupes.csv` | Columns Tend does not want (Ref, Age, Home group), a repeated row, and a row with no name. |
| `07-semicolon-and-quotes.csv` | Semicolon delimiter, escaped quotes, a semicolon inside a quoted field. |

## How the import actually works

1. **Reading.** The file is parsed in the browser. The delimiter is detected, so
   comma and semicolon files both work. The first row is treated as headers; blank
   rows are dropped. Up to 500 rows are read.
2. **Column guessing.** Each header is matched against a list of patterns —
   `email`, `phone|mobile|cell|tel|number`, `name|person|who`,
   `status|stage|step|where|journey|walk|faith|ladder`,
   `note|notes|comment|about|detail|met|background`. The first column that fits a
   slot takes it; everything else defaults to **Skip this column**. Nothing is
   locked in: each column has a dropdown, and picking a target frees whichever
   column held it before.
3. **Status matching.** Every distinct value in the status column is looked at once.
   A leading digit 1–8 wins outright. Otherwise it is compared against the eight
   ladder names and a vocabulary of the phrases churches actually write
   ("not a believer", "curious", "came once", "comes sometimes", "weekly",
   "baptised", "volunteers", "runs a group", …). The longest matching phrase wins,
   so "not a believer" can never be read as "believer".
4. **Unknown values.** Anything that matches nothing becomes a question, not a
   guess: a banner per value with a dropdown — set those rows to a step, or leave
   them out of the import entirely.
5. **The preview.** Before anything is written you see the file card (rows,
   columns, size), three sample values per column, the value → step mapping, and a
   running count of "N will be added · M skipped". Rows are skipped when the name
   is already on your list, when the same name repeats inside the file, when the
   row has no name, or when you chose to leave that status out.
6. **The write.** One transaction. Duplicates are checked *again* against the
   database at this point, because the browser's copy of your list can be stale.
   Interval and priority are set once for the whole batch from the two dropdowns
   at the bottom. Each person gets a system note recording the filename and date;
   a mapped notes column becomes a first note.
7. **Undo.** An import is one thing, so undoing it is one thing. The banner on the
   people list removes exactly the people that import created, for 24 hours.
   Anything added by hand afterwards is untouched.

The only hard requirement is a name column. Status, phone, email and notes are
read if present and ignored if not.
