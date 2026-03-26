import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useAllPositions, useCreatePosition, useUpdatePosition, useDeletePosition } from '@/hooks/usePositions';
import { Badge } from '@/components/ui/badge';
import { DataTable, ColumnDef } from '@/components/ui/data-table';

export default function Positions() {
  const { data: positions, isLoading } = useAllPositions();
  const createPosition = useCreatePosition();
  const updatePosition = useUpdatePosition();
  const deletePosition = useDeletePosition();

  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [createOpen, setCreateOpen] = useState(false);
  const [editPosition, setEditPosition] = useState<any>(null);
  const [form, setForm] = useState({ name: '', description: '', is_active: true });

  const filteredPositions = useMemo(() => {
    if (!positions) return [];
    if (statusFilter === 'all') return positions;
    if (statusFilter === 'active') return positions.filter((p: any) => p.is_active !== false);
    return positions.filter((p: any) => p.is_active === false);
  }, [positions, statusFilter]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createPosition.mutate(
      { name: form.name, description: form.description, is_active: form.is_active },
      { onSuccess: () => { setForm({ name: '', description: '', is_active: true }); setCreateOpen(false); } }
    );
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPosition) return;
    updatePosition.mutate(
      { id: editPosition.id, name: form.name, description: form.description, is_active: form.is_active },
      { onSuccess: () => { setEditPosition(null); setForm({ name: '', description: '', is_active: true }); } }
    );
  };

  const openEditDialog = (position: any) => {
    setEditPosition(position);
    setForm({ name: position.name, description: position.description || '', is_active: position.is_active ?? true });
  };

  const columns: ColumnDef<any, any>[] = [
    { accessorKey: 'name', header: 'Position Name' },
    { accessorKey: 'description', header: 'Description', cell: ({ getValue }) => getValue() || '-' },
    {
      accessorKey: 'is_active', header: 'Status',
      cell: ({ getValue }) => <Badge variant={getValue() ? 'default' : 'secondary'}>{getValue() ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      id: 'actions', header: 'Actions', enableSorting: false,
      cell: ({ row }) => {
        const position = row.original;
        return (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => openEditDialog(position)}><Edit className="h-4 w-4" /></Button>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Delete Position?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the position "{position.name}".</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deletePosition.mutate(position.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
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
        <h1 className="page-title">Positions</h1>
        <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setForm({ name: '', description: '', is_active: true }); }}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add Position</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Position</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div><Label>Position Name <span className="text-destructive">*</span></Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Software Engineer" required /></div>
              <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description" /></div>
              <div className="flex items-center justify-between">
                <Label htmlFor="create-status">Active</Label>
                <Switch id="create-status" checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} />
              </div>
              <DialogFooter><Button type="submit" disabled={createPosition.isPending}>{createPosition.isPending ? 'Creating...' : 'Create Position'}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Positions</CardTitle>
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="inactive">Inactive</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <DataTable columns={columns} data={filteredPositions} searchPlaceholder="Search positions..." emptyMessage="No positions found. Create your first position." />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editPosition} onOpenChange={(open) => { if (!open) { setEditPosition(null); setForm({ name: '', description: '', is_active: true }); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Position</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div><Label>Position Name <span className="text-destructive">*</span></Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-status">Active</Label>
              <Switch id="edit-status" checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} />
            </div>
            <DialogFooter><Button type="submit" disabled={updatePosition.isPending}>{updatePosition.isPending ? 'Saving...' : 'Save Changes'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
