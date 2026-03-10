import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLeaveTypes, useCreateLeaveType, useUpdateLeaveType, useDeleteLeaveType, LeaveType } from '@/hooks/useLeaveTypes';
import { useAllLeaveCredits } from '@/hooks/useLeaves';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Eye, EyeOff, Trash2, RefreshCw, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DataTable, ColumnDef } from '@/components/ui/data-table';

interface LeaveTypeForm {
  name: string;
  default_credits: string;
  credits_per_application: string;
  description: string;
  applyToAll: boolean;
  calendar_config: 'disable_past' | 'disable_future' | 'no_disable';
  required_fields: string[];
  upload_condition_days: string;
}

const defaultForm: LeaveTypeForm = {
  name: '', default_credits: '', credits_per_application: '1', description: '',
  applyToAll: true, calendar_config: 'disable_past', required_fields: ['reason'],
  upload_condition_days: '',
};

function LeaveTypeFormFields({ form, setForm, isEdit = false }: {
  form: LeaveTypeForm;
  setForm: (f: LeaveTypeForm) => void;
  isEdit?: boolean;
}) {
  const hasUploadField = form.required_fields.includes('upload');

  const handleRequiredFieldChange = (value: string) => {
    let newFields: string[];
    if (value === 'reason') {
      newFields = ['reason'];
    } else if (value === 'upload') {
      newFields = ['upload'];
    } else if (value === 'both') {
      newFields = ['reason', 'upload'];
    } else {
      newFields = ['reason'];
    }
    setForm({ ...form, required_fields: newFields, upload_condition_days: (value === 'upload' || value === 'both') ? form.upload_condition_days : '' });
  };

  const currentFieldValue = form.required_fields.includes('reason') && form.required_fields.includes('upload') ? 'both' : form.required_fields.includes('upload') ? 'upload' : 'reason';

  return (
    <>
      <div className="space-y-2">
        <Label>Leave Type Name</Label>
        <Input placeholder="e.g. Sick Leave, Annual Leave" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Default Allowed Days / Limit</Label>
        <Input type="number" min="1" step="1" placeholder="e.g. 15" value={form.default_credits} onChange={(e) => setForm({ ...form, default_credits: e.target.value })} />
        <p className="text-xs text-muted-foreground">Maximum number of days an employee can apply per request</p>
      </div>
      <div className="space-y-2">
        <Label>Credits Per Application</Label>
        <Input type="number" min="1" step="1" placeholder="e.g. 1" value={form.credits_per_application} onChange={(e) => setForm({ ...form, credits_per_application: e.target.value })} />
        <p className="text-xs text-muted-foreground">Number of credits consumed per approved leave application</p>
      </div>
      <div className="space-y-2">
        <Label>Configuration Calendar</Label>
        <RadioGroup value={form.calendar_config} onValueChange={(v) => setForm({ ...form, calendar_config: v as any })} className="space-y-1">
          <div className="flex items-center space-x-2"><RadioGroupItem value="disable_past" id={`${isEdit ? 'edit-' : ''}cal-past`} /><Label htmlFor={`${isEdit ? 'edit-' : ''}cal-past`} className="cursor-pointer font-normal">Disable Past Date</Label></div>
          <div className="flex items-center space-x-2"><RadioGroupItem value="disable_future" id={`${isEdit ? 'edit-' : ''}cal-future`} /><Label htmlFor={`${isEdit ? 'edit-' : ''}cal-future`} className="cursor-pointer font-normal">Disable Future Date</Label></div>
          <div className="flex items-center space-x-2"><RadioGroupItem value="no_disable" id={`${isEdit ? 'edit-' : ''}cal-none`} /><Label htmlFor={`${isEdit ? 'edit-' : ''}cal-none`} className="cursor-pointer font-normal">Make Both Not Disable</Label></div>
        </RadioGroup>
      </div>
      <div className="space-y-2">
        <Label>Select Required Fields</Label>
        <Select value={currentFieldValue} onValueChange={handleRequiredFieldChange}>
          <SelectTrigger><SelectValue placeholder="Select fields..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="reason">Reason Field</SelectItem>
            <SelectItem value="upload">Upload Field</SelectItem>
            <SelectItem value="both">Both (Reason & Upload)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {hasUploadField && (
        <div className="space-y-2 rounded-md border border-border p-3 bg-muted/30">
          <Label className="text-sm font-semibold text-warning">Upload Condition: Minimum days to require upload</Label>
          <p className="text-xs text-muted-foreground">If the applied leave date range is equal to or exceeds this number of days, the upload field will replace the reason field.</p>
          <Input type="number" min="1" step="1" placeholder="e.g. 3" value={form.upload_condition_days} onChange={(e) => setForm({ ...form, upload_condition_days: e.target.value })} />
        </div>
      )}
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea placeholder="Enter description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
      </div>
    </>
  );
}

