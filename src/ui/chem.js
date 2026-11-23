// Text formatting for all data-derived strings.
//
// esc(text)  : HTML-escape (for any string placed in markup).
// chem(text) : HTML-escape + chemistry markup:
//              _x / _{...} -> <sub>, ^x / ^{...} -> <sup>, newline -> <br>.
// The parser walks the RAW string and escapes every emitted piece itself, so
// data can never inject HTML (no regex over already-escaped text).

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}

/** Convert chemistry markup to safe HTML. */
export function chem(text) {
  const s = String(text ?? '');
  let out = '';
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if ((ch === '_' || ch === '^') && i + 1 < s.length) {
      const tag = ch === '_' ? 'sub' : 'sup';
      const nx = s[i + 1];
      if (nx === '{') {
        let depth = 1;
        let j = i + 2;
        while (j < s.length) {
          if (s[j] === '{') depth++;
          else if (s[j] === '}') { depth--; if (depth === 0) break; }
          j++;
        }
        if (depth === 0) {
          out += `<${tag}>${chem(s.slice(i + 2, j))}</${tag}>`;
          i = j + 1;
          continue;
        }
      } else if (!/\s/.test(nx) && nx !== '_' && nx !== '^' && nx !== '}') {
        const cp = String.fromCodePoint(s.codePointAt(i + 1));
        out += `<${tag}>${esc(cp)}</${tag}>`;
        i += 1 + cp.length;
        continue;
      }
    }
    if (ch === '\n') { out += '<br>'; i++; continue; }
    if (ch === '\\' && s[i + 1] === 'n') { out += '<br>'; i += 2; continue; }
    out += esc(ch);
    i++;
  }
  return out;
}

/** Plain-text version of markup (for aria-labels / titles). */
export function plain(text) {
  return String(text ?? '').replace(/[_^]\{([^}]*)\}/g, '$1').replace(/[_^](\S)/g, '$1');
}

/**
 * Format a number for display with chem markup, e.g. 1.2e-5 -> "1.2×10^{-5}".
 * Returns markup (pass through chem()).
 */
export function numMarkup(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return String(v ?? '');
  const a = Math.abs(v);
  if (a !== 0 && (a < 1e-3 || a >= 1e5)) {
    const exp = Math.floor(Math.log10(a));
    let mant = v / Math.pow(10, exp);
    mant = Number(mant.toPrecision(3));
    if (Math.abs(mant) >= 10) { mant /= 10; return `${trimNum(mant)}×10^{${exp + 1}}`; }
    return `${trimNum(mant)}×10^{${exp}}`;
  }
  return trimNum(Number(v.toPrecision(4)));
}

function trimNum(n) {
  return String(n);
}
