# CSV to Azure SQL Importer

A web application that allows you to import CSV files into Azure SQL databases with advanced field mapping capabilities, including concatenation and custom text insertion.

## Features

### Azure SQL Connection Management
- Configure multiple Azure SQL database connections
- Test connections before saving
- Store connection details securely
- Specify target table names for imports

### CSV Upload and Parsing
- Upload CSV files through a user-friendly interface
- Automatic header detection and parsing
- Preview CSV data before importing
- Support for standard CSV format

### Advanced Field Mapping
The application provides three types of field mappings:

1. **CSV Field Mapping**: Map a CSV column directly to a database field
2. **Custom Text**: Insert static text into a database field
3. **Concatenation**: Combine multiple CSV fields and custom text
   - Add multiple parts (CSV fields or text)
   - Parts are concatenated in order
   - Perfect for creating full names, addresses, or formatted identifiers

### Target Database Fields
The application supports mapping to the following Azure SQL database fields:
- Customer Name
- Display Name
- First Name
- Last Name
- Company Name (supports custom text entry)
- Job Title
- Employee ID
- Employee Type
- Employee Hire Date
- Work Email
- Department
- Office Location
- Street Address
- City
- State
- Postal Code
- Business Phone
- Business Mobile Phone
- Fax Number
- Personal Mobile Phone
- Manager Email

### Import History and Logging
- Track all import jobs with detailed status
- View success/failure statistics
- Access detailed error logs for failed rows
- Monitor import progress in real-time

## How to Use

### 1. Configure Azure SQL Connection
1. Navigate to **Manage Connections**
2. Click **Add Connection**
3. Fill in your Azure SQL database details:
   - Connection Name (friendly name)
   - Server (e.g., myserver.database.windows.net)
   - Database name
   - Username and password
   - Port (default: 1433)
   - Target table name
4. Click **Test Connection** to verify
5. Save the connection

### 2. Import CSV File
1. Navigate to **Import CSV**
2. **Step 1**: Select an Azure SQL connection from the dropdown
3. **Step 2**: Upload your CSV file
4. **Step 3**: Map CSV fields to database fields
   - For each database field, choose one of:
     - **Map CSV Field**: Select a column from your CSV
     - **Add Text**: Enter custom static text
     - **Concatenate**: Combine multiple CSV fields and text
       - Click "Add Part" to add more elements
       - Choose CSV field or text for each part
       - Remove parts as needed
5. **Step 4**: Review your mappings and click **Start Import**

### 3. View Import History
1. Navigate to **Import History**
2. View all past imports with:
   - Import status (Pending, Processing, Completed, Failed)
   - Total rows, processed rows, and failed rows
   - Success rate percentage
3. Click **View Error Logs** on failed imports to see detailed error information

## Example Use Cases

### Concatenating Full Names
Map "Display Name" field by concatenating:
- CSV Field: "FirstName"
- Text: " "
- CSV Field: "LastName"

### Adding Company Name with Static Text
Map "Company Name" field:
- Text: "Acme Corporation"

### Creating Email from Parts
Map "Work Email" field by concatenating:
- CSV Field: "username"
- Text: "@company.com"

### Building Full Address
Map "Street Address" field by concatenating:
- CSV Field: "StreetNumber"
- Text: " "
- CSV Field: "StreetName"

## Docker Deployment

### Prerequisites
- Docker and Docker Compose installed on your system
- Azure SQL Server with firewall rules configured

