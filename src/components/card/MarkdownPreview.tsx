import type { JSX, ReactNode } from "react";

type MarkdownPreviewProps = {
  source: string;
  className?: string;
  emptyMessage?: string;
};

function safeHref(value: string) {
  const href = value.trim();
  if (/^(https?:|mailto:)/i.test(href) || href.startsWith("/") || href.startsWith("#")) {
    return href;
  }
  return undefined;
}

function renderInline(value: string, keyPrefix: string): ReactNode[] {
  const expression = /(`[^`]+`|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|\*([^*]+)\*|_([^_]+)_)/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = expression.exec(value))) {
    if (match.index > cursor) nodes.push(value.slice(cursor, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${match.index}`;
    if (token.startsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("[")) {
      const href = safeHref(match[3] ?? "");
      nodes.push(
        href ? (
          <a key={key} href={href} target={/^https?:/i.test(href) ? "_blank" : undefined} rel="noreferrer">
            {match[2]}
          </a>
        ) : (
          token
        ),
      );
    } else if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(<strong key={key}>{match[4] ?? match[5]}</strong>);
    } else if (token.startsWith("~~")) {
      nodes.push(<del key={key}>{match[6]}</del>);
    } else {
      nodes.push(<em key={key}>{match[7] ?? match[8]}</em>);
    }
    cursor = expression.lastIndex;
  }
  if (cursor < value.length) nodes.push(value.slice(cursor));
  return nodes;
}

function isTableDivider(line: string) {
  const cells = line.split("|").filter((cell, index, all) => {
    if (index === 0 && cell.trim() === "") return false;
    if (index === all.length - 1 && cell.trim() === "") return false;
    return true;
  });
  return cells.length > 0 && cells.every((cell) => /^\s*:?-{3,}:?\s*$/.test(cell));
}

function tableCells(line: string) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

export function MarkdownPreview({ source, className, emptyMessage = "Nothing to preview yet." }: MarkdownPreviewProps) {
  if (!source.trim()) return <p className={className}>{emptyMessage}</p>;

  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push(
        <pre key={`code-${index}`}>
          <code data-language={language || undefined}>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    if (index + 1 < lines.length && line.includes("|") && isTableDivider(lines[index + 1])) {
      const header = tableCells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      blocks.push(
        <div className="card-markdown-table-wrap" key={`table-${index}`}>
          <table>
            <thead><tr>{header.map((cell, cellIndex) => <th key={cellIndex}>{renderInline(cell, `th-${index}-${cellIndex}`)}</th>)}</tr></thead>
            <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{header.map((_, cellIndex) => <td key={cellIndex}>{renderInline(row[cellIndex] ?? "", `td-${index}-${rowIndex}-${cellIndex}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const content = renderInline(heading[2], `heading-${index}`);
      const Heading = `h${level}` as keyof JSX.IntrinsicElements;
      blocks.push(<Heading key={`heading-${index}`}>{content}</Heading>);
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(<blockquote key={`quote-${index}`}>{quote.map((item, quoteIndex) => <p key={quoteIndex}>{renderInline(item, `quote-${index}-${quoteIndex}`)}</p>)}</blockquote>);
      continue;
    }

    const unordered = /^\s*[-*+]\s+(.+)$/.test(line);
    const ordered = /^\s*\d+[.)]\s+(.+)$/.test(line);
    if (unordered || ordered) {
      const items: ReactNode[] = [];
      const matcher = ordered ? /^\s*\d+[.)]\s+(.+)$/ : /^\s*[-*+]\s+(.+)$/;
      while (index < lines.length) {
        const item = matcher.exec(lines[index]);
        if (!item) break;
        const task = /^\[([ xX])\]\s+(.+)$/.exec(item[1]);
        items.push(
          <li key={index} className={task ? "card-markdown-task" : undefined}>
            {task && <input type="checkbox" checked={task[1].toLowerCase() === "x"} readOnly aria-label="Task status" />}
            {renderInline(task?.[2] ?? item[1], `list-${index}`)}
          </li>,
        );
        index += 1;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(<List key={`list-${index}`}>{items}</List>);
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{1,6})\s+|^```|^>\s?|^\s*[-*+]\s+|^\s*\d+[.)]\s+/.test(lines[index])) {
      if (index + 1 < lines.length && lines[index].includes("|") && isTableDivider(lines[index + 1])) break;
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(<p key={`paragraph-${index}`}>{renderInline(paragraph.join("\n"), `paragraph-${index}`)}</p>);
  }

  return <div className={className}>{blocks}</div>;
}
