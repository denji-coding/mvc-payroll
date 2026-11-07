import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMyLeaveRequests, useCreateLeaveRequest, useCancelLeaveRequest, useLeaveCredits, calculateWorkingDays } from "@/hooks/useLeaves";
import { useLwpConfig } from "@/hooks/useSettings";
import { useLeaveTypes, LeaveType } from "@/hooks/useLeaveTypes";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Upload, Heart, Palmtree, AlertTriangle, Baby, Flower2, Ban, CalendarDays, Trash2, Clock, MessageSquareText } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, startOfToday, isBefore, isAfter } from "date-fns";
import { cn } from "@/lib/utils";
import { formatFullName } from "@/lib/formatName";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { useQuery } from "@tanstack/react-query";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { LeaveLetterPdfIcon } from "@/components/icons/LeaveLetterPdfIcon";
import { LeaveApprovalLetterDialog } from "@/components/leaves/LeaveApprovalLetterDialog";
import type { GenerateLeaveApprovalLetterParams } from "@/lib/generateLeaveApprovalLetter";
import { useIsMobile } from "@/hooks/use-mobile";

interface MobileLeaveListProps {
  leaves: any[];
  getStatusBadge: (status: string) => JSX.Element;
  onViewComment: (comment: string) => void;
  onViewLetter: (leave: any) => void;
  onCancel: (id: string) => void;
  cancelling: boolean;
  canOpenLetter: boolean;
}

