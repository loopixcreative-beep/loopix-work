-- Global "Announcements" group-chat channel: one shared channel every
-- authenticated team member can read and post in. Messages carry optional
-- media (image/gif/video, gif is just an image/gif upload) and are retained
-- for 30 days only.

CREATE TABLE public.announcement_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text,
  media_url text,
  media_type text CHECK (media_type IN ('image', 'video')),
  mentioned_user_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT announcement_messages_not_empty CHECK (
    (content IS NOT NULL AND btrim(content) <> '') OR media_url IS NOT NULL
  )
);

GRANT SELECT, INSERT, DELETE ON public.announcement_messages TO authenticated;
GRANT ALL ON public.announcement_messages TO service_role;

ALTER TABLE public.announcement_messages ENABLE ROW LEVEL SECURITY;

-- Same "open team" model already used for issues/projects: any signed-in
-- user can read, and the 30-day window is enforced here too (defense in
-- depth alongside the retention sweep below).
CREATE POLICY "Team members can view recent announcements"
  ON public.announcement_messages FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND created_at >= now() - interval '30 days');

CREATE POLICY "Team members can post announcements"
  ON public.announcement_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can delete their own announcements"
  ON public.announcement_messages FOR DELETE TO authenticated
  USING (auth.uid() = author_id);

CREATE INDEX announcement_messages_created_at_idx ON public.announcement_messages (created_at DESC);
CREATE INDEX announcement_messages_author_idx ON public.announcement_messages (author_id);

ALTER TABLE public.announcement_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcement_messages;

-- On every new message: sweep anything older than 30 days (table row +
-- underlying storage object) and fan out a 'announcement' notification to
-- every other team member, reusing the existing notifications/bell system.
CREATE OR REPLACE FUNCTION public.on_announcement_posted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_id uuid;
  actor_name text;
  preview text;
BEGIN
  DELETE FROM public.announcement_messages WHERE created_at < now() - interval '30 days';
  DELETE FROM storage.objects WHERE bucket_id = 'chat-media' AND created_at < now() - interval '30 days';

  SELECT COALESCE(full_name, email) INTO actor_name FROM public.profiles WHERE user_id = NEW.author_id;

  preview := NULLIF(btrim(left(NEW.content, 120)), '');
  IF preview IS NULL THEN
    preview := CASE WHEN NEW.media_type = 'video' THEN 'sent a video' ELSE 'sent an image' END;
  END IF;

  FOR member_id IN
    SELECT user_id FROM public.profiles WHERE user_id IS NOT NULL AND user_id <> NEW.author_id
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      member_id,
      'announcement',
      'New announcement',
      COALESCE(actor_name, 'Someone') || ': ' || preview,
      '/announcements',
      jsonb_build_object('announcement_id', NEW.id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_announcement_posted
  AFTER INSERT ON public.announcement_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.on_announcement_posted();

-- Storage bucket for chat attachments.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  true,
  26214400,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view chat media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-media');

CREATE POLICY "Authenticated users can upload chat media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-media' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own chat media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);
