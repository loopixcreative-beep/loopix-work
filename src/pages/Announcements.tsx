import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { friendlyErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { UserAvatar } from '@/components/ui/user-avatar';
import { MessageContent } from '@/components/Announcements/MessageContent';
import { AnnouncementComposer } from '@/components/Announcements/AnnouncementComposer';
import { AnnouncementMember, mentionHandle } from '@/components/Announcements/types';
import { Megaphone, SmilePlus } from 'lucide-react';
import { format, isSameDay } from 'date-fns';

interface AnnouncementMessage {
  id: string;
  author_id: string;
  content: string | null;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  mentioned_user_ids: string[];
  created_at: string;
}

interface AnnouncementReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const dayLabel = (date: Date) => {
  const today = new Date();
  if (isSameDay(date, today)) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return format(date, 'EEEE, MMM d');
};

const Announcements = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<AnnouncementMember[]>([]);
  const [messages, setMessages] = useState<AnnouncementMessage[]>([]);
  const [reactions, setReactions] = useState<AnnouncementReaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const membersById = useMemo(() => {
    const map = new Map<string, AnnouncementMember>();
    members.forEach((m) => map.set(m.user_id, m));
    return map;
  }, [members]);

  // Grouped per message: emoji -> { count, reactedByMe }
  const reactionsByMessage = useMemo(() => {
    const map = new Map<string, Map<string, { count: number; reactedByMe: boolean }>>();
    for (const r of reactions) {
      if (!map.has(r.message_id)) map.set(r.message_id, new Map());
      const forMessage = map.get(r.message_id)!;
      const entry = forMessage.get(r.emoji) ?? { count: 0, reactedByMe: false };
      entry.count += 1;
      if (r.user_id === user?.id) entry.reactedByMe = true;
      forMessage.set(r.emoji, entry);
    }
    return map;
  }, [reactions, user?.id]);

  const load = useCallback(async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: memberData }, { data: messageData }] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, email, avatar_url'),
      supabase
        .from('announcement_messages')
        .select('id, author_id, content, media_url, media_type, mentioned_user_ids, created_at')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: true }),
    ]);
    setMembers((memberData || []) as AnnouncementMember[]);
    setMessages((messageData || []) as AnnouncementMessage[]);

    const messageIds = (messageData || []).map((m) => m.id);
    if (messageIds.length > 0) {
      const { data: reactionData } = await supabase
        .from('announcement_reactions')
        .select('id, message_id, user_id, emoji')
        .in('message_id', messageIds);
      setReactions((reactionData || []) as AnnouncementReaction[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Opening the channel clears the sidebar dot and the bell's unread count for this type.
  useEffect(() => {
    if (!user) return;
    supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('type', 'announcement')
      .eq('is_read', false)
      .then(() => {});
  }, [user]);

  useEffect(() => {
    const channel = supabase
      .channel('announcement-messages-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'announcement_messages' },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as AnnouncementMessage]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('announcement-reactions-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'announcement_reactions' },
        (payload) => {
          const row = payload.new as AnnouncementReaction;
          setReactions((prev) => (prev.some((r) => r.id === row.id) ? prev : [...prev, row]));
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'announcement_reactions' },
        (payload) => {
          const row = payload.old as AnnouncementReaction;
          setReactions((prev) => prev.filter((r) => r.id !== row.id));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const handleSend = async ({ content, file }: { content: string; file: File | null }) => {
    if (!user) return;
    setSending(true);
    try {
      let media_url: string | null = null;
      let media_type: 'image' | 'video' | null = null;

      if (file) {
        media_type = file.type.startsWith('video/') ? 'video' : 'image';
        const ext = file.name.split('.').pop();
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('chat-media').upload(path, file);
        if (uploadError) throw uploadError;
        media_url = supabase.storage.from('chat-media').getPublicUrl(path).data.publicUrl;
      }

      const mentionedUserIds = members
        .filter((m) => new RegExp(`@${mentionHandle(m)}\\b`, 'i').test(content))
        .map((m) => m.user_id);

      const { error } = await supabase.from('announcement_messages').insert({
        author_id: user.id,
        content: content || null,
        media_url,
        media_type,
        mentioned_user_ids: mentionedUserIds,
      });
      if (error) throw error;
    } catch (error) {
      console.error('Failed to send announcement:', error);
      toast({ title: 'Could not send message', description: friendlyErrorMessage(error), variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    const existing = reactions.find((r) => r.message_id === messageId && r.user_id === user.id && r.emoji === emoji);
    if (existing) {
      setReactions((prev) => prev.filter((r) => r.id !== existing.id));
      const { error } = await supabase.from('announcement_reactions').delete().eq('id', existing.id);
      if (error) {
        setReactions((prev) => [...prev, existing]);
        toast({ title: 'Could not remove reaction', description: friendlyErrorMessage(error), variant: 'destructive' });
      }
    } else {
      const optimisticId = `optimistic-${Date.now()}`;
      setReactions((prev) => [...prev, { id: optimisticId, message_id: messageId, user_id: user.id, emoji }]);
      const { data, error } = await supabase
        .from('announcement_reactions')
        .insert({ message_id: messageId, user_id: user.id, emoji })
        .select('id, message_id, user_id, emoji')
        .single();
      if (error) {
        setReactions((prev) => prev.filter((r) => r.id !== optimisticId));
        toast({ title: 'Could not add reaction', description: friendlyErrorMessage(error), variant: 'destructive' });
      } else if (data) {
        setReactions((prev) => prev.map((r) => (r.id === optimisticId ? (data as AnnouncementReaction) : r)));
      }
    }
  };

  let lastDayKey = '';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 rounded-xl bg-gradient-brand bg-[length:200%_200%] px-4 py-2.5 text-primary-foreground shadow-stat animate-gradient-pan">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/15">
          <Megaphone className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-bold tracking-tight">Announcements</h1>
          <p className="truncate text-xs opacity-80">
            One channel for every team member — messages are kept for 30 days.
          </p>
        </div>
      </div>

      <Card className="flex flex-col overflow-hidden">
        <div ref={scrollRef} className="h-[60vh] space-y-4 overflow-y-auto p-4">
          {loading && <div className="h-24 animate-pulse rounded-lg bg-muted" />}
          {!loading && messages.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No announcements yet — be the first to post something.
            </p>
          )}
          {messages.map((m) => {
            const author = membersById.get(m.author_id);
            const created = new Date(m.created_at);
            const dayKey = format(created, 'yyyy-MM-dd');
            const showDaySeparator = dayKey !== lastDayKey;
            lastDayKey = dayKey;
            const isMine = m.author_id === user?.id;
            const messageReactions = Array.from(reactionsByMessage.get(m.id)?.entries() ?? []);

            return (
              <div key={m.id}>
                {showDaySeparator && (
                  <div className="my-3 flex items-center gap-3 text-xs font-medium text-muted-foreground">
                    <div className="h-px flex-1 bg-border" />
                    {dayLabel(created)}
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )}
                <div className={cn('group flex items-start gap-3', isMine && 'flex-row-reverse')}>
                  <UserAvatar name={author?.full_name} email={author?.email} avatarUrl={author?.avatar_url} size="sm" />
                  <div className={cn('flex min-w-0 max-w-[75%] flex-1 flex-col', isMine && 'items-end')}>
                    <div className={cn('flex items-baseline gap-2', isMine && 'flex-row-reverse')}>
                      <span className="text-sm font-semibold">
                        {isMine ? 'You' : author?.full_name || author?.email || 'Someone'}
                      </span>
                      <span className="text-xs text-muted-foreground">{format(created, 'h:mm a')}</span>
                    </div>

                    <div className={cn('flex items-end gap-1.5', isMine && 'flex-row-reverse')}>
                      <div
                        className={cn(
                          'min-w-0 rounded-2xl px-3 py-2',
                          isMine ? 'bg-primary text-primary-foreground' : 'bg-muted',
                          !m.content && !m.media_url && 'hidden',
                        )}
                      >
                        {m.content && (
                          <p className="whitespace-pre-wrap text-sm">
                            <MessageContent text={m.content} />
                          </p>
                        )}
                        {m.media_url && (
                          <div className={cn('overflow-hidden rounded-lg', m.content && 'mt-2')}>
                            {m.media_type === 'video' ? (
                              <video src={m.media_url} controls className="max-h-80 w-full max-w-sm" />
                            ) : (
                              <img
                                src={m.media_url}
                                alt="Attachment"
                                className="max-h-80 w-full max-w-sm cursor-pointer object-cover"
                                onClick={() => window.open(m.media_url!, '_blank')}
                              />
                            )}
                          </div>
                        )}
                      </div>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                            aria-label="Add reaction"
                          >
                            <SmilePlus className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-1.5" side="top">
                          <div className="flex gap-1">
                            {REACTION_EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => toggleReaction(m.id, emoji)}
                                className="flex h-8 w-8 items-center justify-center rounded-md text-lg transition-transform hover:scale-125 hover:bg-muted"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {messageReactions.length > 0 && (
                      <div className={cn('mt-1 flex flex-wrap gap-1', isMine && 'justify-end')}>
                        {messageReactions.map(([emoji, { count, reactedByMe }]) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => toggleReaction(m.id, emoji)}
                            className={cn(
                              'flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors',
                              reactedByMe ? 'border-primary/40 bg-primary/10' : 'border-border bg-muted/50 hover:bg-muted',
                            )}
                          >
                            <span>{emoji}</span>
                            <span className="font-medium text-muted-foreground">{count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <AnnouncementComposer members={members} sending={sending} onSend={handleSend} />
      </Card>
    </div>
  );
};

export default Announcements;
