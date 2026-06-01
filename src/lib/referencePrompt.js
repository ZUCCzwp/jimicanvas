export function getReferenceToken(index) {
  return `@图${index + 1}`;
}

export function getReferenceLabel(index) {
  return `图${index + 1}`;
}

export function detectReferenceMention(text, cursor) {
  const before = String(text || '').slice(0, cursor);
  const match = before.match(/@([^\s@]*)$/);
  if (!match) return null;
  return {
    start: cursor - match[0].length,
    query: match[1],
  };
}

export function filterReferenceMentionOptions(references, query, resolvePreviewUrl) {
  const normalizedQuery = String(query || '').toLowerCase();
  return (references || []).map((reference, index) => ({
    reference,
    index,
    label: getReferenceLabel(index),
    token: getReferenceToken(index),
    previewUrl: resolvePreviewUrl(reference, index),
  })).filter((item) => {
    if (!normalizedQuery) return true;
    return (
      item.label.toLowerCase().includes(normalizedQuery) ||
      item.token.toLowerCase().includes(normalizedQuery) ||
      String(item.index + 1).includes(normalizedQuery)
    );
  });
}

const REFERENCE_TOKEN_PATTERN = /@图(\d+)/g;

export function parsePromptSegments(text) {
  const segments = [];
  const source = String(text || '');
  let lastIndex = 0;
  REFERENCE_TOKEN_PATTERN.lastIndex = 0;
  let match = REFERENCE_TOKEN_PATTERN.exec(source);

  while (match !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: source.slice(lastIndex, match.index) });
    }
    segments.push({
      type: 'mention',
      token: match[0],
      index: Number(match[1]) - 1,
    });
    lastIndex = match.index + match[0].length;
    match = REFERENCE_TOKEN_PATTERN.exec(source);
  }

  if (lastIndex < source.length) {
    segments.push({ type: 'text', value: source.slice(lastIndex) });
  }

  return segments;
}

export function promptHasReferenceMentions(text) {
  return /@图\d+/.test(String(text || ''));
}
