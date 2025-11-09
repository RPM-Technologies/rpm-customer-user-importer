# Project TODO

## Core Features

- [x] CSV file upload functionality
- [x] CSV header parsing and display
- [x] Field mapping interface
- [x] Support for concatenating multiple CSV fields
- [x] Support for adding custom text to field mappings
- [x] Azure SQL database connection configuration
- [x] Data import to Azure SQL database
- [x] Validation and error handling
- [x] User authentication and authorization
- [x] Import history tracking

## Database Schema

- [x] Create import_jobs table to track import sessions
- [x] Create field_mappings table to store mapping configurations
- [x] Create import_logs table for error tracking

## UI Components

- [x] CSV upload page
- [x] Field mapping interface
- [x] Database configuration page
- [x] Import progress indicator
- [x] Import history dashboard


## Bug Fixes

- [x] Fix whitespace trimming in connection form inputs

- [x] Add server-side input trimming and validation
- [x] Clean existing connection data with whitespace

## Enhancements

- [x] Add test connection button for existing connections
- [x] Improve test connection UI feedback

- [x] Fix SQL insert syntax to only include mapped fields
- [x] Handle empty/unmapped fields properly
- [x] Verify header row is properly skipped during import

- [x] Fix SQL column name escaping for names with spaces

- [x] Update database field names to PascalCase without spaces

- [x] Fix SQL INSERT syntax for schema-qualified table names (e.g., [other].[CustomerData])


## Mapping Template Feature

- [x] Create mapping_templates table in database
- [x] Add backend API for creating templates
- [x] Add backend API for listing templates
- [x] Add backend API for loading templates
- [x] Add backend API for deleting templates
- [x] Add "Save as Template" button in field mapping UI
- [x] Add template selector dropdown in field mapping UI
- [x] Add template management in dialogs
- [x] Test template save and load functionality


## ImportDate Feature

- [x] Add ImportDate to TARGET_FIELDS list
- [x] Update import logic to automatically set ImportDate to current datetime
- [x] Test ImportDate is correctly populated during import


## ImportDate Date Picker Feature

- [x] Add date picker UI in import wizard for ImportDate selection
- [x] Default ImportDate to current date
- [x] Pass selected ImportDate to backend during import
- [x] Update backend to use user-selected ImportDate instead of automatic current datetime
- [x] Test date selection functionality


## Data Cleanup Feature

- [x] Create backend API to fetch distinct customer names from Azure SQL
- [x] Create backend API to fetch distinct import dates from Azure SQL
- [x] Create backend API to delete records by customer name and import date
- [x] Create Data Cleanup page with navigation
- [x] Add customer name dropdown selector
- [x] Add import date dropdown selector
- [x] Add delete confirmation dialog
- [x] Test data cleanup functionality


## Cleanup Audit Log Feature

- [x] Create cleanup_audit_logs table in database schema
- [x] Add database helper functions for audit log operations
- [x] Update deleteRecords mutation to create audit log entries
- [x] Create backend API to fetch audit logs
- [x] Create Audit Logs page with filtering options
- [x] Add navigation link to Audit Logs page
- [x] Test audit log creation and viewing


## Customer Name Dropdown Feature

- [x] Remove ImportDate from TARGET_FIELDS list
- [x] Remove ImportDate date picker from import wizard UI
- [x] Remove ImportDate logic from backend import function
- [x] Create backend API to fetch company names from pc.PC_Customers table
- [x] Add customer name dropdown in import wizard (Step 1 or review step)
- [x] Update import logic to use selected customer name for CustomerName field
- [x] Test customer name selection and import
