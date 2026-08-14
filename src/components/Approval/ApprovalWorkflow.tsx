import { useState } from "react";
import { CheckCircle, XCircle, Clock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface ApprovalWorkflowProps {
  issueId: string;
  currentStatus: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  approvalNotes?: string | null;
  reporterId: string;
  onStatusChange?: () => void;
}

export function ApprovalWorkflow({
  issueId,
  currentStatus,
  approvedBy,
  approvedAt,
  approvalNotes,
  reporterId,
  onStatusChange,
}: ApprovalWorkflowProps) {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const getStatusBadge = () => {
    switch (currentStatus) {
      case "approved":
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      case "pending_approval":
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pending Approval
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            Draft
          </Badge>
        );
    }
  };

  const requestApproval = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("issues")
      .update({ approval_status: "pending_approval" })
      .eq("id", issueId);

    if (error) {
      toast.error("Failed to request approval");
      setLoading(false);
      return;
    }

    // Create notification for project lead/managers
    const { data: issue } = await supabase
      .from("issues")
      .select("project_id, title, projects(lead_id)")
      .eq("id", issueId)
      .single();

    if (issue?.projects) {
      await supabase.from("notifications").insert({
        user_id: issue.projects.lead_id,
        type: "approval_request",
        title: "Approval Requested",
        message: `"${issue.title}" needs your approval`,
        link: `/issues/${issueId}`,
      });
    }

    toast.success("Approval requested successfully");
    setLoading(false);
    onStatusChange?.();
  };

  const handleApproval = async (status: "approved" | "rejected") => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("issues")
      .update({
        approval_status: status,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        approval_notes: notes || null,
      })
      .eq("id", issueId);

    if (error) {
      toast.error(`Failed to ${status === "approved" ? "approve" : "reject"}`);
      setLoading(false);
      return;
    }

    // Notify the reporter
    const { data: issue } = await supabase
      .from("issues")
      .select("title")
      .eq("id", issueId)
      .single();

    await supabase.from("notifications").insert({
      user_id: reporterId,
      type: status === "approved" ? "approval_granted" : "approval_rejected",
      title: status === "approved" ? "Content Approved" : "Content Rejected",
      message: `"${issue?.title}" has been ${status}${notes ? ": " + notes : ""}`,
      link: `/issues/${issueId}`,
    });

    toast.success(
      status === "approved"
        ? "Content approved successfully"
        : "Content rejected"
    );
    setLoading(false);
    setDialogOpen(false);
    setNotes("");
    onStatusChange?.();
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Approval Status</h3>
          {getStatusBadge()}
        </div>

        {approvedAt && (
          <div className="text-sm text-muted-foreground">
            <p>
              {currentStatus === "approved" ? "Approved" : "Rejected"} on{" "}
              {new Date(approvedAt).toLocaleDateString()}
            </p>
            {approvalNotes && (
              <p className="mt-2">
                <strong>Notes:</strong> {approvalNotes}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2">
          {currentStatus === "draft" && (
            <Button
              onClick={requestApproval}
              disabled={loading}
              className="flex-1"
            >
              <Send className="h-4 w-4 mr-2" />
              Request Approval
            </Button>
          )}

          {currentStatus === "pending_approval" && (
            <>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="default"
                    className="flex-1"
                    onClick={() => setDialogOpen(true)}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Approve Content</DialogTitle>
                    <DialogDescription>
                      Add optional notes about your approval decision.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="approval-notes">Notes (Optional)</Label>
                      <Textarea
                        id="approval-notes"
                        placeholder="Add any feedback or notes..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={4}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleApproval("approved")}
                        disabled={loading}
                        className="flex-1"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        onClick={() => handleApproval("rejected")}
                        disabled={loading}
                        variant="destructive"
                        className="flex-1"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
