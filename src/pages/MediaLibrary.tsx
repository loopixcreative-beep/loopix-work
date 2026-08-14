import { useState, useEffect, useMemo } from "react";
import { StatCard } from "@/components/ui/stat-card";
import { HardDrive, Tags, Files } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Upload,
  Search,
  Trash2,
  Download,
  Image as ImageIcon,
  Video,
  File,
  Filter,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MediaItem {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  mime_type: string;
  tags: string[];
  description: string | null;
  created_at: string;
  project_id: string | null;
}

export default function MediaLibrary() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [filteredMedia, setFilteredMedia] = useState<MediaItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    fetchMedia();
    fetchProjects();
  }, []);

  useEffect(() => {
    filterMedia();
  }, [media, searchQuery, typeFilter]);

  const fetchProjects = async () => {
    const { data } = await supabase.from("projects").select("id, name");
    setProjects(data || []);
  };

  const fetchMedia = async () => {
    const { data, error } = await supabase
      .from("media_library")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to fetch media");
      return;
    }

    setMedia(data || []);
  };

  const filterMedia = () => {
    let filtered = [...media];

    if (searchQuery) {
      filtered = filtered.filter(
        (item) =>
          item.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.tags.some((tag) =>
            tag.toLowerCase().includes(searchQuery.toLowerCase())
          )
      );
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((item) => item.file_type === typeFilter);
    }

    setFilteredMedia(filtered);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Upload to storage
    const fileExt = selectedFile.name.split(".").pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("calendar-images")
      .upload(filePath, selectedFile);

    if (uploadError) {
      toast.error("Failed to upload file");
      setUploading(false);
      return;
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("calendar-images").getPublicUrl(filePath);

    // Save to media_library
    const fileType = selectedFile.type.startsWith("image/")
      ? "image"
      : selectedFile.type.startsWith("video/")
      ? "video"
      : "file";

    const { error: dbError } = await supabase.from("media_library").insert({
      user_id: user.id,
      project_id: projectId || null,
      file_name: selectedFile.name,
      file_url: publicUrl,
      file_type: fileType,
      file_size: selectedFile.size,
      mime_type: selectedFile.type,
      tags: tags ? tags.split(",").map((t) => t.trim()) : [],
      description: description || null,
    });

    if (dbError) {
      toast.error("Failed to save media info");
      setUploading(false);
      return;
    }

    toast.success("Media uploaded successfully");
    setUploading(false);
    setUploadDialogOpen(false);
    setSelectedFile(null);
    setDescription("");
    setTags("");
    setProjectId("");
    fetchMedia();
  };

  const handleDelete = async (id: string, fileUrl: string) => {
    if (!confirm("Are you sure you want to delete this media?")) return;

    // Extract file path from URL
    const urlParts = fileUrl.split("/");
    const filePath = urlParts.slice(-2).join("/");

    // Delete from storage
    await supabase.storage.from("calendar-images").remove([filePath]);

    // Delete from database
    const { error } = await supabase
      .from("media_library")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete media");
      return;
    }

    toast.success("Media deleted successfully");
    fetchMedia();
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case "image":
        return <ImageIcon className="h-5 w-5" />;
      case "video":
        return <Video className="h-5 w-5" />;
      default:
        return <File className="h-5 w-5" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  const stats = useMemo(() => {
    const totalBytes = media.reduce((sum, m) => sum + (m.file_size || 0), 0);
    const images = media.filter((m) => m.file_type === "image").length;
    const videos = media.filter((m) => m.file_type === "video").length;
    const others = media.length - images - videos;
    const tagged = media.filter((m) => (m.tags || []).length > 0).length;
    const linked = media.filter((m) => !!m.project_id).length;
    const tagCounts: Record<string, number> = {};
    media.forEach((m) =>
      (m.tags || []).forEach((t) => (tagCounts[t] = (tagCounts[t] || 0) + 1))
    );
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const last30 = media.filter(
      (m) =>
        new Date(m.created_at).getTime() >
        Date.now() - 30 * 24 * 60 * 60 * 1000
    ).length;
    return {
      totalBytes,
      images,
      videos,
      others,
      tagged,
      linked,
      topTags,
      last30,
      avgSize: media.length ? totalBytes / media.length : 0,
    };
  }, [media]);

  return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Media Library</h1>

          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="h-4 w-4 mr-2" />
                Upload Media
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Media</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="file">File</Label>
                  <Input
                    id="file"
                    type="file"
                    onChange={handleFileSelect}
                    accept="image/*,video/*"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project">Project (Optional)</Label>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe this media..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    placeholder="marketing, banner, social"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  className="w-full"
                >
                  {uploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Total files"
            value={media.length}
            hint={`${stats.last30} added in 30 days`}
            icon={Files}
            tone="blue"
          />
          <StatCard
            label="Images"
            value={stats.images}
            icon={ImageIcon}
            tone="sky"
            progress={media.length ? (stats.images / media.length) * 100 : 0}
          />
          <StatCard
            label="Videos"
            value={stats.videos}
            icon={Video}
            tone="orange"
            progress={media.length ? (stats.videos / media.length) * 100 : 0}
          />
          <StatCard
            label="Storage used"
            value={formatFileSize(stats.totalBytes)}
            hint={`avg ${formatFileSize(Math.round(stats.avgSize))}`}
            icon={HardDrive}
            tone="amber"
          />
          <StatCard
            label="Tagged"
            value={stats.tagged}
            icon={Tags}
            tone="violet"
            progress={media.length ? (stats.tagged / media.length) * 100 : 0}
          />
          <StatCard
            label="Linked to projects"
            value={stats.linked}
            icon={File}
            tone="green"
            progress={media.length ? (stats.linked / media.length) * 100 : 0}
          />
        </div>

        {stats.topTags.length > 0 && (
          <Card className="p-4">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Top tags
            </p>
            <div className="flex flex-wrap gap-2">
              {stats.topTags.map(([tag, count]) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="cursor-pointer border-chart-2/40 bg-chart-2/10 text-foreground hover:bg-chart-2/20"
                  onClick={() => setSearchQuery(tag)}
                >
                  {tag} <span className="ml-1 text-muted-foreground">{count}</span>
                </Badge>
              ))}
            </div>
          </Card>
        )}



        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search media..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="image">Images</SelectItem>
              <SelectItem value="video">Videos</SelectItem>
              <SelectItem value="file">Files</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredMedia.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <div className="aspect-video bg-muted flex items-center justify-center">
                {item.file_type === "image" ? (
                  <img
                    src={item.file_url}
                    alt={item.file_name}
                    className="w-full h-full object-cover"
                  />
                ) : item.file_type === "video" ? (
                  <video
                    src={item.file_url}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  getFileIcon(item.file_type)
                )}
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {item.file_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(item.file_size)}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {getFileIcon(item.file_type)}
                  </Badge>
                </div>
                {item.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {item.description}
                  </p>
                )}
                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.tags.slice(0, 3).map((tag, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.open(item.file_url, "_blank")}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(item.id, item.file_url)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filteredMedia.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No media found. Upload your first file!</p>
          </div>
        )}
      </div>
  );
}
