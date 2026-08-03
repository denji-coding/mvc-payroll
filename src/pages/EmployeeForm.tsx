import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
import { RefreshCw } from "lucide-react";
import { SalaryAdjustmentsCard } from "@/components/employees/SalaryAdjustmentsCard";
import { EmployeeAvatarUpload } from "@/components/employees/EmployeeAvatarUpload";
import { DateInput } from "@/components/ui/date-picker";
import { PasswordInput } from "@/components/ui/password-input";
import { usePositions } from "@/hooks/usePositions";
import { useBranches } from "@/hooks/useBranches";

const RequiredLabel = ({ children }: { children: React.ReactNode }) => (
  <Label>
    {children} <span className="text-destructive">*</span>
  </Label>
);

export default function EmployeeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { data: branches = [] } = useBranches();
  const { data: positions } = usePositions();
  const [employeeLoaded, setEmployeeLoaded] = useState(false);
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [form, setForm] = useState({
    employee_id: "",
    first_name: "",
    last_name: "",
    middle_name: "",
    suffix_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    gender: "",
    civil_status: "",
    address: "",
    position: "",
    
    date_hired: "",
    basic_salary: "",
    branch_id: "",
    sss_number: "",
    philhealth_number: "",
    pagibig_number: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    rfid_card_number: "",
    role: "employee" as "employee" | "branch_manager" | "hr_admin",
    password: "",
    employment_status: "active" as "active" | "inactive" | "terminated",
    avatar_url: null as string | null,
  });

  // Fetch employee raw data once
  useEffect(() => {
    if (!id) return;
    const fetchEmployee = async () => {
      const { data } = await supabase.from("employees").select("*").eq("id", id).single();
      if (data) setEmployeeData(data);
    };
    fetchEmployee();
  }, [id]);

  // Populate form only after both employee data AND dropdown data (branches) are ready
  useEffect(() => {
    if (!employeeData || !branches.length || employeeLoaded) return;
    setForm((prev) => ({
      ...prev,
      employee_id: employeeData.employee_id || "",
      first_name: employeeData.first_name || "",
      last_name: employeeData.last_name || "",
      middle_name: employeeData.middle_name || "",
      suffix_name: employeeData.suffix_name || "",
      email: employeeData.email || "",
      phone: employeeData.phone || "",
      date_of_birth: employeeData.date_of_birth || "",
      gender: employeeData.gender || "",
      civil_status: employeeData.civil_status || "",
      address: employeeData.address || "",
      position: employeeData.position || "",
      
      date_hired: employeeData.date_hired || "",
      basic_salary: employeeData.basic_salary?.toString() || "",
      branch_id: employeeData.branch_id || "",
      sss_number: employeeData.sss_number || "",
      philhealth_number: employeeData.philhealth_number || "",
      pagibig_number: employeeData.pagibig_number || "",
      emergency_contact_name: employeeData.emergency_contact_name || "",
      emergency_contact_phone: employeeData.emergency_contact_phone || "",
      rfid_card_number: employeeData.rfid_card_number || "",
      employment_status: (employeeData.employment_status as "active" | "inactive" | "terminated") || "active",
      avatar_url: employeeData.avatar_url || null,
    }));
    setEmployeeLoaded(true);
  }, [employeeData, branches, employeeLoaded]);

  const checkDuplicatesOnEdit = async (
    payload: Record<string, unknown>,
    employeeId: string,
  ): Promise<string | null> => {
    const checks: {
      field: keyof typeof payload;
      value: unknown;
      label: string;
      column: "email" | "phone" | "rfid_card_number" | "sss_number" | "philhealth_number" | "pagibig_number";
    }[] = [
      { field: "email", value: payload.email, label: "email", column: "email" },
      { field: "phone", value: payload.phone, label: "phone number", column: "phone" },
      {
        field: "rfid_card_number",
        value: payload.rfid_card_number,
        label: "RFID card number",
        column: "rfid_card_number",
      },
      { field: "sss_number", value: payload.sss_number, label: "SSS number", column: "sss_number" },
      {
        field: "philhealth_number",
        value: payload.philhealth_number,
        label: "PhilHealth number",
        column: "philhealth_number",
      },
      { field: "pagibig_number", value: payload.pagibig_number, label: "Pag-IBIG number", column: "pagibig_number" },
    ];

    for (const check of checks) {
      if (!check.value || (typeof check.value === "string" && check.value.trim() === "")) continue;
      const { data: existing } = await supabase
        .from("employees")
        .select("id")
        .eq(check.column, check.value as string)
        .neq("id", employeeId)
        .limit(1);
      if (existing && existing.length > 0) {
        return `An employee with this ${check.label} already exists`;
      }
    }
    return null;
  };

  const validatePhoneNumber = (phone: string, label: string): string | null => {
    if (!phone || phone.trim() === "") return null; // handled by required check
    const digitsOnly = phone.replace(/\D/g, "");
    if (!digitsOnly.startsWith("09")) return `${label} must start with 09`;
    if (digitsOnly.length !== 11) return `${label} must be exactly 11 digits`;
    return null;
  };

  const validateGovernmentIds = (): string[] => {
    const errors: string[] = [];
    const sss = form.sss_number.replace(/[-\s]/g, "");
    if (!sss || sss.length === 0) {
      errors.push("SSS Number is required");
    } else if (sss.length !== 10) {
      errors.push("SSS Number must be exactly 10 digits (XX-XXXXXXX-X)");
    }
    const phil = form.philhealth_number.replace(/[-\s]/g, "");
    if (!phil || phil.length === 0) {
      errors.push("PhilHealth Number is required");
    } else if (phil.length !== 12) {
      errors.push("PhilHealth Number must be exactly 12 digits (XX-XXXXXXXXX-X)");
    }
    const pagibig = form.pagibig_number.replace(/[-\s]/g, "");
    if (!pagibig || pagibig.length === 0) {
      errors.push("Pag-IBIG Number is required");
    } else if (pagibig.length !== 12) {
      errors.push("Pag-IBIG Number must be exactly 12 digits (XXXX-XXXX-XXXX)");
    }
    return errors;
  };

  const validateRequiredFields = (): boolean => {
    const requiredFields: { field: string; label: string }[] = [
      { field: "employee_id", label: "Employee ID" },
      { field: "first_name", label: "First Name" },
      { field: "last_name", label: "Last Name" },
      
      { field: "email", label: "Email" },
      { field: "phone", label: "Phone" },
      { field: "date_of_birth", label: "Date of Birth" },
      { field: "gender", label: "Gender" },
      { field: "civil_status", label: "Civil Status" },
      { field: "address", label: "Address" },
      { field: "position", label: "Position" },
      { field: "branch_id", label: "Branch" },
      { field: "date_hired", label: "Date Hired" },
      { field: "basic_salary", label: "Basic Salary" },
      { field: "emergency_contact_name", label: "Emergency Contact Name" },
      { field: "emergency_contact_phone", label: "Emergency Contact Phone" },
      { field: "rfid_card_number", label: "RFID Card Number" },
    ];

    if (!id) {
      requiredFields.push({ field: "password", label: "Password" });
    }

    const missingFields = requiredFields.filter(
      ({ field }) => !form[field as keyof typeof form] || (form[field as keyof typeof form] as string).trim() === ""
    );

    if (missingFields.length > 0) {
      const fieldNames = missingFields.map(f => f.label).join(", ");
      toast.error(`Please fill in the following required fields: ${fieldNames}`);
      return false;
    }

    // Validate phone numbers start with 09 and are 11 digits
    const phoneError = validatePhoneNumber(form.phone, "Phone");
    if (phoneError) { toast.error(phoneError); return false; }

    const emergencyPhoneError = validatePhoneNumber(form.emergency_contact_phone, "Emergency Contact Phone");
    if (emergencyPhoneError) { toast.error(emergencyPhoneError); return false; }

    // Validate government IDs if provided
    const govIdErrors = validateGovernmentIds();
    if (govIdErrors.length > 0) {
      govIdErrors.forEach((err) => toast.error(err));
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateRequiredFields()) return;

    setLoading(true);

    if (id) {
      const { password, role, ...payload } = form;
      const cleanPayload: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(payload)) {
        if (value === "") {
          cleanPayload[key] = null;
        } else if (key === "basic_salary") {
          cleanPayload[key] = parseFloat(value as string) || 0;
        } else {
          cleanPayload[key] = value;
        }
      }

      // Check for duplicates
      const duplicateError = await checkDuplicatesOnEdit(cleanPayload, id);
      if (duplicateError) {
        toast.error(duplicateError);
        setLoading(false);
        return;
      }

      const { error } = await supabase.from("employees").update(cleanPayload).eq("id", id);
      if (error) {
        setLoading(false);
        toast.error(error.message);
        return;
      }

      // Sync updated info to the linked profile so the Employee Portal reflects changes
      const { data: emp } = await supabase
        .from("employees")
        .select("user_id")
        .eq("id", id)
        .maybeSingle();
      if (emp?.user_id) {
        await supabase
          .from("profiles")
          .update({
            first_name: (cleanPayload.first_name as string) ?? "",
            last_name: (cleanPayload.last_name as string) ?? "",
            email: (cleanPayload.email as string) ?? "",
            phone: (cleanPayload.phone as string) ?? null,
          })
          .eq("id", emp.user_id);
      }

      setLoading(false);
      toast.success("Employee updated successfully");
      navigate("/employees");
    } else {
      // Create new employee with user account via edge function
      if (!form.password || form.password.length < 6) {
        toast.error("Password must be at least 6 characters");
        setLoading(false);
        return;
      }

      const payload = {
        ...form,
        basic_salary: parseFloat(form.basic_salary) || 0,
      };

      const { data, error } = await supabase.functions.invoke("create-employee", {
        body: payload,
      });

      setLoading(false);
      if (error) {
        // Edge function returns error details in the response body
        let errorMessage = "Failed to create employee";
        try {
          if (error.context?.body) {
            const reader = error.context.body.getReader();
            const { value } = await reader.read();
            const text = new TextDecoder().decode(value);
            const parsed = JSON.parse(text);
            errorMessage = parsed.error || errorMessage;
          } else {
            errorMessage = error.message || errorMessage;
          }
        } catch {
          errorMessage = error.message || errorMessage;
        }
        toast.error(errorMessage);
        return;
      }
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      toast.success("Employee created successfully");
      navigate("/employees");
    }
  };

  const isHrAdminPosition = form.position.toLowerCase() === 'hr admin';

  const updateField = (field: string, value: string) => {
    if (field === 'position') {
      const isHrAdmin = value.toLowerCase() === 'hr admin';
      setForm((prev) => ({
        ...prev,
        position: value,
        role: isHrAdmin ? 'hr_admin' : prev.role === 'hr_admin' ? 'employee' : prev.role,
      }));
      return;
    }
    setForm({ ...form, [field]: value });
  };

  const [passwordManuallyEdited, setPasswordManuallyEdited] = useState(false);

  const generateEmployeeId = () => {
    const randomId = Math.floor(100000 + Math.random() * 900000);
    const newEmployeeId = `EMP-${randomId}`;
    setForm((prev) => ({
      ...prev,
      employee_id: newEmployeeId,
      password: newEmployeeId,
    }));
  };

  return (
    <div className="page-container max-w-full">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/employees")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="page-title">{id ? "Edit Employee" : "Add New Employee"}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-6">
              {/* Avatar Upload Section */}
              <div className="flex-shrink-0">
                <EmployeeAvatarUpload
                  avatarUrl={form.avatar_url}
                  gender={form.gender}
                  employeeId={id || form.employee_id}
                  firstName={form.first_name}
                  lastName={form.last_name}
                  onAvatarChange={(url) => setForm({ ...form, avatar_url: url })}
                />
              </div>

              {/* Personal Info Fields */}
              <div className="flex-1 grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                <div>
                  <RequiredLabel>Employee ID</RequiredLabel>
                  <div className="flex gap-2">
                    <Input
                      value={form.employee_id}
                      onChange={(e) => updateField("employee_id", e.target.value)}
                      placeholder="Generate employee ID"
                      className="flex-1"
                      readOnly
                    />
                    {!id && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={generateEmployeeId}
                        title="Generate ID"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <RequiredLabel>First Name</RequiredLabel>
                  <Input
                    value={form.first_name}
                    onChange={(e) => updateField("first_name", e.target.value)}
                    placeholder="e.g. Juan"
                  />
                </div>
                <div>
                  <RequiredLabel>Last Name</RequiredLabel>
                  <Input
                    value={form.last_name}
                    onChange={(e) => updateField("last_name", e.target.value)}
                    placeholder="e.g. Dela Cruz"
                  />
                </div>
                <div>
                  <Label>Middle Name <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                  <Input
                    value={form.middle_name}
                    onChange={(e) => updateField("middle_name", e.target.value)}
                    placeholder="e.g. Santos"
                  />
                </div>
                <div>
                  <Label>Suffix Name <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                  <Input
                    value={form.suffix_name}
                    onChange={(e) => updateField("suffix_name", e.target.value)}
                    placeholder="e.g. Jr., Sr., III"
                  />
                </div>
                <div>
                  <RequiredLabel>Email</RequiredLabel>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="e.g. juan@company.com"
                  />
                </div>
                <div>
                  <RequiredLabel>Phone</RequiredLabel>
                  <Input
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value.replace(/\D/g, "").slice(0, 11))}
                    placeholder="09XXXXXXXXX"
                    maxLength={11}
                  />
                </div>
                <div>
                  <RequiredLabel>Date of Birth</RequiredLabel>
                  <DateInput value={form.date_of_birth} onChange={(v) => updateField("date_of_birth", v)} />
                </div>
                <div>
                  <RequiredLabel>Gender</RequiredLabel>
                  <Select value={form.gender} onValueChange={(v) => updateField("gender", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <RequiredLabel>Civil Status</RequiredLabel>
                  <Select value={form.civil_status} onValueChange={(v) => updateField("civil_status", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="married">Married</SelectItem>
                      <SelectItem value="widowed">Widowed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-3 lg:col-span-4">
                  <RequiredLabel>Address</RequiredLabel>
                  <Input
                    value={form.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    placeholder="e.g. 123 Main St, Makati City"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Employment Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            <div>
              <RequiredLabel>Position</RequiredLabel>
              <Select value={form.position} onValueChange={(v) => updateField("position", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  {positions?.map((p) => (
                    <SelectItem key={p.id} value={p.name}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <RequiredLabel>Branch</RequiredLabel>
              <Select value={form.branch_id} onValueChange={(v) => updateField("branch_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <RequiredLabel>Date Hired</RequiredLabel>
              <DateInput value={form.date_hired} onChange={(v) => updateField("date_hired", v)} />
            </div>
            <div>
              <RequiredLabel>Basic Salary (₱)</RequiredLabel>
              <Input
                type="number"
                value={form.basic_salary}
                onChange={(e) => updateField("basic_salary", e.target.value)}
                placeholder="e.g. 25000"
              />
            </div>
            <div>
              <RequiredLabel>RFID Card Number</RequiredLabel>
              <Input
                value={form.rfid_card_number}
                onChange={(e) => updateField("rfid_card_number", e.target.value)}
                placeholder="Scan or enter RFID number"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.employment_status === "active"}
                onCheckedChange={(checked) => updateField("employment_status", checked ? "active" : "inactive")}
              />
              <Label>{form.employment_status === "active" ? "Active" : "Inactive"}</Label>
            </div>
          </CardContent>
        </Card>

        {!id && (
          <Card>
            <CardHeader>
              <CardTitle>User Account & Role</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              <div>
                <RequiredLabel>Role</RequiredLabel>
                <Select value={form.role} onValueChange={(v) => updateField("role", v)} disabled={isHrAdminPosition}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    {/* Branch Manager temporarily removed */}
                    <SelectItem value="hr_admin" disabled={!isHrAdminPosition}>HR Admin</SelectItem>
                  </SelectContent>
                </Select>
                {isHrAdminPosition && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Role is automatically set to HR Admin based on position.
                  </p>
                )}
              </div>
              <div>
                <RequiredLabel>Password</RequiredLabel>
                <PasswordInput
                  value={form.password}
                  onChange={(e) => { setPasswordManuallyEdited(true); updateField("password", e.target.value); }}
                  placeholder="Min 6 characters"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Default: Employee ID. You can customize it.
                </p>
              </div>
              <div className="flex items-end">
                <p className="text-sm text-muted-foreground">Employee will login using their email and this password</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Government IDs</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            <div>
              <RequiredLabel>SSS Number</RequiredLabel>
              <Input
                value={form.sss_number}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 10);
                  const formatted = digits.length > 2 && digits.length <= 9
                    ? `${digits.slice(0, 2)}-${digits.slice(2)}`
                    : digits.length > 9
                    ? `${digits.slice(0, 2)}-${digits.slice(2, 9)}-${digits.slice(9)}`
                    : digits;
                  updateField("sss_number", formatted);
                }}
                placeholder="XX-XXXXXXX-X"
                maxLength={12}
              />
            </div>
            <div>
              <RequiredLabel>PhilHealth Number</RequiredLabel>
              <Input
                value={form.philhealth_number}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 12);
                  const formatted = digits.length > 2 && digits.length <= 11
                    ? `${digits.slice(0, 2)}-${digits.slice(2)}`
                    : digits.length > 11
                    ? `${digits.slice(0, 2)}-${digits.slice(2, 11)}-${digits.slice(11)}`
                    : digits;
                  updateField("philhealth_number", formatted);
                }}
                placeholder="XX-XXXXXXXXX-X"
                maxLength={14}
              />
            </div>
            <div>
              <RequiredLabel>Pag-IBIG Number</RequiredLabel>
              <Input
                value={form.pagibig_number}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 12);
                  const formatted = digits.length > 4 && digits.length <= 8
                    ? `${digits.slice(0, 4)}-${digits.slice(4)}`
                    : digits.length > 8
                    ? `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`
                    : digits;
                  updateField("pagibig_number", formatted);
                }}
                placeholder="XXXX-XXXX-XXXX"
                maxLength={14}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Emergency Contact</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <RequiredLabel>Emergency Contact Name</RequiredLabel>
              <Input
                value={form.emergency_contact_name}
                onChange={(e) => updateField("emergency_contact_name", e.target.value)}
                placeholder="e.g. Maria Dela Cruz"
              />
            </div>
            <div>
              <RequiredLabel>Emergency Contact Phone</RequiredLabel>
              <Input
                value={form.emergency_contact_phone}
                onChange={(e) => updateField("emergency_contact_phone", e.target.value.replace(/\D/g, "").slice(0, 11))}
                placeholder="09XXXXXXXXX"
                maxLength={11}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate("/employees")}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            <Save className="mr-2 h-4 w-4" />
            {loading ? "Saving..." : "Save Employee"}
          </Button>
        </div>
      </form>

      {id && (
        <div className="mt-6">
          <SalaryAdjustmentsCard employeeId={id} />
        </div>
      )}
    </div>
  );
}
