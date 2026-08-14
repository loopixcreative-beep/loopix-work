import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Upload, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ImageUploaderProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  userId: string;
}

export const ImageUploader = ({ images, onImagesChange, userId }: ImageUploaderProps) => {
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Validate file types
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const invalidFiles = Array.from(files).filter(file => !validTypes.includes(file.type));
    
    if (invalidFiles.length > 0) {
      toast.error('Please upload only valid image files (JPEG, PNG, WEBP, or GIF)');
      return;
    }

    // Validate total file size (20MB total)
    const totalSize = Array.from(files).reduce((sum, file) => sum + file.size, 0);
    if (totalSize > 20971520) {
      toast.error('Total file size must be less than 20MB');
      return;
    }

    try {
      setUploading(true);
      const uploadedUrls: string[] = [];

      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('calendar-images')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('calendar-images')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      }

      onImagesChange([...images, ...uploadedUrls]);
      toast.success(`${uploadedUrls.length} image(s) uploaded successfully!`);
    } catch (error: any) {
      console.error('Error uploading images:', error);
      toast.error('Failed to upload images');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async (imageUrl: string, index: number) => {
    try {
      // Only try to delete from storage if it's a storage URL
      if (imageUrl.includes('calendar-images')) {
        const path = imageUrl.split('/calendar-images/')[1];
        await supabase.storage.from('calendar-images').remove([path]);
      }
      
      const newImages = images.filter((_, i) => i !== index);
      onImagesChange(newImages);
      toast.success('Image removed');
    } catch (error) {
      console.error('Error removing image:', error);
      toast.error('Failed to remove image');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileUpload}
          className="hidden"
          id="calendar-image-upload"
          multiple
        />
        <Button
          variant="outline"
          size="sm"
          type="button"
          disabled={uploading}
          onClick={() => document.getElementById('calendar-image-upload')?.click()}
          className="w-full"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload Images (Multiple)
            </>
          )}
        </Button>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {images.map((img, idx) => (
            <div key={idx} className="relative group aspect-square rounded-md overflow-hidden border">
              <img
                src={img}
                alt={`Upload ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemoveImage(img, idx)}
                className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {images.length === 0 && (
        <p className="text-xs text-muted-foreground italic">No images uploaded yet</p>
      )}
    </div>
  );
};