export default function LeaveCredits() {
  const { role } = useAuth();
  const { data: leaveTypes, isLoading, refetch } = useLeaveTypes();
  const { data: allCredits } = useAllLeaveCredits();
  const createLeaveType = useCreateLeaveType();
  const updateLeaveType = useUpdateLeaveType();
  const deleteLeaveType = useDeleteLeaveType();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [form, setForm] = useState<LeaveTypeForm>({ ...defaultForm });
  const [editForm, setEditForm] = useState<LeaveTypeForm>({ ...defaultForm });

  const handleAddLeaveType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.default_credits) return;
    createLeaveType.mutate({
      name: form.name,
      default_credits: parseFloat(form.default_credits),
      credits_per_application: parseFloat(form.credits_per_application) || 1,
      max_days_per_application: form.default_credits ? parseFloat(form.default_credits) : null,
      calendar_config: form.calendar_config,
      required_fields: form.required_fields,
      upload_condition_days: form.upload_condition_days ? parseFloat(form.upload_condition_days) : null,
      description: form.description || undefined,
      applyToAll: form.applyToAll,
    }, {
      onSuccess: () => { setForm({ ...defaultForm }); setDialogOpen(false); },
    });
  };

  const handleEditLeaveType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingType || !editForm.name || !editForm.default_credits) return;
    updateLeaveType.mutate({
      id: editingType.id,
      name: editForm.name,
      default_credits: parseFloat(editForm.default_credits),
      credits_per_application: parseFloat(editForm.credits_per_application) || 1,
      max_days_per_application: editForm.default_credits ? parseFloat(editForm.default_credits) : null,
      calendar_config: editForm.calendar_config,
      required_fields: editForm.required_fields,
      upload_condition_days: editForm.upload_condition_days ? parseFloat(editForm.upload_condition_days) : null,
      description: editForm.description || null,
    }, {
      onSuccess: () => { setEditingType(null); setEditDialogOpen(false); },
    });
  };

  const openEditDialog = (lt: LeaveType) => {
    setEditingType(lt);
    setEditForm({
      name: lt.name,
      default_credits: lt.default_credits.toString(),
      credits_per_application: (lt.credits_per_application || 1).toString(),
      description: lt.description || '',
      applyToAll: false,
      calendar_config: (lt.calendar_config as any) || 'disable_past',
      required_fields: lt.required_fields || ['reason'],
      upload_condition_days: lt.upload_condition_days ? lt.upload_condition_days.toString() : '',
    });
    setEditDialogOpen(true);
  };

  const handleToggleActive = (id: string, currentActive: boolean) => updateLeaveType.mutate({ id, is_active: !currentActive });

  const getTotalTaken = (leaveTypeName: string) => {
    if (!allCredits) return 0;
    return allCredits.filter((c: any) => c.leave_type === leaveTypeName).reduce((sum: number, c: any) => sum + (c.used_credits || 0), 0);
  };

  if (role !== 'hr_admin') {
    return <div className="page-container"><Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">You don't have permission to access this page.</p></CardContent></Card></div>;
  }

  const columns: ColumnDef<any, any>[] = [
    {
      accessorKey: 'name', header: 'Leave Type',
      cell: ({ row }) => {
        const lt = row.original;
        return (
          <div>
            <p className="font-medium">{lt.name}</p>
            {lt.description && <p className="text-xs text-muted-foreground">{lt.description}</p>}
          </div>
        );
      },
    },
    { accessorKey: 'is_active', header: 'Status', cell: ({ getValue }) => <Badge variant={getValue() ? 'default' : 'secondary'}>{getValue() ? 'Active' : 'Inactive'}</Badge> },
    { accessorKey: 'default_credits', header: 'Day Limit', cell: ({ getValue }) => `${getValue()} days` },
    { accessorKey: 'credits_per_application', header: 'Credits/App', cell: ({ getValue }) => getValue() || 1 },
    {
      id: 'total_taken', header: 'Total Taken',
      cell: ({ row }) => <Badge variant="destructive" className="min-w-[60px]">{getTotalTaken(row.original.name)} used</Badge>,
    },
    {
      id: 'actions', header: 'Actions', enableSorting: false,
      cell: ({ row }) => {
        const lt = row.original;
        return (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:text-primary" onClick={() => openEditDialog(lt)} title="Edit"><Edit className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:text-primary" onClick={() => handleToggleActive(lt.id, lt.is_active)} title={lt.is_active ? 'Deactivate' : 'Activate'}>
              {lt.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" title="Delete"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Delete Leave Type?</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete "{lt.name}"? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteLeaveType.mutate(lt.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        );
      },
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Leave Credits Management</h1><p className="text-muted-foreground">Manage employee leave credits and allocations.</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
          <Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Leave Type</Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? <div className="text-center py-8 text-muted-foreground">Loading...</div> : (
            <DataTable columns={columns} data={leaveTypes || []} searchPlaceholder="Search leave types..." emptyMessage="No leave types found. Click 'Add Leave Type' to create one." />
          )}
        </CardContent>
      </Card>

      {/* Add Leave Type Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Leave Type</DialogTitle>
            <DialogDescription>Configure a new leave type with its rules and settings.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddLeaveType} className="space-y-4">
            <LeaveTypeFormFields form={form} setForm={setForm} />
            <div className="flex items-start gap-3 pt-2">
              <Checkbox id="applyToAll" checked={form.applyToAll} onCheckedChange={(checked) => setForm({ ...form, applyToAll: !!checked })} />
              <div><Label htmlFor="applyToAll" className="font-semibold cursor-pointer">Apply to all existing employees</Label><p className="text-xs text-muted-foreground">If checked, all employees will get leave credits for this type.</p></div>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={createLeaveType.isPending}><Plus className="mr-2 h-4 w-4" /> Add Leave Type</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Leave Type Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) setEditingType(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Leave Type</DialogTitle>
            <DialogDescription>Update leave type configuration.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditLeaveType} className="space-y-4">
            <LeaveTypeFormFields form={editForm} setForm={setEditForm} isEdit />
            <DialogFooter><Button type="button" variant="outline" onClick={() => { setEditDialogOpen(false); setEditingType(null); }}>Cancel</Button><Button type="submit" disabled={updateLeaveType.isPending}>{updateLeaveType.isPending ? 'Saving...' : 'Save Changes'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
