// A faster drop-in for csv-reader 1.0.0: run(input) returns exactly csv-reader's
// answer {columns, rows, errors} for every {text, header}, but reads the text
// with jumps instead of one character at a time.
//
// The reading policy is csv-reader's own, restated from its behaviour:
//   - a U+FEFF at the very start is dropped;
//   - a record ends at LF or CRLF, and a line left with no characters is no record;
//   - outside quotes a CR not followed by LF is dropped (stray_cr);
//   - a field that opens with a quote runs to the next quote that is not
//     doubled, "" inside it one quote, each CRLF or lone CR inside it read as
//     LF; what follows its closing quote, up to the next comma or line break,
//     is appended as it stands (quote_junk, when the field ends); a quote that
//     never closes is a literal character, and the text after it is read again
//     as unquoted (unterminated_quote);
//   - a quote inside an unquoted field is a literal character;
//   - fields stay strings, never trimmed or converted;
//   - columns is the first record when header is true, else null; rows holds
//     the records after it (every record when header is false), each padded
//     with "" (short_row, with fields: its field count) or cut (long_row, with
//     extra: the cut fields) to the first record's width;
//   - each error is {code, line, row}, in the order met: line the 1-based line
//     its record starts on, row its record's index in rows, null for the header.
//
// Speed comes from never walking a plain field character by character: an
// unquoted field is found by indexOf for its terminator and taken with one
// slice, and a quoted field by indexOf for its closing quote. Only the rare
// broken pieces (a stray CR, a doubled quote, a line break inside quotes)
// take a slower path, and only for that one field.

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const len = text.length;
  let pos = 0;
  let line = 1;
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it
  // takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  function error(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Reads unquoted characters onto `value` up to the next comma or line
  // break: a CR not followed by LF is dropped (stray_cr). Returns the field
  // and how it ended; `added` counts the characters kept after `value`.
  function readPlain(value) {
    let added = 0;
    while (pos < len) {
      const cIdx = text.indexOf(',', pos);
      const nIdx = text.indexOf('\n', pos);
      let end;
      let ended;
      if (cIdx !== -1 && (nIdx === -1 || cIdx < nIdx)) {
        end = cIdx;
        ended = COMMA;
      } else if (nIdx !== -1) {
        end = nIdx;
        ended = LINE_BREAK;
      } else {
        end = len;
        ended = END;
      }
      // A CR right before the line break is the break's own, not the field's.
      let fend = end;
      if (ended === LINE_BREAK && end > pos && text.charCodeAt(end - 1) === 13) {
        fend = end - 1;
      }
      const seg = text.slice(pos, fend);
      if (seg.indexOf('\r') === -1) {
        value += seg;
        added += seg.length;
      } else {
        // Rare: stray CRs inside the field. Each is dropped and reported,
        // in the order met; no CR here can be followed by LF (a CRLF would
        // have ended the field at its LF instead).
        const parts = seg.split('\r');
        for (let i = 1; i < parts.length; i++) error('stray_cr');
        const joined = parts.join('');
        value += joined;
        added += joined.length;
      }
      if (ended === COMMA) {
        pos = end + 1;
        return { value, ended, added };
      }
      if (ended === LINE_BREAK) {
        pos = end + 1;
        line += 1;
        return { value, ended, added };
      }
      pos = len;
      return { value, ended, added };
    }
    return { value, ended: END, added };
  }

  // Appends the quoted segment text[a..b) to `value`, turning each CRLF or
  // lone CR inside it into one LF and counting the line breaks it holds.
  function appendQuoted(value, a, b) {
    const seg = text.slice(a, b);
    if (seg.indexOf('\r') === -1 && seg.indexOf('\n') === -1) return value + seg;
    const conv = seg.replace(/\r\n?/g, '\n');
    let breaks = 0;
    for (let i = 0; i < conv.length; i++) if (conv.charCodeAt(i) === 10) breaks++;
    line += breaks;
    return value + conv;
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let value = '';
    pos += 1;
    let p = pos;
    for (;;) {
      const q = text.indexOf('"', p);
      if (q === -1) {
        // The quote never closes: it is a literal character, and the text
        // after it is read again as unquoted.
        pos = open + 1;
        line = openLine;
        error('unterminated_quote');
        return readPlain('"');
      }
      if (text.charCodeAt(q + 1) === 34) {
        // A doubled quote: one literal quote, and the field goes on.
        value = appendQuoted(value, p, q) + '"';
        p = q + 2;
        continue;
      }
      value = appendQuoted(value, p, q);
      pos = q + 1;
      if (pos >= len) return { value, ended: END };
      const c = text.charCodeAt(pos);
      if (c === 44) {
        pos += 1;
        return { value, ended: COMMA };
      }
      if (c === 10) {
        pos += 1;
        line += 1;
        return { value, ended: LINE_BREAK };
      }
      if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
        return { value, ended: LINE_BREAK };
      }
      // What follows the closing quote is appended as it stands, up to the
      // next comma or line break.
      const junk = readPlain(value);
      if (junk.added > 0) error('quote_junk');
      return junk;
    }
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let field;
    let quoted;
    do {
      quoted = text.charCodeAt(pos) === 34;
      field = quoted ? readQuoted() : readPlain('');
      fields.push(field.value);
    } while (field.ended === COMMA);

    // A line that held only stray CRs is left with no characters: no record
    // (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
