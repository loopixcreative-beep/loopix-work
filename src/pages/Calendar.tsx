import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, Edit, Trash, Copy, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import NepaliDate from "nepali-date-converter";
import { ImageUploader } from "@/components/Calendar/ImageUploader";
import { FullScreenImageViewer } from "@/components/Calendar/FullScreenImageViewer";
import { 
  getNepaliMonth, 
  getMonthEvents, 
  nepaliMonthNames, 
  nepaliWeekDaysShort, 
  getApproximateBSYear,
  getApproximateBSMonth,
  englishToNepaliNumber,
  type NepaliDay
} from "@/utils/nepaliCalendar";

interface Project {
  id: string;
  name: string;
  key: string;
}

interface CalendarEntry {
  id: string;
  project_id: string;
  entry_date: string;
  title: string;
  content: string | null;
  images: string[] | null;
  reference_links: string[] | null;
}

const Calendar = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarSystem, setCalendarSystem] = useState<"AD" | "BS">("AD");
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [entryTitle, setEntryTitle] = useState("");
  const [entryContent, setEntryContent] = useState("");
  const [entryImages, setEntryImages] = useState<string[]>([]);
  const [entryReferences, setEntryReferences] = useState<string[]>([]);
  const [newImage, setNewImage] = useState("");
  const [newReference, setNewReference] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewingEntry, setViewingEntry] = useState<CalendarEntry | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [bsYear, setBsYear] = useState(2081);
  const [bsMonthIndex, setBsMonthIndex] = useState(0);
  const [nepaliMonthData, setNepaliMonthData] = useState<NepaliDay[]>([]);
  const [monthEvents, setMonthEvents] = useState<Array<{date: string; event: string; isHoliday: boolean; isSpecial: boolean}>>([]);
  const [fullScreenImages, setFullScreenImages] = useState<string[]>([]);
  const [fullScreenIndex, setFullScreenIndex] = useState(0);
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  useEffect(() => {
    if (selectedProject) {
      fetchEntries();
    }
  }, [selectedProject, currentDate]);

  // Initialize BS calendar when switching to BS mode
  useEffect(() => {
    if (calendarSystem === "BS") {
      const approximateBSYear = getApproximateBSYear(currentDate);
      const approximateBSMonth = getApproximateBSMonth(currentDate);
      setBsYear(approximateBSYear);
      setBsMonthIndex(approximateBSMonth);
    }
  }, [calendarSystem, currentDate]);

  // Load Nepali calendar data when BS year/month changes
  useEffect(() => {
    if (calendarSystem === "BS") {
      const monthName = nepaliMonthNames[bsMonthIndex];
      const monthData = getNepaliMonth(bsYear, monthName);
      setNepaliMonthData(monthData);
      
      const events = getMonthEvents(bsYear, monthName);
      setMonthEvents(events);
    }
  }, [bsYear, bsMonthIndex, calendarSystem]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, key")
        .order("name");

      if (error) throw error;
      setProjects(data || []);
      if (data && data.length > 0) {
        setSelectedProject(data[0].id);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  const fetchEntries = async () => {
    try {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);

      const { data, error } = await supabase
        .from("calendar_entries")
        .select("*")
        .eq("project_id", selectedProject)
        .gte("entry_date", format(start, "yyyy-MM-dd"))
        .lte("entry_date", format(end, "yyyy-MM-dd"));

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error("Error fetching entries:", error);
      toast.error("Failed to load calendar entries");
    }
  };

  const handleSaveEntry = async () => {
    if (!selectedDate || !entryTitle.trim()) {
      toast.error("Please provide a title");
      return;
    }

    try {
      if (isEditMode && editingEntryId) {
        const { error } = await supabase
          .from("calendar_entries")
          .update({
            title: entryTitle,
            content: entryContent || null,
            images: entryImages.length > 0 ? entryImages : null,
            reference_links: entryReferences.length > 0 ? entryReferences : null,
          })
          .eq("id", editingEntryId);

        if (error) throw error;
        toast.success("Entry updated successfully!");
      } else {
        const { error } = await supabase.from("calendar_entries").insert({
          project_id: selectedProject,
          user_id: user?.id,
          entry_date: format(selectedDate, "yyyy-MM-dd"),
          title: entryTitle,
          content: entryContent || null,
          images: entryImages.length > 0 ? entryImages : null,
          reference_links: entryReferences.length > 0 ? entryReferences : null,
        });

        if (error) throw error;
        toast.success("Entry added successfully!");
      }

      setIsDialogOpen(false);
      resetForm();
      fetchEntries();
    } catch (error) {
      console.error("Error saving entry:", error);
      toast.error("Failed to save entry");
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from("calendar_entries")
        .delete()
        .eq("id", entryId);

      if (error) throw error;

      toast.success("Entry deleted successfully!");
      setIsViewDialogOpen(false);
      setViewingEntry(null);
      fetchEntries();
    } catch (error) {
      console.error("Error deleting entry:", error);
      toast.error("Failed to delete entry");
    }
  };

  const handleEditEntry = (entry: CalendarEntry) => {
    setEditingEntryId(entry.id);
    setIsEditMode(true);
    setEntryTitle(entry.title);
    setEntryContent(entry.content || "");
    setEntryImages(entry.images || []);
    setEntryReferences(entry.reference_links || []);
    setSelectedDate(new Date(entry.entry_date));
    setIsViewDialogOpen(false);
    setIsDialogOpen(true);
  };

  const copyEntryLink = (entryId: string, entryDate: string) => {
    const link = `${window.location.origin}/calendar?entry=${entryId}&date=${entryDate}`;
    navigator.clipboard.writeText(link);
    toast.success("Entry link copied to clipboard!");
  };

  const resetForm = () => {
    setEntryTitle("");
    setEntryContent("");
    setEntryImages([]);
    setEntryReferences([]);
    setNewImage("");
    setNewReference("");
    setIsEditMode(false);
    setEditingEntryId(null);
  };

  const getEntriesForDate = (date: Date) => {
    return entries.filter((entry) => isSameDay(new Date(entry.entry_date), date));
  };

  // Recalculate month days whenever currentDate or BS calendar changes
  const getCalendarDays = () => {
    if (calendarSystem === "BS" && nepaliMonthData.length > 0) {
      // Use JSON data for BS calendar with proper alignment
      const calendarDays = [];
      
      // Find the first valid day to determine starting day of week
      const firstValidDay = nepaliMonthData.find(d => d.np && d.np !== '');
      if (!firstValidDay) return [];
      
      // Map day names to indices (sun=0, mon=1, etc.)
      const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
      const startDayOfWeek = dayMap[firstValidDay.day] || 0;
      
      // Add empty cells for alignment
      for (let i = 0; i < startDayOfWeek; i++) {
        calendarDays.push({ 
          date: null, 
          bsDate: null, 
          dayData: null,
          isPreviousMonth: true, 
          isNextMonth: false 
        });
      }
      
      // Add actual days
      nepaliMonthData.forEach(dayData => {
        if (dayData.np && dayData.np !== '') {
          // Create a mock AD date for this cell (not accurate, just for display)
          const mockDate = new Date(2024, 0, parseInt(dayData.en) || 1);
          calendarDays.push({
            date: mockDate,
            bsDate: dayData.np,
            dayData: dayData,
            isPreviousMonth: false,
            isNextMonth: false
          });
        }
      });
      
      return calendarDays;
    } else {
      // AD calendar with proper day-of-week alignment
      const firstDayOfMonth = startOfMonth(currentDate);
      const lastDayOfMonth = endOfMonth(currentDate);
      const daysInMonth = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth });
      
      const startDayOfWeek = firstDayOfMonth.getDay();
      const calendarDays = [];
      
      for (let i = 0; i < startDayOfWeek; i++) {
        calendarDays.push({ date: null, bsDate: null, dayData: null, isPreviousMonth: true, isNextMonth: false });
      }
      
      daysInMonth.forEach(day => {
        calendarDays.push({ date: day, bsDate: null, dayData: null, isPreviousMonth: false, isNextMonth: false });
      });
      
      return calendarDays;
    }
  };

  const calendarDays = getCalendarDays();

  const selectedProjectName = projects.find((p) => p.id === selectedProject)?.name || "Select Project";

  // Format month/year display based on calendar system
  const getMonthYearDisplay = () => {
    if (calendarSystem === "AD") {
      return format(currentDate, "MMMM yyyy");
    } else {
      return `${nepaliMonthNames[bsMonthIndex]} ${englishToNepaliNumber(bsYear)}`;
    }
  };

  // Navigation handlers for BS calendar
  const handlePreviousMonth = () => {
    if (calendarSystem === "BS") {
      if (bsMonthIndex === 0) {
        setBsYear(bsYear - 1);
        setBsMonthIndex(11);
      } else {
        setBsMonthIndex(bsMonthIndex - 1);
      }
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const handleNextMonth = () => {
    if (calendarSystem === "BS") {
      if (bsMonthIndex === 11) {
        setBsYear(bsYear + 1);
        setBsMonthIndex(0);
      } else {
        setBsMonthIndex(bsMonthIndex + 1);
      }
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-96 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Project Calendar</h1>
        <p className="text-muted-foreground mt-1">Manage events and notes for each project</p>
      </div>

      <div className="grid gap-6">
        {/* Controls */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
              <div className="flex gap-2">
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue>{selectedProjectName}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={calendarSystem} onValueChange={(v) => setCalendarSystem(v as "AD" | "BS")}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AD">AD</SelectItem>
                    <SelectItem value="BS">BS (Nepali)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={handlePreviousMonth}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-lg font-semibold min-w-[200px] text-center">
                  {getMonthYearDisplay()}
                </div>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={handleNextMonth}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Calendar Grid */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-7 gap-2">
              {/* Day names header */}
              {calendarSystem === "BS" ? (
                nepaliWeekDaysShort.map((day: string, idx: number) => (
                  <div key={idx} className="text-center font-semibold text-sm text-muted-foreground py-2">
                    {day}
                  </div>
                ))
              ) : (
                ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="text-center font-semibold text-sm text-muted-foreground py-2">
                    {day}
                  </div>
                ))
              )}

              {/* Calendar days */}
              {calendarDays.map((dayInfo, index) => {
                if (!dayInfo.date) {
                  return <div key={`empty-${index}`} className="aspect-square" />;
                }

                const day = dayInfo.date;
                const dayEntries = getEntriesForDate(day);
                const isToday = calendarSystem === "AD" && isSameDay(day, new Date());
                const isCurrentMonth = calendarSystem === "AD" ? isSameMonth(day, currentDate) : true;
                const hasEvent = dayInfo.dayData?.event && dayInfo.dayData.event.trim() !== '';
                const isHoliday = dayInfo.dayData?.holiday || false;

                return (
                  <button
                    key={`day-${index}`}
                    onClick={() => {
                      const dayEntriesForClick = getEntriesForDate(day);
                      setSelectedDate(day);
                      if (dayEntriesForClick.length > 0) {
                        setViewingEntry(dayEntriesForClick[0]);
                        setIsViewDialogOpen(true);
                      } else {
                        resetForm();
                        setIsDialogOpen(true);
                      }
                    }}
                    className={`
                      aspect-square p-2 rounded-md border transition-all relative
                      ${isCurrentMonth ? "bg-background" : "bg-muted/50"}
                      ${isToday ? "border-primary border-2 bg-primary/10" : "border-border"}
                      ${isHoliday ? "bg-destructive/10 border-destructive/30" : ""}
                      ${dayEntries.length > 0 ? "bg-accent/30" : ""}
                      hover:bg-accent hover:shadow-md
                    `}
                  >
                    <div className="flex flex-col h-full">
                      <div className="flex items-start justify-between">
                        <span className={`text-sm font-medium ${isToday ? "text-primary font-bold" : "text-foreground"}`}>
                          {calendarSystem === "BS" && dayInfo.bsDate ? dayInfo.bsDate : format(day, "d")}
                        </span>
                        {hasEvent && (
                          <span className={`text-xs ${isHoliday ? "text-destructive" : "text-primary"}`}>●</span>
                        )}
                      </div>
                      {hasEvent && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1" title={dayInfo.dayData?.event}>
                          {dayInfo.dayData?.event}
                        </p>
                      )}
                      {dayEntries.length > 0 && (
                        <div className="mt-auto flex flex-wrap gap-1">
                          {dayEntries.slice(0, 1).map((entry, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs px-1 py-0 h-4">
                              {entry.title.length > 6 ? entry.title.substring(0, 6) + "..." : entry.title}
                            </Badge>
                          ))}
                          {dayEntries.length > 1 && (
                            <Badge variant="outline" className="text-xs px-1 py-0 h-4">
                              +{dayEntries.length - 1}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Events and Holidays Section */}
        {calendarSystem === "BS" && monthEvents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Events & Holidays - {nepaliMonthNames[bsMonthIndex]} {englishToNepaliNumber(bsYear)}</CardTitle>
              <CardDescription>Special occasions, festivals, and holidays this month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {monthEvents.map((event, idx) => (
                  <div 
                    key={idx} 
                    className={`p-3 rounded-lg border ${
                      event.isHoliday 
                        ? 'bg-destructive/10 border-destructive/30' 
                        : event.isSpecial 
                        ? 'bg-primary/10 border-primary/30' 
                        : 'bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-semibold text-sm mb-1">{event.event}</p>
                        <p className="text-xs text-muted-foreground">
                          {nepaliMonthNames[bsMonthIndex]} {event.date}
                        </p>
                      </div>
                      {event.isHoliday && (
                        <Badge variant="destructive" className="text-xs">Holiday</Badge>
                      )}
                      {event.isSpecial && !event.isHoliday && (
                        <Badge variant="default" className="text-xs">Special</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add/Edit Entry Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Edit Entry" : "Add Entry"} for {selectedDate && format(selectedDate, "MMMM d, yyyy")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={entryTitle}
                onChange={(e) => setEntryTitle(e.target.value)}
                placeholder="Entry title"
              />
            </div>

            <div>
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={entryContent}
                onChange={(e) => setEntryContent(e.target.value)}
                placeholder="Add notes or details..."
                rows={4}
              />
            </div>

            <div>
              <Label>Images</Label>
              <ImageUploader
                images={entryImages}
                onImagesChange={setEntryImages}
                userId={user?.id || ''}
              />
            </div>

            <div>
              <Label>References</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={newReference}
                  onChange={(e) => setNewReference(e.target.value)}
                  placeholder="Reference link or note"
                />
                <Button
                  onClick={() => {
                    if (newReference.trim()) {
                      setEntryReferences([...entryReferences, newReference.trim()]);
                      setNewReference("");
                    }
                  }}
                  variant="outline"
                  size="icon"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {entryReferences.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {entryReferences.map((ref, idx) => (
                    <Badge key={idx} variant="secondary" className="gap-1">
                      Ref {idx + 1}
                      <button onClick={() => setEntryReferences(entryReferences.filter((_, i) => i !== idx))}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => {
                setIsDialogOpen(false);
                resetForm();
              }}>
                Cancel
              </Button>
              <Button onClick={handleSaveEntry}>
                {isEditMode ? "Update Entry" : "Save Entry"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Entry Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewingEntry && format(new Date(viewingEntry.entry_date), "MMMM d, yyyy")}
            </DialogTitle>
          </DialogHeader>

          {viewingEntry && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold">{viewingEntry.title}</h3>
              </div>

              {viewingEntry.content && (
                <div>
                  <Label>Content</Label>
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{viewingEntry.content}</p>
                </div>
              )}

              {viewingEntry.images && viewingEntry.images.length > 0 && (
                <div>
                  <Label className="mb-2">Images ({viewingEntry.images.length})</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                    {viewingEntry.images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setFullScreenImages(viewingEntry.images || []);
                          setFullScreenIndex(idx);
                          setIsFullScreenOpen(true);
                        }}
                        className="relative aspect-square rounded-md overflow-hidden border hover:border-primary transition-colors group"
                      >
                        <img
                          src={img}
                          alt={`Image ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <span className="text-white opacity-0 group-hover:opacity-100 text-sm font-medium">
                            View Full Screen
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {viewingEntry.reference_links && viewingEntry.reference_links.length > 0 && (
                <div>
                  <Label>References</Label>
                  <div className="space-y-1 mt-2">
                    {viewingEntry.reference_links.map((ref, idx) => (
                      <a key={idx} href={ref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                        <ExternalLink className="h-3 w-3" />
                        {ref}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyEntryLink(viewingEntry.id, viewingEntry.entry_date)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditEntry(viewingEntry)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteEntry(viewingEntry.id)}
                  >
                    <Trash className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Full Screen Image Viewer */}
      <FullScreenImageViewer
        images={fullScreenImages}
        initialIndex={fullScreenIndex}
        open={isFullScreenOpen}
        onClose={() => setIsFullScreenOpen(false)}
      />
    </div>
  );
};

export default Calendar;
