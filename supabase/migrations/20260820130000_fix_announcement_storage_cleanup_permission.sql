-- Fix: on_announcement_posted() ran `DELETE FROM storage.objects` directly
-- as part of the 30-day retention sweep. The role that owns this
-- SECURITY DEFINER function doesn't have raw DML rights on Supabase's
-- internal storage schema (only policy-management rights, which is a
-- different privilege), so that statement raised "permission denied" —
-- and because it runs inside the same transaction as the message insert,
-- the whole insert rolled back, blocking every attempt to post a message.
-- Storage cleanup is best-effort here: wrap it so it can never block
-- posting even if it fails for any reason.
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

  BEGIN
    DELETE FROM storage.objects WHERE bucket_id = 'chat-media' AND created_at < now() - interval '30 days';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

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
