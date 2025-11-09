import { useAuth } from "@/_core/hooks/useAuth";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { APP_TITLE, getLoginUrl } from "@/const";

export default function ImportHistory() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [isLogsDialogOpen, setIsLogsDialogOpen] = useState(false);

  const { data: jobs, isLoading: jobsLoading } = trpc.importJob.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: logs, isLoading: logsLoading } = trpc.importJob.getLogs.useQuery(
    { jobId: selectedJobId! },
    { enabled: selectedJobId !== null }
  );

  const handleViewLogs = (jobId: number) => {
    setSelectedJobId(jobId);
    setIsLogsDialogOpen(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "processing":
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default",
      failed: "destructive",
      processing: "secondary",
      pending: "outline",
    };
    return (
      <Badge variant={variants[status] || "outline"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
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
              <Link href="/import">Import</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Import History</h2>
            <p className="text-muted-foreground">View your past CSV imports and their status</p>
          </div>

          {jobsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : jobs && jobs.length > 0 ? (
            <div className="space-y-4">
              {jobs.map((job) => (
                <Card key={job.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(job.status)}
                        <div>
                          <CardTitle className="text-lg">{job.fileName}</CardTitle>
                          <CardDescription>
                            {new Date(job.createdAt).toLocaleString()}
                          </CardDescription>
                        </div>
                      </div>
                      {getStatusBadge(job.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Rows</p>
                        <p className="text-lg font-semibold">{job.totalRows}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Processed</p>
                        <p className="text-lg font-semibold text-green-600">{job.processedRows}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Failed</p>
                        <p className="text-lg font-semibold text-red-600">{job.failedRows}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Success Rate</p>
                        <p className="text-lg font-semibold">
                          {job.totalRows > 0
                            ? Math.round((job.processedRows / job.totalRows) * 100)
                            : 0}
                          %
                        </p>
                      </div>
                    </div>

                    {job.errorMessage && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-red-900">Error</p>
                          <p className="text-sm text-red-700">{job.errorMessage}</p>
                        </div>
                      </div>
                    )}

                    {job.failedRows > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewLogs(job.id)}
                      >
                        View Error Logs
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No import history</h3>
                <p className="text-muted-foreground mb-6">
                  You haven't imported any CSV files yet
                </p>
                <Button asChild>
                  <Link href="/import">Start Your First Import</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />

      <Dialog open={isLogsDialogOpen} onOpenChange={setIsLogsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Error Logs</DialogTitle>
            <DialogDescription>
              Detailed error information for failed rows
            </DialogDescription>
          </DialogHeader>
          {logsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : logs && logs.length > 0 ? (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`border rounded-lg p-3 ${
                    log.level === "error"
                      ? "border-red-200 bg-red-50"
                      : log.level === "warning"
                      ? "border-yellow-200 bg-yellow-50"
                      : "border-blue-200 bg-blue-50"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {log.level === "error" && <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />}
                    {log.level === "warning" && <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold">Row {log.rowNumber}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm">{log.message}</p>
                      {log.rowData ? (
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer">
                            View row data
                          </summary>
                          <pre className="text-xs mt-2 p-2 bg-white rounded border overflow-x-auto">
                            {String(JSON.stringify(log.rowData, null, 2))}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No logs available</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
