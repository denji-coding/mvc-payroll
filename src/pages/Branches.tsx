import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Users } from 'lucide-react';
import { useBranches, useCreateBranch, useUpdateBranch, useDeleteBranch } from '@/hooks/useBranches';
import { DataTable, ColumnDef } from '@/components/ui/data-table';
import { formatFullName } from '@/lib/formatName';

interface BranchWithCounts {
  id: string; name: string; code: string; address: string | null;
  contact_number: string | null; is_active: boolean; employee_count: number; manager_name: string | null;
}

export default function Branches() {
  const { data: branches = [], isLoading } = useBranches();
  const createMutation = useCreateBranch();
  const updateMutation = useUpdateBranch();
  const deleteMutation = useDeleteBranch();
  
  const [branchesWithCounts, setBranchesWithCounts] = useState<BranchWithCounts[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', code: '', address: '', contact_number: '', is_active: true });
  const { toast } = useToast();

  useEffect(() => {
    if (branches.length > 0) fetchBranchDetails();
    else setBranchesWithCounts([]);
  }, [branches]);

  const fetchBranchDetails = async () => {
    const enrichedBranches = await Promise.all(
      branches.map(async (branch) => {
        const { count } = await supabase.from('employees').select('*', { count: 'exact', head: true }).eq('branch_id', branch.id).eq('employment_status', 'active');
        const { data: managerData } = await supabase.from('branch_managers').select('user_id').eq('branch_id', branch.id).limit(1).single();
        let managerName = null;
        if (managerData?.user_id) {
          const { data: profile } = await supabase.from('profiles').select('first_name, last_name').eq('id', managerData.user_id).single();
          if (profile) managerName = formatFullName(profile.first_name, profile.last_name);
        }
        return { ...branch, employee_count: count || 0, manager_name: managerName };
      })
    );
    setBranchesWithCounts(enrichedBranches);
  };

  const filteredBranches = useMemo(() => {
    if (statusFilter === 'all') return branchesWithCounts;
    if (statusFilter === 'active') return branchesWithCounts.filter(b => b.is_active !== false);
    return branchesWithCounts.filter(b => b.is_active === false);
  }, [branchesWithCounts, statusFilter]);

  const handleContactNumberChange = (value: string) => {
    const digits = value.replace(/[^0-9]/g, '').slice(0, 11);
    setForm({ ...form, contact_number: digits });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate contact number length
    if (form.contact_number && form.contact_number.length > 0 && form.contact_number.length !== 11) {
      toast({ variant: 'destructive', title: 'Invalid Contact Number', description: 'Contact number must be exactly 11 digits.' });
      return;
    }
    // Check duplicate contact number
    if (form.contact_number && form.contact_number.length === 11) {
      const duplicate = branchesWithCounts.find(
        b => b.contact_number === form.contact_number && (!editing || b.id !== editing.id)
      );
      if (duplicate) {
        toast({ variant: 'destructive', title: 'Duplicate Contact Number', description: `This contact number is already used by branch "${duplicate.name}".` });
        return;
      }
    }
    if (editing) await updateMutation.mutateAsync({ id: editing.id, ...form });
    else await createMutation.mutateAsync(form);
    setOpen(false); setEditing(null); setForm({ name: '', code: '', address: '', contact_number: '', is_active: true });
  };

  const openEdit = (branch: any) => {
    setEditing(branch);
    setForm({ name: branch.name, code: branch.code, address: branch.address || '', contact_number: branch.contact_number || '', is_active: branch.is_active });
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    const branch = branchesWithCounts.find(b => b.id === id);
    if (branch && branch.employee_count > 0) { toast({ variant: 'destructive', title: 'Cannot Delete', description: 'Reassign employees first.' }); return; }
    await deleteMutation.mutateAsync(id);
  };

  const columns: ColumnDef<BranchWithCounts, any>[] = [
    { accessorKey: 'code', header: 'Code' },
    { accessorKey: 'name', header: 'Name' },
    
    { accessorKey: 'employee_count', header: 'Employees', cell: ({ getValue }) => <div className="flex items-center gap-1"><Users className="h-4 w-4 text-muted-foreground" />{getValue() as number}</div> },
    { accessorKey: 'contact_number', header: 'Contact', cell: ({ getValue }) => getValue() || '-' },
    { accessorKey: 'is_active', header: 'Status', cell: ({ getValue }) => <Badge variant={getValue() ? 'default' : 'secondary'}>{getValue() ? 'Active' : 'Inactive'}</Badge> },
    {
      id: 'actions', header: 'Actions', enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row.original)}><Edit className="h-4 w-4 text-primary" /></Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" disabled={deleteMutation.isPending}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Branch</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete the branch "{row.original.name}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleDelete(row.original.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Branches</h1>
        <Dialog open={open} onOpenChange={(o) => { if (createMutation.isPending || updateMutation.isPending) return; setOpen(o); if (!o) { setEditing(null); setForm({ name: '', code: '', address: '', contact_number: '', is_active: true }); } }}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add Branch</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? 'Edit Branch' : 'Add New Branch'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label>Branch Name <span className="text-destructive">*</span></Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Main Branch" required /></div>
              <div><Label>Branch Code <span className="text-destructive">*</span></Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. MB-001" required /></div>
              <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="e.g. 123 Main St, City" /></div>
              <div><Label>Contact Number</Label><Input value={form.contact_number} onChange={(e) => handleContactNumberChange(e.target.value)} placeholder="e.g. 09123456789" maxLength={11} /></div>
              {editing && <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} /><Label>Active</Label></div>}
              <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>{editing ? 'Update' : 'Create'} Branch</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="inactive">Inactive</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="text-center py-8 text-muted-foreground">Loading...</div> : (
            <DataTable columns={columns} data={filteredBranches} searchPlaceholder="Search branches..." emptyMessage="No branches found" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}