### Quick Start with Docker

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd csv-azure-importer
   ```

2. **Create environment file**:
   Create a `.env` file in the project root with the following variables:
   ```env
   # MySQL Database Configuration (used by Docker Compose)
   MYSQL_ROOT_PASSWORD=rootpassword
   MYSQL_DATABASE=csv_importer
   MYSQL_USER=csvuser
   MYSQL_PASSWORD=csvpassword
   
   # Application Configuration
   JWT_SECRET=your-jwt-secret-key
   OAUTH_SERVER_URL=https://api.manus.im
   VITE_OAUTH_PORTAL_URL=https://portal.manus.im
   VITE_APP_ID=your-app-id
   OWNER_OPEN_ID=your-owner-open-id
   OWNER_NAME=Your Name
   VITE_APP_TITLE=CSV to Azure SQL Importer
   VITE_APP_LOGO=/logo.svg
   ```
   
   **Note**: The `DATABASE_URL` is automatically configured to connect to the MySQL container. You don't need to set it manually.

3. **Build and run with Docker Compose**:
   ```bash
   docker-compose up -d
   ```

4. **Wait for services to start**:
   The MySQL database will initialize on first run (takes about 30 seconds)
   
5. **Access the application**:
   Open your browser and navigate to `http://localhost:3000`

### What's Included

The Docker Compose setup includes:
- **Application Container**: The CSV to Azure SQL Importer web application
- **MySQL Container**: MySQL 8.0 database for storing application data (connections, import jobs, logs, templates, audit logs)
- **Persistent Volume**: MySQL data is stored in a Docker volume for persistence
- **Health Checks**: Both containers have health monitoring
- **Automatic Networking**: Containers communicate via a private network

### Manual Docker Build

If you prefer to build and run without Docker Compose:

```bash
# Build the image
docker build -t csv-azure-importer .

# Run the container
docker run -d \
  --name csv-azure-importer \
  -p 3000:3000 \
  --env-file .env \
  csv-azure-importer
```

### Docker Image Details

- **Base Image**: Node.js 22 Alpine (lightweight)
- **Multi-stage Build**: Optimized for production
- **Port**: 3000
- **Health Check**: Built-in health monitoring
- **Restart Policy**: Automatic restart on failure

### Production Deployment Tips

1. **Use a reverse proxy** (nginx, Caddy) for SSL/TLS termination
2. **Set strong JWT_SECRET** for production environments
3. **Configure Azure SQL firewall** to allow your Docker host IP
4. **Use Docker volumes** for persistent data if needed
5. **Monitor container health** using Docker health checks
6. **Set resource limits** in docker-compose.yml for production

### Stopping the Application

```bash
# Stop and remove containers
docker-compose down

# Stop and remove containers with volumes
docker-compose down -v
```

## Technical Details

### Database Schema
The application uses the following tables:
- **users**: User authentication and authorization
- **azure_connections**: Stored Azure SQL connection configurations
- **import_jobs**: Track import sessions and status
- **import_logs**: Detailed error logs for troubleshooting

### Security
- User authentication via Manus OAuth
- Connection passwords stored in database
- Role-based access control (admin/user)
- All imports are user-scoped

### Technology Stack
- **Frontend**: React 19, Tailwind CSS 4, shadcn/ui components
- **Backend**: Express 4, tRPC 11
- **Database**: MySQL/TiDB (for application data)
- **Azure SQL**: mssql library for Azure SQL connectivity
- **CSV Parsing**: PapaParse library

## Important Notes

### Azure SQL Connection Requirements
- Ensure your Azure SQL server allows connections from the application's IP
- Enable SSL/TLS encryption (default configuration)
- Use SQL Server authentication (username/password)
- Grant appropriate permissions to the database user for INSERT operations

### CSV File Requirements
- Files must be in standard CSV format
- First row should contain column headers
- Use UTF-8 encoding for special characters
- Empty rows are automatically skipped

### Field Mapping Tips
- Map all required fields in your Azure SQL table
- Use concatenation for complex field transformations
- Test with a small CSV file first
- Review error logs if imports fail

### Error Handling
- Row-level error tracking (individual row failures don't stop the entire import)
- Detailed error messages for troubleshooting
- Failed rows can be identified and corrected
- Import continues even if some rows fail

## Support

For issues, questions, or feature requests, please contact support through the application interface.
