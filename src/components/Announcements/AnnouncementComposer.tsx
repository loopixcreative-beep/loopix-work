import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/user-avatar';
import { EmojiPicker } from '@/components/Announcements/EmojiPicker';
import { AnnouncementMember, matchesMentionQuery, mentionHandle } from '@/components/Announcements/types';
import { Image, Loader2, Send, Video, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX_FILE_BYTES = 25 * 1024 * 1024;

interface AnnouncementComposerProps {
  members: AnnouncementMember[];
  sending: boolean;
  onSend: (payload: { content: string; file: File | null }) => Promise<void> | void;
}

const detectMention = (value: string, cursor: number) => {
  let start = cursor;
  while (start > 0 && !/\s/.test(value[start - 1])) start--;
  const token = value.slice(start, cursor);
  if (token.startsWith('@')) return { start, query: token.slice(1) };
  return null;
};

export const AnnouncementComposer = ({ members, sending, onSend }: AnnouncementComposerProps) => {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(-1);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const suggestions = useMemo(
    () => (mentionQuery !== null ? members.filter((m) => matchesMentionQuery(m, mentionQuery)).slice(0, 6) : []),
    [mentionQuery, members],
  );

  const updateMentionState = (value: string, cursor: number) => {
    const mention = detectMention(value, cursor);
    if (mention) {
      setMentionQuery(mention.query);
      setMentionStart(mention.start);
      setHighlightedIndex(0);
    } else {
      setMentionQuery(null);
      setMentionStart(-1);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setText(value);
    updateMentionState(value, e.target.selectionStart ?? value.length);
  };

  const selectMention = (member: AnnouncementMember) => {
    if (mentionStart < 0 || !textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart ?? text.length;
    const before = text.slice(0, mentionStart);
    const after = text.slice(cursor);
    const inserted = `@${mentionHandle(member)} `;
    const newText = before + inserted + after;
    setText(newText);
    setMentionQuery(null);
    setMentionStart(-1);
    requestAnimationFrame(() => {
      const pos = (before + inserted).length;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  };

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    const cursor = el?.selectionStart ?? text.length;
    const newText = text.slice(0, cursor) + emoji + text.slice(cursor);
    setText(newText);
    requestAnimationFrame(() => {
      const pos = cursor + emoji.length;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = '';
    if (!selected) return;
    if (selected.size > MAX_FILE_BYTES) {
      setFileError('That file is too large — max 25MB.');
      return;
    }
    setFileError(null);
    setFile(selected);
  };

  const canSend = (text.trim().length > 0 || !!file) && !sending;

  const handleSubmit = async () => {
    if (!canSend) return;
    await onSend({ content: text.trim(), file });
    setText('');
    setFile(null);
    setFileError(null);
    setMentionQuery(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectMention(suggestions[highlightedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        setMentionStart(-1);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative border-t bg-card p-3">
      {suggestions.length > 0 && (
        <div className="absolute bottom-full left-3 mb-1 w-64 overflow-hidden rounded-lg border bg-popover shadow-lg">
          {suggestions.map((m, i) => (
            <button
              key={m.user_id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectMention(m)}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                i === highlightedIndex ? 'bg-accent' : 'hover:bg-accent',
              )}
            >
              <UserAvatar name={m.full_name} email={m.email} avatarUrl={m.avatar_url} size="xs" />
              <div className="min-w-0">
                <p className="truncate font-medium">{m.full_name || m.email}</p>
                <p className="truncate text-xs text-muted-foreground">@{mentionHandle(m)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {file && (
        <div className="mb-2 flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            {file.type.startsWith('video/') ? <Video className="h-3 w-3" /> : <Image className="h-3 w-3" />}
            {file.name}
          </Badge>
          <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setFile(null)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      {fileError && <p className="mb-2 text-xs text-destructive">{fileError}</p>}

      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Message the team… use @ to mention someone"
          rows={1}
          className="min-h-[40px] flex-1 resize-none py-2"
        />
        <EmojiPicker onSelect={insertEmoji} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => document.getElementById('announcement-media-upload')?.click()}
        >
          <Image className="h-4 w-4" />
        </Button>
        <input
          id="announcement-media-upload"
          type="file"
          accept="image/*,video/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button type="button" size="icon" className="h-9 w-9 shrink-0" disabled={!canSend} onClick={handleSubmit}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};
