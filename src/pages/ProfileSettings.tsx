import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, X, Plus, Award } from "lucide-react";

const PREDEFINED_SKILLS = [
  // Technical & Creative Skills
  "Adobe Photoshop", "Adobe Illustrator", "Figma / UI Prototyping",
  "Adobe Premiere Pro", "Adobe After Effects", "Canva Design",
  "Photography & Thumbnails", "Reels / Shorts Video Editing",
  "3D Mockup / Product Visualization", "HTML / CSS",
  "JavaScript", "React", "Laravel", "WordPress / CMS Management",
  "Flutter / Mobile App Development", "Firebase Integration",
  "API Integration", "SEO Optimization",
  "Social Media Ads (FB/IG)", "Google Ads / YouTube Ads",
  "Content Writing / Copywriting", "Scriptwriting for Ads",
  "Brand Identity Design", "Logo Conceptualization",
  "Motion Loop Animation / Lottie", "UI Design Systems",
  "Market Research Tools",
  // Soft Skills
  "Communication Skills", "Presentation & Pitch Delivery",
  "Client Handling & Negotiation", "Emotional Intelligence",
  "Adaptability & Learning Speed", "Time Management",
  "Stress Management", "Team Collaboration",
  "Creativity & Innovation", "Critical Thinking",
  "Problem Solving", "Confidence & Self-Motivation",
  "Active Listening", "Observation & Attention to Detail",
  "Positive Attitude & Work Ethics",
  // Management & Strategic Skills
  "Project Coordination", "Task Prioritization & Delegation",
  "Leadership & Initiative", "Workflow Optimization",
  "Reporting & Documentation", "Performance Tracking / Analytics",
  "Budget & Resource Management", "Decision Making",
  "Process Automation Understanding", "Strategic Planning & Forecasting"
];

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  skills: string[];
  coin_points: number;
}

const ProfileSettings = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState("");

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user?.id)
        .single();

      if (error) throw error;

      setProfile(data);
      setFullName(data.full_name || "");
      setBio(data.bio || "");
      setAvatarUrl(data.avatar_url || "");
      setImagePreview(data.avatar_url || "");
      setSkills(data.skills || []);
    } catch (error: any) {
      console.error("Error fetching profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          bio: bio,
          avatar_url: avatarUrl,
          skills: skills,
        })
        .eq("user_id", user?.id);

      if (error) throw error;

      toast.success("Profile updated successfully!");
      fetchProfile();
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const addSkill = (skill?: string) => {
    const skillToAdd = skill || newSkill.trim();
    if (skillToAdd && !skills.includes(skillToAdd)) {
      if (skills.length >= 8) {
        toast.error("You can only add up to 8 skills");
        return;
      }
      setSkills([...skills, skillToAdd]);
      setNewSkill("");
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setSkills(skills.filter(skill => skill !== skillToRemove));
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPEG, PNG, WEBP, or GIF)');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5242880) {
      toast.error('File size must be less than 5MB');
      return;
    }

    try {
      setUploadingImage(true);

      // Delete old avatar if exists
      if (avatarUrl && avatarUrl.includes('profile-images')) {
        const oldPath = avatarUrl.split('/profile-images/')[1];
        await supabase.storage.from('profile-images').remove([oldPath]);
      }

      // Upload new image
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError, data } = await supabase.storage
        .from('profile-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-images')
        .getPublicUrl(fileName);

      setAvatarUrl(publicUrl);
      setImagePreview(publicUrl);
      toast.success('Image uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Profile Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your personal information and preferences</p>
      </div>

      <div className="grid gap-6">
        {/* Coin Points Display */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  Your Achievements
                </CardTitle>
                <CardDescription>Earn points by completing tasks</CardDescription>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold text-primary">{profile?.coin_points || 0}</div>
                <div className="text-sm text-muted-foreground">Coin Points</div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Avatar & Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Picture & Name</CardTitle>
            <CardDescription>Update your profile picture and display name</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6">
              <Avatar className="h-24 w-24 border-2 border-primary/20">
                <AvatarImage src={imagePreview || avatarUrl} />
                <AvatarFallback className="text-2xl">
                  {fullName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Label htmlFor="avatarUrl">Avatar URL or Upload Image</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="avatarUrl"
                    value={avatarUrl}
                    onChange={(e) => {
                      setAvatarUrl(e.target.value);
                      setImagePreview(e.target.value);
                    }}
                    placeholder="https://example.com/avatar.jpg"
                  />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="avatar-upload"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    type="button"
                    disabled={uploadingImage}
                    onClick={() => document.getElementById('avatar-upload')?.click()}
                  >
                    {uploadingImage ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Upload an image or paste a URL (max 5MB)
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Bio */}
        <Card>
          <CardHeader>
            <CardTitle>Bio</CardTitle>
            <CardDescription>Tell others about yourself</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Write a short bio..."
              rows={4}
              className="resize-none"
            />
          </CardContent>
        </Card>

        {/* Skills */}
        <Card>
          <CardHeader>
            <CardTitle>Skills & Expertise</CardTitle>
            <CardDescription>Add up to 8 skills from predefined list or add custom skills</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addSkill()}
                placeholder="Add a custom skill"
              />
              <Button onClick={() => addSkill()} variant="outline" size="icon" disabled={skills.length >= 8}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Quick Add ({skills.length}/8):</p>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 border rounded-md">
                {PREDEFINED_SKILLS.map((skill) => (
                  <Badge
                    key={skill}
                    variant={skills.includes(skill) ? "default" : "outline"}
                    className="cursor-pointer hover:bg-primary/20"
                    onClick={() => skills.includes(skill) ? removeSkill(skill) : addSkill(skill)}
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="gap-1">
                  {skill}
                  <button
                    onClick={() => removeSkill(skill)}
                    className="ml-1 hover:bg-destructive/20 rounded-full"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>

            {skills.length === 0 && (
              <p className="text-sm text-muted-foreground italic">No skills added yet</p>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={fetchProfile} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
