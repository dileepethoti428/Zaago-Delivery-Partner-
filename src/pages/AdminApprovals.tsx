import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Loader2, ExternalLink, ArrowLeft, FileText, Image as ImageIcon } from "lucide-react";

interface PendingAgent {
  user_id: string;
  full_name: string;
  phone: string;
  email: string;
  created_at: string;
  documents: {
    aadhar_front_url?: string;
    aadhar_back_url?: string;
    dl_front_url?: string;
    dl_back_url?: string;
    profile_photo_url?: string;
  } | null;
}

const AdminApprovals = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pendingAgents, setPendingAgents] = useState<PendingAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<PendingAgent | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin");

      if (!roles || roles.length === 0) {
        toast({
          title: "Access Denied",
          description: "You don't have admin permissions",
          variant: "destructive",
        });
        navigate("/home");
        return;
      }

      setIsAdmin(true);
      fetchPendingAgents();
    } catch (error) {
      console.error("Error checking admin status:", error);
      navigate("/home");
    }
  };

  const fetchPendingAgents = async () => {
    try {
      setLoading(true);
      
      // Fetch profiles with pending approval
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, created_at")
        .eq("approval_status", "pending");

      if (profilesError) throw profilesError;

      // Fetch email and documents for each pending agent
      const agentsWithDocs = await Promise.all(
        (profiles || []).map(async (profile) => {
          // Get user email from auth
          const { data: userData } = await supabase.auth.admin.getUserById(profile.user_id);
          
          // Get documents
          const { data: docs } = await supabase
            .from("agent_documents")
            .select("aadhar_front_url, aadhar_back_url, dl_front_url, dl_back_url, profile_photo_url")
            .eq("user_id", profile.user_id)
            .maybeSingle();

          return {
            user_id: profile.user_id,
            full_name: profile.full_name,
            phone: profile.phone,
            email: userData?.user?.email || "N/A",
            created_at: profile.created_at,
            documents: docs,
          };
        })
      );

      setPendingAgents(agentsWithDocs);
    } catch (error) {
      console.error("Error fetching pending agents:", error);
      toast({
        title: "Error",
        description: "Failed to load pending agents",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (agent: PendingAgent) => {
    try {
      setProcessingId(agent.user_id);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "Authentication required",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.rpc("approve_agent_direct", {
        p_user_id: agent.user_id,
        p_approved: true,
        p_rejection_reason: null,
        p_admin_id: user.id,
      });

      if (error) throw error;

      toast({
        title: "Agent Approved",
        description: `${agent.full_name} has been approved successfully`,
      });

      // Remove from list
      setPendingAgents((prev) => prev.filter((a) => a.user_id !== agent.user_id));
    } catch (error: any) {
      console.error("Error approving agent:", error);
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve agent",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!selectedAgent || !rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a rejection reason",
        variant: "destructive",
      });
      return;
    }

    try {
      setProcessingId(selectedAgent.user_id);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "Authentication required",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.rpc("approve_agent_direct", {
        p_user_id: selectedAgent.user_id,
        p_approved: false,
        p_rejection_reason: rejectionReason,
        p_admin_id: user.id,
      });

      if (error) throw error;

      toast({
        title: "Agent Rejected",
        description: `${selectedAgent.full_name} has been rejected`,
      });

      // Remove from list
      setPendingAgents((prev) => prev.filter((a) => a.user_id !== selectedAgent.user_id));
      setShowRejectDialog(false);
      setSelectedAgent(null);
      setRejectionReason("");
    } catch (error: any) {
      console.error("Error rejecting agent:", error);
      toast({
        title: "Rejection Failed",
        description: error.message || "Failed to reject agent",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectDialog = (agent: PendingAgent) => {
    setSelectedAgent(agent);
    setShowRejectDialog(true);
  };

  const viewDocument = (url: string | undefined) => {
    if (url) {
      window.open(url, "_blank");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto p-4 pb-24">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/home")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Agent Approvals</h1>
          <p className="text-muted-foreground">Review and approve delivery agents</p>
        </div>
      </div>

      {pendingAgents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No Pending Approvals</h3>
            <p className="text-muted-foreground">All agents have been reviewed</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              Pending Agents <Badge variant="secondary">{pendingAgents.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead>Applied On</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingAgents.map((agent) => (
                    <TableRow key={agent.user_id}>
                      <TableCell className="font-medium">{agent.full_name}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{agent.phone}</div>
                          <div className="text-muted-foreground">{agent.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 flex-wrap">
                          {agent.documents?.profile_photo_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => viewDocument(agent.documents?.profile_photo_url)}
                            >
                              <ImageIcon className="w-4 h-4 mr-1" />
                              Photo
                            </Button>
                          )}
                          {agent.documents?.aadhar_front_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => viewDocument(agent.documents?.aadhar_front_url)}
                            >
                              <FileText className="w-4 h-4 mr-1" />
                              Aadhar F
                            </Button>
                          )}
                          {agent.documents?.aadhar_back_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => viewDocument(agent.documents?.aadhar_back_url)}
                            >
                              <FileText className="w-4 h-4 mr-1" />
                              Aadhar B
                            </Button>
                          )}
                          {agent.documents?.dl_front_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => viewDocument(agent.documents?.dl_front_url)}
                            >
                              <FileText className="w-4 h-4 mr-1" />
                              DL F
                            </Button>
                          )}
                          {agent.documents?.dl_back_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => viewDocument(agent.documents?.dl_back_url)}
                            >
                              <FileText className="w-4 h-4 mr-1" />
                              DL B
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{new Date(agent.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApprove(agent)}
                            disabled={processingId === agent.user_id}
                          >
                            {processingId === agent.user_id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Approve
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openRejectDialog(agent)}
                            disabled={processingId === agent.user_id}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Agent Application</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting {selectedAgent?.full_name}'s application. This will be shown to the
              applicant.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Enter rejection reason..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="min-h-[100px]"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectionReason("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} disabled={!rejectionReason.trim()}>
              Confirm Rejection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminApprovals;
