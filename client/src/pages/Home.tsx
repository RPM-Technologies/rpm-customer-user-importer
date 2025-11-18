import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, FileSpreadsheet, History, Upload, Trash2 } from "lucide-react";
import { APP_TITLE, getLoginUrl } from "@/const";
import { Link } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">{APP_TITLE}</CardTitle>
            <CardDescription className="text-base mt-2">
              Import CSV files to Azure SQL Database with flexible field mapping
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span>Upload and parse CSV files</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Database className="h-4 w-4 text-primary" />
                <span>Map fields to Azure SQL tables</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Upload className="h-4 w-4 text-primary" />
                <span>Concatenate fields and add custom text</span>
              </div>
            </div>
            <Button className="w-full" size="lg" asChild>
              <a href={getLoginUrl()}>Sign In to Get Started</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Welcome to {APP_TITLE}</h1>
          <p className="text-muted-foreground mt-2">
            Import CSV files to Azure SQL Database with flexible field mapping
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <Database className="h-12 w-12 text-primary mb-4" />
              <CardTitle>Manage Connections</CardTitle>
              <CardDescription>
                Configure and test your Azure SQL database connections
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" asChild>
                <Link href="/connections">Manage Connections</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <Upload className="h-12 w-12 text-primary mb-4" />
              <CardTitle>Import CSV</CardTitle>
              <CardDescription>
                Upload CSV files and map fields to your database tables
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" asChild>
                <Link href="/import">Start Import</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <History className="h-12 w-12 text-primary mb-4" />
              <CardTitle>Import History</CardTitle>
              <CardDescription>
                View past imports and check their status and logs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline" asChild>
                <Link href="/history">View History</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <Trash2 className="h-12 w-12 text-primary mb-4" />
              <CardTitle>Data Cleanup</CardTitle>
              <CardDescription>
                Remove imported records by customer and import date
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline" asChild>
                <Link href="/cleanup">Cleanup Data</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
