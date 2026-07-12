import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLeaveTypes, useCreateLeaveType, useUpdateLeaveType, useDeleteLeaveType, LeaveType } from '@/hooks/useLeaveTypes';

import { useLwpConfig, useUpdateLwpConfig, LwpConfig } from '@/hooks/useSettings';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Eye, EyeOff, Trash2, Edit, Settings, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DataTable, ColumnDef } from '@/components/ui/data-table';
import { LeaveTypeFormFields, LeaveTypeForm, defaultForm } from '@/components/leave-credits/LeaveTypeFormFields';
import { toast } from 'sonner';

export default function LeaveCredits() {
  const { role } = useAuth();
  const { data: leaveTypes, isLoading } = useLeaveTypes();
  
  const createLeaveType = useCreateLeaveType();
  const updateLeaveType = useUpdateLeaveType();
  const deleteLeaveType = useDeleteLeaveType();
  const { data: lwpConfig } = useLwpConfig();
  const updateLwpConfig = useUpdateLwpConfig();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [form, setForm] = useState<LeaveTypeForm>({ ...defaultForm });
  const [editForm, setEditForm] = useState<LeaveTypeForm>({ ...defaultForm });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lwpForm, setLwpForm] = useState<LwpConfig>({ paid_leave_credits: 3, refresh_months: 1 });

  const handleOpenSettings = () => {
    if (lwpConfig) {
      setLwpForm({ ...lwpConfig });
    }
    setSettingsOpen(true);
  };

  const handleSaveLwpConfig = () => {
    if (lwpForm.paid_leave_credits < 1) {
      toast.error('Paid leave credits must be at least 1');
      return;
    }
    if (lwpForm.refresh_months < 1) {
      toast.error('Refresh months must be at least 1');
      return;
    }
    updateLwpConfig.mutate(lwpForm, {
      onSuccess: () => setSettingsOpen(false),
    });
  };

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


  if ((role !== 'hr_admin' && role !== 'super_admin')) {
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
        <div className="flex gap-2 w-full sm:w-auto">
          <Button className="flex-1 sm:flex-initial" onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Leave Type</Button>
          <Button variant="outline" size="icon" className="shrink-0" onClick={handleOpenSettings} title="LWP Settings"><Settings className="h-4 w-4" /></Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? <div className="text-center py-8 text-muted-foreground">Loading...</div> : (
            <DataTable columns={columns} data={leaveTypes || []} searchPlaceholder="Search leave types..." emptyMessage="No leave types found. Click 'Add Leave Type' to create one." />
          )}
        </CardContent>
      </Card>

      {/* LWP Settings Drawer */}
      <Drawer open={settingsOpen} onOpenChange={setSettingsOpen} direction="right">
        <DrawerContent className="fixed inset-y-0 right-0 left-auto w-full sm:w-[400px] h-full rounded-none sm:rounded-l-xl rounded-t-none border-l mt-0">
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <DrawerTitle>Leave With Pay Settings</DrawerTitle>
              <DrawerDescription className="text-sm text-muted-foreground mt-1">Configure LWP credit limits and refresh cycle.</DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8"><X className="h-4 w-4" /></Button>
            </DrawerClose>
          </div>
          <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="lwp-credits">Paid Leave Credits (days)</Label>
              <Input
                id="lwp-credits"
                type="number"
                min="1"
                step="1"
                value={lwpForm.paid_leave_credits}
                onChange={(e) => setLwpForm({ ...lwpForm, paid_leave_credits: parseInt(e.target.value) || 1 })}
              />
              <p className="text-xs text-muted-foreground">Maximum number of "With Pay" leave days an employee can use before the next refresh.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lwp-refresh">Refresh Every</Label>
              <Select value={String(lwpForm.refresh_months)} onValueChange={(v) => setLwpForm({ ...lwpForm, refresh_months: parseInt(v) })}>
                <SelectTrigger id="lwp-refresh"><SelectValue placeholder="Select interval" /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                    <SelectItem key={m} value={String(m)}>{m} {m === 1 ? 'month' : 'months'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Number of months before all leave credits (credits per application) automatically refresh per application cycle.</p>
            </div>
            <div className="rounded-md border border-border p-3 bg-muted/30 space-y-1">
              <p className="text-sm font-medium">How it works</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                <li>Employees can select "With Pay" when applying for leave, up to the configured credit limit above.</li>
                <li>Once all LWP credits are used, employees can only apply for "Without Pay" leave.</li>
                <li>Approved "With Pay" leaves are automatically included in payroll calculation.</li>
                <li>LWP credits reset automatically once per year (every January).</li>
                <li>Other leave credits (credits per application) refresh based on the configured month cycle above.</li>
              </ul>
            </div>
          </div>
          <DrawerFooter className="border-t">
            <Button onClick={handleSaveLwpConfig} disabled={updateLwpConfig.isPending}>
              {updateLwpConfig.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Add Leave Type Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setForm({ ...defaultForm }); }}>
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
      <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) { setEditingType(null); setEditForm({ ...defaultForm }); } }}>
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
