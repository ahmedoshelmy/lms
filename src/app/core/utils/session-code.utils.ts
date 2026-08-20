function resolveTopicCode(s: any): string {
  const topicText = (s.topic || s.courseTitle || s.groupName || '').trim();

  if (/mobile|app dev/i.test(topicText)) return 'MA';
  if (/python/i.test(topicText)) return 'PY';
  if (/arduino/i.test(topicText)) return 'AR';
  if (/wedo|robotics/i.test(topicText)) return 'WE';
  if (/\bai\b|machine learning|artificial/i.test(topicText)) return 'AI';
  if (/programming|basics/i.test(topicText)) return 'PB';

  const words = topicText.split(/[\s-_]+/).filter((w: string) => w.length > 0);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return 'CS';
}

function resolveLevelStr(s: any): string {
  let levelNum = s.level;
  if (!levelNum) {
    const match = (s.courseTitle || s.groupName || s.topic || '').match(/L(\d+)|Level\s*(\d+)/i);
    if (match) levelNum = parseInt(match[1] || match[2], 10);
  }
  return `L${levelNum || 1}`;
}

/** Returns the full session code (e.g. "PY-L2-S3"). */
export function getSessionCode(s: any): string {
  if (!s) return 'S1';
  const topicCode = resolveTopicCode(s);
  const levelStr = resolveLevelStr(s);
  const sessionNum = s.currentSessionNumber || s.sessionNumber || s.orderIndex || 1;
  return `${topicCode}-${levelStr}-S${sessionNum}`;
}

/**
 * Returns just the topic-level code (e.g. "PY-L2") without the redundant
 * session-number suffix. Use this alongside a separate "N/total" counter
 * to avoid displaying the session number twice.
 */
export function getSessionBaseCode(s: any): string {
  if (!s) return 'CS';
  return `${resolveTopicCode(s)}-${resolveLevelStr(s)}`;
}

export function getSessionDisplayTopic(s: any): string {
  if (!s) return 'Class Session';
  const topic = (s.topic || '').trim();
  const isGeneric = !topic || /^Session\s*\d*$/i.test(topic) || /regular session/i.test(topic);
  if (isGeneric) {
    return s.courseTitle || s.groupName || 'Class Session';
  }
  return topic;
}

/**
 * A session's place in its group's course, e.g. "4/12" for the fourth of
 * twelve.
 *
 * Reads `currentSessionNumber`, which is the progress counter the rest of the
 * app displays (session detail and attendance both render it as "N of total"),
 * falling back to the session's own ordinal. Returns an empty string when
 * neither is known, so a standalone session that belongs to no course sequence
 * renders nothing rather than "0".
 */
export function getSessionSequence(s: any): string {
  const current = s?.currentSessionNumber || s?.sessionNumber || 0;
  if (!current) return '';
  return s.totalSessions ? `${current}/${s.totalSessions}` : `${current}`;
}

/** Long form of the sequence, for tooltips and screen readers. */
export function getSessionSequenceLabel(s: any): string {
  const current = s?.currentSessionNumber || s?.sessionNumber || 0;
  if (!current) return '';
  return s.totalSessions ? `Session ${current} of ${s.totalSessions}` : `Session ${current}`;
}
