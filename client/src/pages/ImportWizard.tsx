import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Upload, Loader2, ArrowRight, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import { APP_TITLE, getLoginUrl } from "@/const";

const TARGET_FIELDS = [
  "Customer Name",
  "Display Name",
  "First Name",
  "Last Name",
  "Company Name",
  "Job Title",
  "Employee ID",
  "Employee Type",
  "Employee Hire Date",
  "Work Email",
  "Department",
  "Office Location",
  "Street Address",
  "City",
  "State",
  "Postal Code",
  "Business Phone",
  "Business Mobile Phone",
  "Fax Number",
  "Personal Mobile Phone",
  "Manager Email",
];

type MappingPart = {
  type: "csv" | "text";
  csvField?: string;
  text?: string;
};

type FieldMapping = {
  type: "csv" | "text" | "concat";
  csvField?: string;
  text?: string;
  parts?: MappingPart[];
};

export default function ImportWizard() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [selectedConnection, setSelectedConnection] = useState<number | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [fieldMappings, setFieldMappings] = useState<Record<string, FieldMapping>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: connections, isLoading: connectionsLoading } = trpc.azureConnection.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const parseMutation = trpc.csv.parse.useMutation({
    onSuccess: (data: any) => {
      setCsvHeaders(data.headers);
      setCsvPreview(data.preview);
      toast.success("CSV file parsed successfully");
      setStep(3);
    },
    onError: (error) => {
      toast.error(`Failed to parse CSV: ${error.message}`);
    },
  });

  const uploadMutation = trpc.csv.upload.useMutation();
  const createJobMutation = trpc.importJob.create.useMutation();
  const executeJobMutation = trpc.importJob.execute.useMutation({
    onSuccess: (result) => {
      toast.success(`Import completed: ${result.success} rows imported, ${result.failed} failed`);
      navigate("/history");
    },
    onError: (error) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setCsvContent(content);
      };
      reader.readAsText(file);
    }
  };

  const handleParseCSV = () => {
    if (!csvContent) {
      toast.error("Please upload a CSV file first");
      return;
    }
    parseMutation.mutate({ fileContent: csvContent });
  };

  const handleAddMapping = (targetField: string, type: "csv" | "text" | "concat") => {
    if (type === "concat") {
      setFieldMappings({
        ...fieldMappings,
        [targetField]: { type: "concat", parts: [{ type: "csv", csvField: csvHeaders[0] || "" }] },
      });
    } else {
      setFieldMappings({
        ...fieldMappings,
        [targetField]: { type, csvField: csvHeaders[0] || "", text: "" },
      });
    }
  };

  const handleUpdateMapping = (targetField: string, updates: Partial<FieldMapping>) => {
    setFieldMappings({
      ...fieldMappings,
      [targetField]: { ...fieldMappings[targetField], ...updates },
    });
  };

  const handleAddConcatPart = (targetField: string) => {
    const mapping = fieldMappings[targetField];
    if (mapping && mapping.type === "concat") {
      const newParts = [...(mapping.parts || []), { type: "csv" as const, csvField: csvHeaders[0] || "" }];
      handleUpdateMapping(targetField, { parts: newParts });
    }
  };

  const handleRemoveConcatPart = (targetField: string, index: number) => {
    const mapping = fieldMappings[targetField];
    if (mapping && mapping.type === "concat" && mapping.parts) {
      const newParts = mapping.parts.filter((_, i) => i !== index);
      handleUpdateMapping(targetField, { parts: newParts });
    }
  };

  const handleUpdateConcatPart = (targetField: string, index: number, updates: Partial<MappingPart>) => {
    const mapping = fieldMappings[targetField];
    if (mapping && mapping.type === "concat" && mapping.parts) {
      const newParts = [...mapping.parts];
      newParts[index] = { ...newParts[index], ...updates };
      handleUpdateMapping(targetField, { parts: newParts });
    }
  };

  const handleRemoveMapping = (targetField: string) => {
    const newMappings = { ...fieldMappings };
    delete newMappings[targetField];
    setFieldMappings(newMappings);
  };

  const handleImport = async () => {
    if (!selectedConnection || !csvFile || !csvContent) {
      toast.error("Missing required information");
      return;
    }

    try {
      const uploadResult = await uploadMutation.mutateAsync({
        fileName: csvFile.name,
        fileContent: csvContent,
      });

      const jobResult = await createJobMutation.mutateAsync({
        connectionId: selectedConnection,
        fileName: csvFile.name,
        fileUrl: uploadResult.url,
        fieldMappings: fieldMappings,
      });

      const jobId = (jobResult as any).insertId || (jobResult as any)[0]?.insertId;

      await executeJobMutation.mutateAsync({
        jobId: jobId,
        csvContent: csvContent,
      });
    } catch (error: any) {
      toast.error(`Import failed: ${error.message}`);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <h1 className="text-2xl font-bold text-primary cursor-pointer">{APP_TITLE}</h1>
          </Link>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/">Home</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/connections">Connections</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/history">History</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Import CSV to Azure SQL</h2>
            <div className="flex items-center gap-4 mt-4">
              <div className={`flex items-center gap-2 ${step >= 1 ? "text-primary" : "text-muted-foreground"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? "bg-primary text-white" : "bg-muted"}`}>
                  1
                </div>
                <span className="font-medium">Select Connection</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className={`flex items-center gap-2 ${step >= 2 ? "text-primary" : "text-muted-foreground"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? "bg-primary text-white" : "bg-muted"}`}>
                  2
                </div>
                <span className="font-medium">Upload CSV</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className={`flex items-center gap-2 ${step >= 3 ? "text-primary" : "text-muted-foreground"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? "bg-primary text-white" : "bg-muted"}`}>
                  3
                </div>
                <span className="font-medium">Map Fields</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className={`flex items-center gap-2 ${step >= 4 ? "text-primary" : "text-muted-foreground"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 4 ? "bg-primary text-white" : "bg-muted"}`}>
                  4
                </div>
                <span className="font-medium">Import</span>
              </div>
            </div>
          </div>

          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Select Azure SQL Connection</CardTitle>
                <CardDescription>Choose the database connection for this import</CardDescription>
              </CardHeader>
              <CardContent>
                {connectionsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : connections && connections.length > 0 ? (
                  <div className="space-y-4">
                    <Select
                      value={selectedConnection?.toString()}
                      onValueChange={(value) => setSelectedConnection(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a connection" />
                      </SelectTrigger>
                      <SelectContent>
                        {connections.map((conn) => (
                          <SelectItem key={conn.id} value={conn.id.toString()}>
                            {conn.name} - {conn.database} ({conn.tableName})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex justify-end">
                      <Button onClick={() => setStep(2)} disabled={!selectedConnection}>
                        Next
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">No connections available</p>
                    <Button asChild>
                      <Link href="/connections">Add Connection</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Upload CSV File</CardTitle>
                <CardDescription>Select a CSV file to import</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                    <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <Button onClick={() => fileInputRef.current?.click()}>
                      Choose CSV File
                    </Button>
                    {csvFile && (
                      <p className="mt-4 text-sm text-muted-foreground">
                        Selected: {csvFile.name}
                      </p>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                    <Button onClick={handleParseCSV} disabled={!csvFile || parseMutation.isPending}>
                      {parseMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Parsing...
                        </>
                      ) : (
                        <>
                          Parse & Continue
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>Map CSV Fields to Database Fields</CardTitle>
                <CardDescription>
                  Configure how CSV columns map to your database table fields. You can concatenate multiple fields and add custom text.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">CSV Preview</h4>
                    <div className="text-sm text-muted-foreground mb-2">
                      Headers: {csvHeaders.join(", ")}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {TARGET_FIELDS.map((targetField) => (
                      <div key={targetField} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <Label className="text-base font-semibold">{targetField}</Label>
                          {!fieldMappings[targetField] && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAddMapping(targetField, "csv")}
                              >
                                Map CSV Field
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAddMapping(targetField, "text")}
                              >
                                Add Text
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAddMapping(targetField, "concat")}
                              >
                                Concatenate
                              </Button>
                            </div>
                          )}
                          {fieldMappings[targetField] && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveMapping(targetField)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        {fieldMappings[targetField] && (
                          <div className="space-y-3">
                            {fieldMappings[targetField].type === "csv" && (
                              <Select
                                value={fieldMappings[targetField].csvField}
                                onValueChange={(value) => handleUpdateMapping(targetField, { csvField: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select CSV field" />
                                </SelectTrigger>
                                <SelectContent>
                                  {csvHeaders.map((header) => (
                                    <SelectItem key={header} value={header}>
                                      {header}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}

                            {fieldMappings[targetField].type === "text" && (
                              <Input
                                placeholder="Enter custom text"
                                value={fieldMappings[targetField].text || ""}
                                onChange={(e) => handleUpdateMapping(targetField, { text: e.target.value })}
                              />
                            )}

                            {fieldMappings[targetField].type === "concat" && (
                              <div className="space-y-2">
                                {fieldMappings[targetField].parts?.map((part, index) => (
                                  <div key={index} className="flex gap-2 items-center">
                                    <Select
                                      value={part.type}
                                      onValueChange={(value: "csv" | "text") =>
                                        handleUpdateConcatPart(targetField, index, { type: value })
                                      }
                                    >
                                      <SelectTrigger className="w-32">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="csv">CSV Field</SelectItem>
                                        <SelectItem value="text">Text</SelectItem>
                                      </SelectContent>
                                    </Select>

                                    {part.type === "csv" ? (
                                      <Select
                                        value={part.csvField}
                                        onValueChange={(value) =>
                                          handleUpdateConcatPart(targetField, index, { csvField: value })
                                        }
                                      >
                                        <SelectTrigger className="flex-1">
                                          <SelectValue placeholder="Select CSV field" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {csvHeaders.map((header) => (
                                            <SelectItem key={header} value={header}>
                                              {header}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <Input
                                        className="flex-1"
                                        placeholder="Enter text"
                                        value={part.text || ""}
                                        onChange={(e) =>
                                          handleUpdateConcatPart(targetField, index, { text: e.target.value })
                                        }
                                      />
                                    )}

                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => handleRemoveConcatPart(targetField, index)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAddConcatPart(targetField)}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add Part
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={() => setStep(2)}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                    <Button onClick={() => setStep(4)} disabled={Object.keys(fieldMappings).length === 0}>
                      Review & Import
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 4 && (
            <Card>
              <CardHeader>
                <CardTitle>Review & Import</CardTitle>
                <CardDescription>Review your mappings and start the import</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Import Summary</h4>
                    <div className="text-sm space-y-1">
                      <p>Connection: {connections?.find((c) => c.id === selectedConnection)?.name}</p>
                      <p>File: {csvFile?.name}</p>
                      <p>Mapped Fields: {Object.keys(fieldMappings).length}</p>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-3">Field Mappings</h4>
                    <div className="space-y-2 text-sm">
                      {Object.entries(fieldMappings).map(([field, mapping]) => (
                        <div key={field} className="flex justify-between py-1 border-b last:border-0">
                          <span className="font-medium">{field}:</span>
                          <span className="text-muted-foreground">
                            {mapping.type === "csv" && `CSV: ${mapping.csvField}`}
                            {mapping.type === "text" && `Text: "${mapping.text}"`}
                            {mapping.type === "concat" && `Concatenate (${mapping.parts?.length} parts)`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={() => setStep(3)}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      onClick={handleImport}
                      disabled={executeJobMutation.isPending || uploadMutation.isPending || createJobMutation.isPending}
                    >
                      {executeJobMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        "Start Import"
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
