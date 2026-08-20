import { Fragment } from 'react';

const TOKEN_RE = /((?:https?:\/\/|www\.)[^\s<]+|@[A-Za-z0-9_.+-]+)/g;

/** Renders message text with URLs auto-linked and @mentions highlighted. */
export const MessageContent = ({ text, className }: { text?: string | null; className?: string }) => {
  if (!text) return null;
  const parts = text.split(TOKEN_RE);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (!part) return null;

        if (/^(?:https?:\/\/|www\.)/i.test(part)) {
          const href = part.startsWith('http') ? part : `https://${part}`;
          return (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80 break-all"
            >
              {part}
            </a>
          );
        }

        if (/^@[A-Za-z0-9_.+-]+$/.test(part)) {
          return (
            <span key={i} className="rounded bg-primary/10 px-1 py-0.5 font-semibold text-primary">
              {part}
            </span>
          );
        }

        return <Fragment key={i}>{part}</Fragment>;
      })}
    </span>
  );
};
