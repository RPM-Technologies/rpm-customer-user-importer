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
