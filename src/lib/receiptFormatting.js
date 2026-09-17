function wrapReceiptValue(value, maxCharsPerLine = 36) {
  const text = String(value ?? '—').trim();
  if (!text || text === '—') return ['—'];

  const words = text.split(/\s+/);
  const lines = [];
  let current = '';

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;

    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
      return;
    }

    if (current) {
      lines.push(current);
    }

    if (word.length > maxCharsPerLine) {
      let chunk = word;
      while (chunk.length > maxCharsPerLine) {
        lines.push(chunk.slice(0, maxCharsPerLine));
        chunk = chunk.slice(maxCharsPerLine);
      }
      current = chunk;
    } else {
      current = word;
    }
  });

  if (current) {
    lines.push(current);
  }

  return lines.length ? lines : ['—'];
}

export { wrapReceiptValue };
