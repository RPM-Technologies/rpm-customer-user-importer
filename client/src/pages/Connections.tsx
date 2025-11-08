import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Database, Plus, Trash2, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { APP_TITLE, getLoginUrl } from "@/const";

export default function Connections() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    server: "",
    database: "",
    username: "",
    password: "",
    port: 1433,
    tableName: "",
  });

  const utils = trpc.useUtils();
  const { data: connections, isLoading } = trpc.azureConnection.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const createMutation = trpc.azureConnection.create.useMutation({
    onSuccess: () => {
      toast.success("Connection created successfully");
      setIsDialogOpen(false);
      setFormData({ name: "", server: "", database: "", username: "", password: "", port: 1433, tableName: "" });
      utils.azureConnection.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to create connection: ${error.message}`);
    },
  });

  const deleteMutation = trpc.azureConnection.delete.useMutation({
    onSuccess: () => {
      toast.success("Connection deleted successfully");
      utils.azureConnection.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to delete connection: ${error.message}`);
    },
  });

  const testMutation = trpc.azureConnection.testConnection.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Connection test successful!");
      } else {
        toast.error(`Connection test failed: ${result.error}`);
      }
      setIsTesting(false);
    },
    onError: (error) => {
      toast.error(`Connection test failed: ${error.message}`);
      setIsTesting(false);
    },
  });

  const handleTestConnection = async () => {
    if (!formData.server || !formData.database || !formData.username || !formData.password) {
      toast.error("Please fill in all connection fields");
      return;
    }
    setIsTesting(true);
    testMutation.mutate({
      server: formData.server,
      database: formData.database,
      username: formData.username,
      password: formData.password,
      port: formData.port,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.tableName) {
      toast.error("Please fill in all fields");
      return;
    }
    createMutation.mutate(formData);
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
              <Link href="/import">Import</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/history">History</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">Azure SQL Connections</h2>
              <p className="text-muted-foreground">Manage your database connections</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Connection
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>Add Azure SQL Connection</DialogTitle>
                    <DialogDescription>
                      Configure a new Azure SQL database connection
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Connection Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="My Azure DB"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="server">Server</Label>
                        <Input
                          id="server"
                          value={formData.server}
                          onChange={(e) => setFormData({ ...formData, server: e.target.value })}
                          placeholder="myserver.database.windows.net"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="database">Database</Label>
                        <Input
                          id="database"
                          value={formData.database}
                          onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                          placeholder="mydatabase"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          placeholder="admin"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="port">Port</Label>
                        <Input
                          id="port"
                          type="number"
                          value={formData.port}
                          onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                          placeholder="1433"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="tableName">Table Name</Label>
                        <Input
                          id="tableName"
                          value={formData.tableName}
                          onChange={(e) => setFormData({ ...formData, tableName: e.target.value })}
                          placeholder="Employees"
                        />
                      </div>
                    </div>
                    <Button type="button" variant="outline" onClick={handleTestConnection} disabled={isTesting}>
                      {isTesting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        "Test Connection"
                      )}
                    </Button>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Creating..." : "Create Connection"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : connections && connections.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {connections.map((conn) => (
                <Card key={conn.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <Database className="h-10 w-10 text-primary" />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate({ id: conn.id })}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <CardTitle className="mt-4">{conn.name}</CardTitle>
                    <CardDescription>{conn.server}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Database:</span>
                        <span className="font-medium">{conn.database}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Table:</span>
                        <span className="font-medium">{conn.tableName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Port:</span>
                        <span className="font-medium">{conn.port}</span>
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        {conn.isActive ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-green-600 text-xs font-medium">Active</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 text-red-600" />
                            <span className="text-red-600 text-xs font-medium">Inactive</span>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Database className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No connections yet</h3>
                <p className="text-muted-foreground mb-6">
                  Add your first Azure SQL database connection to get started
                </p>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Connection
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
