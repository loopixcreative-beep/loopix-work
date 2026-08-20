export interface AnnouncementMember {
  user_id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

/** The single-word token inserted into the message text for a mention, e.g. "@Puskar". */
export const mentionHandle = (m: AnnouncementMember) => {
  const first = (m.full_name || '').trim().split(/\s+/)[0];
  const handle = (first || m.email.split('@')[0]).replace(/\s+/g, '');
  return handle;
};

/** Matches "@p" against first name OR email starting with "p" (case-insensitive). */
export const matchesMentionQuery = (m: AnnouncementMember, query: string) => {
  const q = query.toLowerCase();
  if (!q) return true;
  const first = (m.full_name || '').trim().split(/\s+/)[0]?.toLowerCase() || '';
  const emailLocal = m.email.split('@')[0].toLowerCase();
  return first.startsWith(q) || m.email.toLowerCase().startsWith(q) || emailLocal.startsWith(q);
};
