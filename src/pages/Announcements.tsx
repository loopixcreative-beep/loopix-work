import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { friendlyErrorMessage } from '@/lib/errors';
import { Card } from '@/components/ui/card';
import { UserAvatar } from '@/components/ui/user-avatar';
import { MessageContent } from '@/components/Announcements/MessageContent';
import { AnnouncementComposer } from '@/components/Announcements/AnnouncementComposer';
import { AnnouncementMember, mentionHandle } from '@/components/Announcements/types';
import { Megaphone } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const membersById = useMemo(() => {
    const map = new Map<string, AnnouncementMember>();
    members.forEach((m) => map.set(m.user_id, m));
    return map;
  }, [members]);

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

  let lastDayKey = '';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl bg-gradient-brand bg-[length:200%_200%] p-5 text-primary-foreground shadow-stat animate-gradient-pan">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/15">
          <Megaphone className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Announcements</h1>
          <p className="text-sm opacity-90">
            One channel for every team member across every project — messages are kept for 30 days.
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

            return (
              <div key={m.id}>
                {showDaySeparator && (
                  <div className="my-3 flex items-center gap-3 text-xs font-medium text-muted-foreground">
                    <div className="h-px flex-1 bg-border" />
                    {dayLabel(created)}
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <UserAvatar name={author?.full_name} email={author?.email} avatarUrl={author?.avatar_url} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold">{author?.full_name || author?.email || 'Someone'}</span>
                      <span className="text-xs text-muted-foreground">{format(created, 'h:mm a')}</span>
                    </div>
                    {m.content && (
                      <p className="whitespace-pre-wrap text-sm">
                        <MessageContent text={m.content} />
                      </p>
                    )}
                    {m.media_url && (
                      <div className="mt-2 max-w-sm overflow-hidden rounded-lg border bg-muted">
                        {m.media_type === 'video' ? (
                          <video src={m.media_url} controls className="max-h-80 w-full" />
                        ) : (
                          <img
                            src={m.media_url}
                            alt="Attachment"
                            className="max-h-80 w-full cursor-pointer object-cover"
                            onClick={() => window.open(m.media_url!, '_blank')}
                          />
                        )}
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
