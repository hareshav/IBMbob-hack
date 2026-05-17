/**
 * Tiny line-based diff. Returns an array of { type, text, oldNo, newNo }
 * where type is 'equal' | 'add' | 'remove'.
 *
 * Algorithm: classic LCS dynamic-programming table, walk back to produce
 * the diff path. O(n*m) memory — fine for function-sized inputs (rarely
 * over a few hundred lines). For larger files use jsdiff; we deliberately
 * avoid the dependency here because the surface area is small.
 */
export function computeLineDiff(oldText, newText) {
  const oldLines = (oldText || '').split('\n');
  const newLines = (newText || '').split('\n');
  const m = oldLines.length;
  const n = newLines.length;

  // dp[i][j] = LCS length of oldLines[i..] vs newLines[j..]
  const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const out = [];
  let i = 0, j = 0;
  let oldNo = 1, newNo = 1;
  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      out.push({ type: 'equal', text: oldLines[i], oldNo, newNo });
      i++; j++; oldNo++; newNo++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'remove', text: oldLines[i], oldNo, newNo: null });
      i++; oldNo++;
    } else {
      out.push({ type: 'add', text: newLines[j], oldNo: null, newNo });
      j++; newNo++;
    }
  }
  while (i < m) {
    out.push({ type: 'remove', text: oldLines[i], oldNo, newNo: null });
    i++; oldNo++;
  }
  while (j < n) {
    out.push({ type: 'add', text: newLines[j], oldNo: null, newNo });
    j++; newNo++;
  }
  return out;
}

/** Compact summary for status text */
export function diffStats(diff) {
  let added = 0, removed = 0;
  for (const row of diff) {
    if (row.type === 'add') added++;
    else if (row.type === 'remove') removed++;
  }
  return { added, removed };
}
