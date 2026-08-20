import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Smile } from 'lucide-react';

const EMOJIS = [
  '😀', '😁', '😂', '🤣', '😅', '😊', '😉', '😍', '😘', '😎',
  '🤔', '🙄', '😴', '🤯', '🥳', '😭', '😢', '😡', '🤬', '😱',
  '🥺', '🤩', '😇', '🤗', '🤝', '👍', '👎', '👏', '🙌', '🙏',
  '👀', '💪', '🤞', '✌️', '👌', '🔥', '✨', '🎉', '🎊', '💯',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '💕',
  '✅', '❌', '⚠️', '❓', '❗', '📌', '📎', '📢', '🔔', '⏰',
  '🚀', '🛠️', '🐛', '💡', '📝', '📅', '☕', '🍕', '🎯', '🏆',
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

export const EmojiPicker = ({ onSelect }: EmojiPickerProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0">
          <Smile className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <div className="grid grid-cols-8 gap-1">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onSelect(emoji)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-lg transition-colors hover:bg-accent"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
