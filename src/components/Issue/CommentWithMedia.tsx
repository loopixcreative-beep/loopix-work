import { Linkify } from '@/components/ui/linkify';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Image, Video, Upload, CheckCircle, X, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  media_urls: string[] | null;
  media_type: string | null;
  is_approved: boolean;
  approved_by: string | null;
  author: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
  approver?: {
    full_name: string | null;
    email: string;
  };
}

interface CommentWithMediaProps {
  issueId: string;
  comments: Comment[];
  onRefresh: () => void;
}

export const CommentWithMedia = ({ issueId, comments, onRefresh }: CommentWithMediaProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newComment, setNewComment] = useState('');
  const [uploading, setUploading] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const file = files[0];
    const type = file.type.startsWith('image/') ? 'image' : 'video';
    
    setMediaFiles([file]);
    setMediaType(type);
  };

  const handleSubmit = async () => {
    if (!newComment.trim() && mediaFiles.length === 0) return;
    
    setUploading(true);
    try {
      let mediaUrls: string[] = [];

      // Upload media files if any
      if (mediaFiles.length > 0) {
        for (const file of mediaFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${issueId}-${Date.now()}.${fileExt}`;
          const filePath = `issue-comments/${fileName}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('calendar-images')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('calendar-images')
            .getPublicUrl(filePath);

          mediaUrls.push(publicUrl);
        }
      }

      const { error } = await supabase.from('comments').insert({
        issue_id: issueId,
        author_id: user!.id,
        content: newComment,
        media_urls: mediaUrls.length > 0 ? mediaUrls : null,
        media_type: mediaType,
      });

      if (error) throw error;

      setNewComment('');
      setMediaFiles([]);
      setMediaType(null);
      onRefresh();
      
      toast({
        title: 'Comment added',
        description: 'Your comment has been posted successfully.',
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to add comment. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleApprove = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('comments')
        .update({
          is_approved: true,
          approved_by: user!.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', commentId);

      if (error) throw error;

      onRefresh();
      toast({
        title: 'Approved',
        description: 'Comment has been approved.',
      });
    } catch (error) {
      console.error('Error approving comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve comment.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* New Comment Form */}
      <Card className="p-4">
        <div className="space-y-4">
          <Textarea
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
          />
          
          {mediaFiles.length > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {mediaType === 'image' ? <Image className="h-3 w-3 mr-1" /> : <Video className="h-3 w-3 mr-1" />}
                {mediaFiles[0].name}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMediaFiles([]);
                  setMediaType(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('media-upload')?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Media
            </Button>
            <input
              id="media-upload"
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <Button onClick={handleSubmit} disabled={uploading}>
              {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Post Comment
            </Button>
          </div>
        </div>
      </Card>

      {/* Comments List */}
      <div className="space-y-4">
        {comments.map((comment) => (
          <Card key={comment.id} className="p-4">
            <div className="flex gap-4">
              <Avatar>
                <AvatarImage src={comment.author.avatar_url || undefined} />
                <AvatarFallback>
                  {comment.author.full_name?.charAt(0) || comment.author.email.charAt(0)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {comment.author.full_name || comment.author.email}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(comment.created_at), 'MMM d, yyyy at h:mm a')}
                    </p>
                  </div>
                  
                  {comment.is_approved ? (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Approved
                    </Badge>
                  ) : (
                    comment.author_id !== user?.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleApprove(comment.id)}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                    )
                  )}
                </div>

                <p className="text-sm whitespace-pre-wrap"><Linkify text={comment.content} /></p>

                {comment.media_urls && comment.media_urls.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {comment.media_urls.map((url, idx) => (
                      <div key={idx} className="relative rounded-lg overflow-hidden bg-muted">
                        {comment.media_type === 'image' ? (
                          <img
                            src={url}
                            alt={`Comment media ${idx + 1}`}
                            className="w-full h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(url, '_blank')}
                          />
                        ) : (
                          <video
                            src={url}
                            controls
                            className="w-full h-48 object-cover"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};