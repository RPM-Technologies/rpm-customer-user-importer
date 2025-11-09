import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { APP_TITLE, getLoginUrl } from "@/const";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function DataCleanup() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [selectedConnection, setSelectedConnection] = useState<number | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [selectedImportDate, setSelectedImportDate] = useState<string>("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: connections, isLoading: connectionsLoading } = trpc.azureConnection.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: customers, isLoading: customersLoading } = trpc.dataCleanup.getCustomers.useQuery(
    { connectionId: selectedConnection! },
    { enabled: !!selectedConnection }
  );

  const { data: importDates, isLoading: importDatesLoading } = trpc.dataCleanup.getImportDates.useQuery(
    { connectionId: selectedConnection! },
    { enabled: !!selectedConnection }
  );

  const deleteRecordsMutation = trpc.dataCleanup.deleteRecords.useMutation({
    onSuccess: (result) => {
      toast.success(`Successfully deleted ${result.deletedCount} record(s)`);
      setSelectedCustomer("");
      setSelectedImportDate("");
      setShowDeleteDialog(false);
    },
    onError: (error) => {
      toast.error(`Failed to delete records: ${error.message}`);
      setShowDeleteDialog(false);
    },
  });

  const handleDelete = () => {
    if (!selectedConnection || !selectedCustomer || !selectedImportDate) {
      toast.error("Please select connection, customer, and import date");
      return;
    }

    deleteRecordsMutation.mutate({
      connectionId: selectedConnection,
      customerName: selectedCustomer,
      importDate: selectedImportDate,
    });
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
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-6 w-6" />
                Data Cleanup
              </CardTitle>
              <CardDescription>
                Remove imported records by customer name and import date
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-semibold mb-1">Warning: This action cannot be undone</p>
                    <p>All records matching the selected customer name and import date will be permanently deleted from the database.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="connection">Select Connection</Label>
                    <Select
                      value={selectedConnection?.toString() || ""}
                      onValueChange={(value) => {
                        setSelectedConnection(parseInt(value));
                        setSelectedCustomer("");
                        setSelectedImportDate("");
                      }}
                    >
                      <SelectTrigger id="connection">
                        <SelectValue placeholder="Choose a database connection" />
                      </SelectTrigger>
                      <SelectContent>
                        {connectionsLoading ? (
                          <div className="p-2 text-center text-sm text-muted-foreground">Loading...</div>
                        ) : connections?.length === 0 ? (
                          <div className="p-2 text-center text-sm text-muted-foreground">No connections found</div>
                        ) : (
                          connections?.map((conn) => (
                            <SelectItem key={conn.id} value={conn.id.toString()}>
                              {conn.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedConnection && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="customer">Select Customer</Label>
                        <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                          <SelectTrigger id="customer">
                            <SelectValue placeholder="Choose a customer" />
                          </SelectTrigger>
                          <SelectContent>
                            {customersLoading ? (
                              <div className="p-2 text-center text-sm text-muted-foreground">Loading...</div>
                            ) : customers?.length === 0 ? (
                              <div className="p-2 text-center text-sm text-muted-foreground">No customers found</div>
                            ) : (
                              customers?.map((customer) => (
                                <SelectItem key={customer} value={customer}>
                                  {customer}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="importDate">Select Import Date</Label>
                        <Select value={selectedImportDate} onValueChange={setSelectedImportDate}>
                          <SelectTrigger id="importDate">
                            <SelectValue placeholder="Choose an import date" />
                          </SelectTrigger>
                          <SelectContent>
                            {importDatesLoading ? (
                              <div className="p-2 text-center text-sm text-muted-foreground">Loading...</div>
                            ) : importDates?.length === 0 ? (
                              <div className="p-2 text-center text-sm text-muted-foreground">No import dates found</div>
                            ) : (
                              importDates?.map((date) => (
                                <SelectItem key={date} value={date}>
                                  {date}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>

                <div className="pt-4">
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={!selectedConnection || !selectedCustomer || !selectedImportDate || deleteRecordsMutation.isPending}
                    className="w-full"
                  >
                    {deleteRecordsMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Records
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all records for customer <strong>{selectedCustomer}</strong> imported on{" "}
              <strong>{selectedImportDate}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Records
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
