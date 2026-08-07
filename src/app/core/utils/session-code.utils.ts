export function getSessionCode(s: any): string {
  if (!s) return 'S1';

  // 1. Topic Code
  let topicCode = '';
  const topicText = (s.topic || s.courseTitle || s.groupName || '').trim();

  if (/mobile|app dev/i.test(topicText)) topicCode = 'MA';
  else if (/python/i.test(topicText)) topicCode = 'PY';
  else if (/arduino/i.test(topicText)) topicCode = 'AR';
  else if (/wedo|robotics/i.test(topicText)) topicCode = 'WE';
  else if (/\bai\b|machine learning|artificial/i.test(topicText)) topicCode = 'AI';
  else if (/programming|basics/i.test(topicText)) topicCode = 'PB';
  else {
    const words = topicText.split(/[\s-_]+/).filter((w: string) => w.length > 0);
    if (words.length >= 2) {
      topicCode = (words[0][0] + words[1][0]).toUpperCase();
    } else if (words.length === 1) {
      topicCode = words[0].slice(0, 2).toUpperCase();
    } else {
      topicCode = 'CS';
    }
  }

  // 2. Level
  let levelNum = s.level;
  if (!levelNum) {
    const match = (s.courseTitle || s.groupName || s.topic || '').match(/L(\d+)|Level\s*(\d+)/i);
    if (match) {
      levelNum = parseInt(match[1] || match[2], 10);
    }
  }
  const levelStr = `L${levelNum || 1}`;

  // 3. Session Number
  const sessionNum = s.currentSessionNumber || s.sessionNumber || s.orderIndex || 1;
  const sessionStr = `S${sessionNum}`;

  return `${topicCode}-${levelStr}-${sessionStr}`;
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
