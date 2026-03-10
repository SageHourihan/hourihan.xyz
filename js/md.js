// md.js — minimal markdown renderer for /b/
// supports: headings, bold, italic, inline code, fenced code blocks,
//           blockquotes, links, horizontal rules, paragraphs

function renderMarkdown(src) {
  const lines = src.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // fenced code block
    if (line.startsWith('```')) {
      const code = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        code.push(lines[i]);
        i++;
      }
      blocks.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>');
      i++;
      continue;
    }

    // heading
    const hm = line.match(/^(#{1,3})\s+(.+)/);
    if (hm) {
      const lvl = hm[1].length;
      blocks.push('<h' + lvl + '>' + inline(hm[2]) + '</h' + lvl + '>');
      i++;
      continue;
    }

    // blockquote
    if (line.startsWith('> ')) {
      const bq = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        bq.push(lines[i].slice(2));
        i++;
      }
      blocks.push('<blockquote>' + inline(bq.join(' ')) + '</blockquote>');
      continue;
    }

    // horizontal rule
    if (line.match(/^---+\s*$/)) {
      blocks.push('<hr>');
      i++;
      continue;
    }

    // blank line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // paragraph — collect until blank line or block-level element
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].match(/^#{1,3}\s/) &&
      !lines[i].startsWith('```') &&
      !lines[i].startsWith('> ') &&
      !lines[i].match(/^---+\s*$/)
    ) {
      para.push(lines[i]);
      i++;
    }
    if (para.length) {
      blocks.push('<p>' + inline(para.join(' ')) + '</p>');
    }
  }

  return blocks.join('\n');
}

function esc(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function inline(s) {
  s = esc(s);
  // inline code (protect from further processing)
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => {
    codes.push('<code>' + c + '</code>');
    return '\x00' + (codes.length - 1) + '\x00';
  });
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // restore inline code
  s = s.replace(/\x00(\d+)\x00/g, (_, i) => codes[+i]);
  return s;
}
