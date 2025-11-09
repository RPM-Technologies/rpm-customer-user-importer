import { useAuth } from "@/_core/hooks/useAuth";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Loader2, FileText, Shield } from "lucide-react";
import { Link } from "wouter";
import { APP_TITLE, getLoginUrl } from "@/const";

export default function AuditLogs() {
  const { isAuthenticated, loading: authLoading, user } = useAuth();

  const { data: auditLogs, isLoading: logsLoading } = trpc.auditLog.list.useQuery(
    { limit: 100 },
    { enabled: isAuthenticated }
  );

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
            <Button variant="ghost" asChild>
              <Link href="/cleanup">Cleanup</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-6 w-6" />
                Cleanup Audit Logs
              </CardTitle>
              <CardDescription>
                Track all data deletion operations with timestamps, user information, and record counts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : auditLogs?.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground mb-2">No audit logs found</p>
                  <p className="text-sm text-muted-foreground">
                    Deletion operations will be tracked here for compliance and troubleshooting
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Customer Name</TableHead>
                        <TableHead>Import Date</TableHead>
                        <TableHead>Table Name</TableHead>
                        <TableHead className="text-right">Records Deleted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs?.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium">
                            {new Date(log.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell>{log.customerName}</TableCell>
                          <TableCell>{log.importDate}</TableCell>
                          <TableCell className="font-mono text-sm">{log.tableName}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {log.deletedCount}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {auditLogs && auditLogs.length > 0 && (
                <div className="mt-4 text-sm text-muted-foreground">
                  Showing {auditLogs.length} most recent audit log entries
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
