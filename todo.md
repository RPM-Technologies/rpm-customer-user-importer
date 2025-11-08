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