function MobileLeaveList({
  leaves,
  getStatusBadge,
  onViewComment,
  onViewLetter,
  onCancel,
  cancelling,
  canOpenLetter,
}: MobileLeaveListProps) {
  if (!leaves.length) {
    return <div className="text-center py-8 text-muted-foreground">No leave requests found</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-primary font-medium">
        <CalendarDays className="h-4 w-4" />
        {leaves.length} leave request{leaves.length === 1 ? "" : "s"} found
      </div>

      {leaves.map((leave: any) => {
        const comment = (leave.hr_remarks as string | null)?.trim();
        const isApproved = leave.status === "hr_approved";
        const isRejected = leave.status === "rejected";
        const canCancel = leave.status === "pending";
        return (
          <div key={leave.id} className="rounded-lg border bg-card shadow-sm p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold capitalize break-words">{leave.leave_type}</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {((leave.pay_type as string) || "with_pay").replace("_", " ")}
                </p>
                <div className="mt-3 space-y-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>
                      {format(new Date(leave.start_date + "T00:00:00"), "MMM d, yyyy")} –{" "}
                      {format(new Date(leave.end_date + "T00:00:00"), "MMM d, yyyy")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>
                      {leave.total_days} day{Number(leave.total_days) === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-stretch gap-2 sm:w-[52%] sm:border-l sm:pl-4">
                <div className="flex">{getStatusBadge(leave.status)}</div>
                <div className="flex flex-wrap gap-2">
                  {comment && (
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 min-w-[130px]",
                        isRejected && "border-destructive text-destructive hover:text-destructive",
                      )}
                      onClick={() => onViewComment(comment)}
                    >
                      <MessageSquareText className="h-4 w-4 mr-2" />
                      HR Comment
                    </Button>
                  )}
                  {isApproved && (
                    <Button
                      className="flex-1 min-w-[130px]"
                      disabled={!canOpenLetter}
                      onClick={() => onViewLetter(leave)}
                    >
                      View
                    </Button>
                  )}
                  {canCancel && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="flex-1 min-w-[130px] border-destructive text-destructive hover:text-destructive"
                          disabled={cancelling}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel Leave Request?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will cancel your {leave.leave_type} leave request (
                            {format(new Date(leave.start_date + "T00:00:00"), "MMM d")} -{" "}
                            {format(new Date(leave.end_date + "T00:00:00"), "MMM d, yyyy")}). This action cannot be
                            undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep Request</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onCancel(leave.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {cancelling ? "Cancelling..." : "Cancel Request"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


const LEAVE_TYPE_ICON_MAP: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  sick: { icon: Heart, color: "text-destructive" },
  vacation: { icon: Palmtree, color: "text-success" },
  emergency: { icon: AlertTriangle, color: "text-warning" },
  maternity: { icon: Baby, color: "text-pink-500" },
  paternity: { icon: Baby, color: "text-blue-500" },
  bereavement: { icon: Flower2, color: "text-muted-foreground" },
  unpaid: { icon: Ban, color: "text-muted-foreground" },
};

const getLeaveTypeVisuals = (name: string) => {
  const lower = name.toLowerCase();
  for (const [key, val] of Object.entries(LEAVE_TYPE_ICON_MAP)) {
    if (lower.includes(key)) return val;
  }
  return { icon: CalendarDays, color: "text-primary" };
};

const normalizeLeaveTypeKey = (value?: string | null) =>
  (value || "")
    .toLowerCase()
    .replace(/\s+leave$/i, "")
    .replace(/\s+/g, "_")
    .trim();

const findCreditForLeaveType = (leaveTypeName: string, leaveCredits?: any[]) => {
  const leaveTypeKey = normalizeLeaveTypeKey(leaveTypeName);
  return leaveCredits?.find((credit: any) => normalizeLeaveTypeKey(credit.leave_type) === leaveTypeKey);
};

export default function Leaves() {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const { data: myLeaves, isLoading } = useMyLeaveRequests();
  const { data: credits } = useLeaveCredits();
  const { data: leaveTypes } = useLeaveTypes();
  const { data: lwpConfig } = useLwpConfig();
  const { data: companyInfo } = useCompanyInfo();
  const createLeave = useCreateLeaveRequest();
  const cancelLeave = useCancelLeaveRequest();
  const [letterParams, setLetterParams] = useState<GenerateLeaveApprovalLetterParams | null>(null);
  const [hrComment, setHrComment] = useState<string | null>(null);


  const { data: myEmployee } = useQuery({
    queryKey: ["my-employee-letter-info", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("employees")
        .select("first_name, middle_name, last_name, suffix_name, employee_id, position")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });


  const activeLeaveTypes = (leaveTypes || []).filter((lt) => lt.is_active);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ leave_type: "", reason: "", pay_type: "with_pay" as "with_pay" | "without_pay" });
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filterMonth, setFilterMonth] = useState<string>(format(new Date(), "yyyy-MM"));

  const today = startOfToday();
  const selectedLeaveType: LeaveType | undefined = activeLeaveTypes.find((lt) => lt.name === form.leave_type);
  const calculatedDays = startDate && endDate ? calculateWorkingDays(startDate, endDate) : 0;

  // Determine if upload field should show based on leave type config
  const hasUploadRequired = selectedLeaveType?.required_fields?.includes("upload");
  const uploadConditionDays = selectedLeaveType?.upload_condition_days;
  const showUploadField = hasUploadRequired && uploadConditionDays && calculatedDays >= uploadConditionDays;
  const showReasonField = !showUploadField;

  // Credits check — use credits_per_application from leave type config as source of truth
  const credit = findCreditForLeaveType(form.leave_type, credits);
  const totalCredits = Number(selectedLeaveType?.credits_per_application) || 0;
  const availableCredits = Math.max(totalCredits - (credit?.used_credits || 0), 0);
  const hasCredits = !selectedLeaveType || availableCredits > 0;

  // LWP (Leave With Pay) credits check
  const lwpCreditsUsed = useMemo(() => {
    if (!myLeaves) return 0;
    const currentYear = new Date().getFullYear();
    // Count total days of approved or pending "with_pay" leaves in the current year
    return myLeaves
      .filter((l: any) => {
        if (l.pay_type !== 'with_pay') return false;
        if (!['pending', 'manager_approved', 'hr_approved'].includes(l.status)) return false;
        const leaveYear = new Date(l.start_date).getFullYear();
        return leaveYear === currentYear;
      })
      .reduce((sum: number, l: any) => sum + (l.total_days || 0), 0);
  }, [myLeaves]);

  const lwpMaxCredits = lwpConfig?.paid_leave_credits || 3;
  const lwpRemaining = Math.max(0, lwpMaxCredits - lwpCreditsUsed);
  const lwpExhausted = lwpRemaining <= 0;

  // Check if employee has a pending leave request
  const hasPendingLeave = useMemo(() => {
    if (!myLeaves) return false;
    return myLeaves.some((l: any) => l.status === 'pending');
  }, [myLeaves]);

  // Dates already covered by a pending/approved leave request
  const isAppliedDate = useMemo(() => {
    const ranges = (myLeaves || [])
      .filter((l: any) => ['pending', 'manager_approved', 'hr_approved'].includes(l.status))
      .map((l: any) => ({ start: l.start_date, end: l.end_date }));
    return (date: Date) => {
      const key = format(date, "yyyy-MM-dd");
      return ranges.some((r) => r.start <= key && r.end >= key);
    };
  }, [myLeaves]);

  // Max days limit check
  const maxDays = selectedLeaveType?.max_days_per_application || selectedLeaveType?.default_credits;
  const exceedsLimit = maxDays && calculatedDays > maxDays;

  useEffect(() => {
    setStartDate(undefined);
    setEndDate(undefined);
    setAttachmentFile(null);
  }, [form.leave_type]);

  // Auto-switch to without_pay when LWP exhausted
  useEffect(() => {
    if (lwpExhausted && form.pay_type === 'with_pay') {
      setForm(f => ({ ...f, pay_type: 'without_pay' }));
    }
  }, [lwpExhausted, form.pay_type]);

  const getDateDisabledFn = () => {
    const config = selectedLeaveType?.calendar_config || "disable_past";
    if (config === "disable_future") return (date: Date) => isAfter(date, today);
    if (config === "disable_past") return (date: Date) => isBefore(date, today);
    return () => false; // no_disable
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }
      setAttachmentFile(file);
    }
  };

  const uploadAttachment = async (): Promise<string | null> => {
    if (!attachmentFile || !user) return null;
    const fileExt = attachmentFile.name.split(".").pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from("medical-certificates").upload(fileName, attachmentFile);
    if (error) throw new Error("Failed to upload attachment");
    // Store just the file path — bucket is private, use signed URLs to view
    return fileName;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.leave_type || !startDate || !endDate) return;
    if (!hasCredits) {
      toast.error("No available credits for this leave type. Please wait for credit refresh.");
      return;
    }
    if (exceedsLimit) {
      toast.error(`Cannot exceed ${maxDays} days limit for ${form.leave_type}.`);
      return;
    }

    // Overlap validation against existing approved leaves (same employee)
    const newStart = format(startDate, "yyyy-MM-dd");
    const newEnd = format(endDate, "yyyy-MM-dd");
    const hasOverlap = (myLeaves || []).some((l: any) => {
      if (!['manager_approved', 'hr_approved'].includes(l.status)) return false;
      return l.start_date <= newEnd && l.end_date >= newStart;
    });
    if (hasOverlap) {
      toast.error("The selected date range overlaps with an existing approved leave request.");
      return;
    }
    try {
      setUploading(true);
      let attachmentUrl: string | null = null;
      if (showUploadField && attachmentFile) attachmentUrl = await uploadAttachment();

      const leaveTypeValue = normalizeLeaveTypeKey(form.leave_type);
      createLeave.mutate(
        {
          leave_type: leaveTypeValue as any,
          start_date: format(startDate, "yyyy-MM-dd"),
          end_date: format(endDate, "yyyy-MM-dd"),
          total_days: calculatedDays,
          reason: form.reason || null,
          medical_certificate_url: attachmentUrl,
          pay_type: form.pay_type,
        },
        {
          onSuccess: () => {
            setForm({ leave_type: "", reason: "", pay_type: "with_pay" });
            setStartDate(undefined);
            setEndDate(undefined);
            setAttachmentFile(null);
            setOpen(false);
          },
        },
      );
    } catch {
      toast.error("Failed to submit leave request");
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-warning/20 text-warning",
      manager_approved: "bg-info/20 text-info",
      hr_approved: "bg-success/20 text-success",
      rejected: "bg-destructive/20 text-destructive",
      cancelled: "bg-muted text-muted-foreground",
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || styles.pending}`}>
        {status.replace("_", " ")}
      </span>
    );
  };

  const openLetter = async (leave: any) => {
    if (!myEmployee) return;
    let approvedByName: string | null = null;
    if (leave.hr_id) {
      const { data: rpcName } = await supabase.rpc("get_leave_approver_name", { _leave_id: leave.id });
      if (rpcName) {
        approvedByName = rpcName as string;
      } else {
        const { data: hrEmployee } = await supabase
          .from("employees")
          .select("first_name, middle_name, last_name, suffix_name")
          .eq("user_id", leave.hr_id)
          .maybeSingle();
        if (hrEmployee) {
          approvedByName =
            formatFullName(
              hrEmployee.first_name,
              hrEmployee.last_name,
              hrEmployee.suffix_name,
              hrEmployee.middle_name,
            ) || null;
        } else {
          const { data: hrProfile } = await supabase
            .from("profiles")
            .select("first_name, middle_name, last_name")
            .eq("id", leave.hr_id)
            .maybeSingle();
          if (hrProfile) {
            approvedByName =
              formatFullName(hrProfile.first_name, hrProfile.last_name, null, hrProfile.middle_name) || null;
          }
        }
      }
    }
    setLetterParams({
      employee: myEmployee as any,
      request: leave,
      companyName: companyInfo?.company_name,
      companyLogoUrl: companyInfo?.company_logo_url,
      approvedByName,
    });
  };


  const columns: ColumnDef<any, any>[] = [
    {
      accessorKey: "leave_type",
      header: "Type",
      cell: ({ getValue }) => <span className="capitalize">{getValue() as string}</span>,
    },
    {
      accessorKey: "pay_type",
      header: "Pay Type",
      cell: ({ getValue }) => (
        <span className="capitalize">{((getValue() as string) || "with_pay").replace("_", " ")}</span>
      ),
    },
    {
      accessorKey: "start_date",
      header: "Start",
      cell: ({ getValue }) => format(new Date((getValue() as string) + "T00:00:00"), "MMM d, yyyy"),
    },
    {
      accessorKey: "end_date",
      header: "End",
      cell: ({ getValue }) => format(new Date((getValue() as string) + "T00:00:00"), "MMM d, yyyy"),
    },
    { accessorKey: "total_days", header: "Days" },
    {
      accessorKey: "hr_remarks",
      header: "HR Comment",
      enableSorting: false,
      cell: ({ getValue }) => {
        const value = (getValue() as string | null)?.trim();
        return value ? (
          <Button
            variant="ghost"
            size="icon"
            title="View HR comment"
            onClick={() => setHrComment(value)}
          >
            <MessageSquareText className="h-5 w-5 text-primary" />
          </Button>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => getStatusBadge(getValue() as string) },
    {
      id: "actions",
      header: "Action",
      enableSorting: false,
      cell: ({ row }) => {
        const leave = row.original;
        const canCancel = leave.status === "pending";
        const isApproved = leave.status === "hr_approved";
        if (!canCancel && !isApproved) return null;
        if (isApproved) {
          return (
            <Button
              variant="ghost"
              size="icon"
              title="View Leave Approval Letter"
              disabled={!myEmployee}
              onClick={() => openLetter(leave)}
            >
              <LeaveLetterPdfIcon className="h-5 w-5" />
            </Button>
          );

        }
        return (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" title="Cancel leave request" className="text-destructive hover:text-destructive" disabled={cancelLeave.isPending} className_pending>
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel Leave Request?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will cancel your {leave.leave_type} leave request ({format(new Date(leave.start_date + "T00:00:00"), "MMM d")} - {format(new Date(leave.end_date + "T00:00:00"), "MMM d, yyyy")}). This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Request</AlertDialogCancel>
                <AlertDialogAction onClick={() => cancelLeave.mutate(leave.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Cancel Request
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      },
    },
  ];

  const filteredLeaves = useMemo(() => {
    if (!myLeaves) return [];
    if (!filterMonth || filterMonth === "all") return myLeaves;
    const [year, month] = filterMonth.split("-").map(Number);
    return myLeaves.filter((l: any) => {
      const d = new Date(l.start_date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
  }, [myLeaves, filterMonth]);

  const monthOptions = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(year, i, 1);
      return {
        value: format(d, "yyyy-MM"),
        label: format(d, "MMMM"),
      };
    });
  }, []);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">My Leaves</h1>
        <Dialog open={open} onOpenChange={(o) => { if (createLeave.isPending || uploading) return; setOpen(o); }}>
          <DialogTrigger asChild>
            <Button disabled={hasPendingLeave} title={hasPendingLeave ? "You have a pending leave request" : undefined}>
              <Plus className="mr-2 h-4 w-4" /> Request Leave
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[100vh] overflow-visible">
            <DialogHeader>
              <DialogTitle>New Leave Request</DialogTitle>
            </DialogHeader>
            <div className="max-h-[75vh] overflow-y-auto overflow-x-visible px-1 pb-1">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Leave Type</Label>
                  <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="p-4">
                      {activeLeaveTypes.map((t) => (
                        <SelectItem key={t.name} value={t.name}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedLeaveType && !hasCredits && (
                  <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
                    No available credits for this leave type. Please wait for credit refresh.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>From</Label>
                    <DatePicker
                      date={startDate}
                      onDateChange={setStartDate}
                      placeholder="Select a Date"
                      disabled={!form.leave_type}
                      disabledDates={getDateDisabledFn()}
                      markedDates={isAppliedDate}
                      markedLabel="Leave already applied"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>To</Label>
                    <DatePicker
                      date={endDate}
                      onDateChange={setEndDate}
                      placeholder="Select a Date"
                      disabled={!form.leave_type}
                      disabledDates={(date) => {
                        const typeDisabled = getDateDisabledFn()(date);
                        const beforeStart = startDate ? isBefore(date, startDate) : false;
                        return typeDisabled || beforeStart;
                      }}
                      markedDates={isAppliedDate}
                      markedLabel="Leave already applied"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Pay Type</Label>
                  <RadioGroup
                    value={lwpExhausted ? "without_pay" : form.pay_type}
                    onValueChange={(v) => setForm({ ...form, pay_type: v as "with_pay" | "without_pay" })}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="with_pay" id="with_pay" disabled={lwpExhausted} />
                      <Label htmlFor="with_pay" className={cn("cursor-pointer", lwpExhausted && "opacity-50 cursor-not-allowed")}>
                        With Pay
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="without_pay" id="without_pay" />
                      <Label htmlFor="without_pay" className="cursor-pointer">
                        Without Pay
                      </Label>
                    </div>
                  </RadioGroup>
                  {lwpExhausted && (
                    <p className="text-xs text-destructive">You have used all {lwpMaxCredits} Leave With Pay credits. Only "Without Pay" is available.</p>
                  )}
                  {!lwpExhausted && (
                    <p className="text-xs text-muted-foreground">LWP remaining: {lwpRemaining} of {lwpMaxCredits} days</p>
                  )}
                </div>
                {calculatedDays > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Total working days:{" "}
                      <span className={cn("font-medium", exceedsLimit ? "text-destructive" : "text-foreground")}>
                        {calculatedDays}
                      </span>
                    </p>
                    {exceedsLimit && (
                      <p className="text-xs text-destructive">
                        Exceeds the maximum limit of {maxDays} days for this leave type.
                      </p>
                    )}
                  </div>
                )}
                {showUploadField ? (
                  <div className="space-y-2">
                    <Label>Upload Attachment (Required for {uploadConditionDays}+ days)</Label>
                    <div className="flex items-center gap-2">
                      <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} className="flex-1" />
                    </div>
                    {attachmentFile && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Upload className="h-3 w-3" /> {attachmentFile.name}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <Label>Reason</Label>
                    <Textarea
                      value={form.reason}
                      onChange={(e) => setForm({ ...form, reason: e.target.value })}
                      placeholder="Optional reason for leave"
                    />
                  </div>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    createLeave.isPending ||
                    uploading ||
                    hasPendingLeave ||
                    !form.leave_type ||
                    calculatedDays < 1 ||
                    !hasCredits ||
                    !!exceedsLimit ||
                    (showUploadField && !attachmentFile)
                  } className_pending
                >
                  {uploading ? "Uploading..." : "Submit Request"}
                </Button>
              </form>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {hasPendingLeave && (
        <Alert variant="destructive" className="border-warning/50 bg-warning/10 text-warning [&>svg]:text-warning">
          <Clock className="h-4 w-4" />
          <AlertDescription>
            You have a pending leave request awaiting HR processing. You cannot submit a new leave request until your pending request has been approved, rejected, or cancelled.
          </AlertDescription>
        </Alert>
      )}

      {/* Leave Credits Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">My Leave Credits</CardTitle>
        </CardHeader>
        <CardContent>
          {credits && credits.length > 0 ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {activeLeaveTypes.map((leaveType) => {
                const credit = findCreditForLeaveType(leaveType.name, credits);
                // Source of truth: Credits per Application from leave type config
                const total = Number(leaveType.credits_per_application) || 0;
                // Cap displayed used credits at total to avoid showing more used than the configured limit
                const rawUsed = credit?.used_credits || 0;
                const used = Math.min(rawUsed, total);
                const available = Math.max(total - rawUsed, 0);
                const visuals = getLeaveTypeVisuals(leaveType.name);
                const Icon = visuals.icon;
                const isLow = total > 0 && available <= 0;
                return (
                  <div
                    key={leaveType.name}
                    className={cn(
                      "relative p-4 rounded-xl border-l-4 bg-card shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-default group",
                      isLow ? "border-l-destructive bg-destructive/5" : "border-l-primary",
                    )}
                  >
                    <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors truncate">
                      {leaveType.name}
                    </p>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span
                        className={cn(
                          "text-2xl font-bold tracking-tight",
                          isLow ? "text-destructive" : "text-foreground",
                        )}
                      >
                        {available}
                      </span>
                      <span className="text-sm text-muted-foreground">/ {total}</span>
                    </div>
                    {used > 0 && <p className="text-xs text-muted-foreground mt-0.5">{used} used</p>}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No leave credits assigned yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle>My Leave Requests</CardTitle>
              <CardDescription>View the status of your leave applications</CardDescription>
            </div>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {monthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : isMobile ? (
            <MobileLeaveList
              leaves={filteredLeaves}
              getStatusBadge={getStatusBadge}
              onViewComment={setHrComment}
              onViewLetter={openLetter}
              onCancel={(id) => cancelLeave.mutate(id)}
              cancelling={cancelLeave.isPending}
              canOpenLetter={!!myEmployee}
            />
          ) : (
            <DataTable
              columns={columns}
              data={filteredLeaves}
              searchPlaceholder="Search my leaves..."
              emptyMessage="No leave requests found"
            />
          )}
        </CardContent>
      </Card>

      <LeaveApprovalLetterDialog
        open={!!letterParams}
        onOpenChange={(open) => !open && setLetterParams(null)}
        params={letterParams}
      />

      <Dialog open={!!hrComment} onOpenChange={(open) => !open && setHrComment(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>HR Comment</DialogTitle>
          </DialogHeader>
          <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{hrComment}</p>
        </DialogContent>
      </Dialog>

    </div>
  );
}
