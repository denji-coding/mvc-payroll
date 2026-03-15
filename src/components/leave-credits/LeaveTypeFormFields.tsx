import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface LeaveTypeForm {
  name: string;
  default_credits: string;
  credits_per_application: string;
  description: string;
  applyToAll: boolean;
  calendar_config: 'disable_past' | 'disable_future' | 'no_disable';
  required_fields: string[];
  upload_condition_days: string;
}

export const defaultForm: LeaveTypeForm = {
  name: '', default_credits: '', credits_per_application: '1', description: '',
  applyToAll: true, calendar_config: 'disable_past', required_fields: ['reason'],
  upload_condition_days: '',
};

export function LeaveTypeFormFields({ form, setForm, isEdit = false }: {
  form: LeaveTypeForm;
  setForm: (f: LeaveTypeForm) => void;
  isEdit?: boolean;
}) {
  const hasUploadField = form.required_fields.includes('upload');

  const handleRequiredFieldChange = (value: string) => {
    let newFields: string[];
    if (value === 'reason') newFields = ['reason'];
    else if (value === 'upload') newFields = ['upload'];
    else if (value === 'both') newFields = ['reason', 'upload'];
    else newFields = ['reason'];
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
      {(hasUploadField || form.required_fields.includes('both')) && (
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
