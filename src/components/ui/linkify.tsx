import { Fragment } from 'react';

const URL_RE = /((?:https?:\/\/|www\.)[^\s<]+)/gi;

/**
 * Renders plain text with URLs turned into safe, clickable links.
 */
export const Linkify = ({ text, className }: { text?: string | null; className?: string }) => {
  if (!text) return null;

  const parts = text.split(URL_RE);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (!part) return null;
        if (i % 2 === 1) {
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
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </span>
  );
};
