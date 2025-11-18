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


## UI Reorganization - Move Selectors to Map Fields Page

- [x] Remove CustomerName from TARGET_FIELDS list
- [x] Move customer name dropdown from review step to Map Fields page (Step 3)
- [x] Add date selector to Map Fields page (Step 3) with current date as default
- [x] Remove customer and date selectors from review step (Step 4)
- [x] Update import logic to use importDate from state
- [x] Test the reorganized workflow


## Docker Containerization

- [x] Create Dockerfile for production build
- [x] Create docker-compose.yml for easy deployment
- [x] Create .dockerignore file
- [x] Update README.md with Docker instructions
- [x] Test Docker build


## MySQL Database Container

- [x] Add MySQL service to docker-compose.yml
- [x] Configure database volumes for persistence
- [x] Update app service to depend on MySQL
- [x] Update README.md with MySQL container instructions


## Production Docker Compose

- [x] Create docker-compose.prod.yml with resource limits
- [x] Add security configurations (read-only filesystem, no-new-privileges)
- [x] Configure production logging
- [x] Add production deployment documentation


## RPM Technologies Branding

- [x] Copy RPM Technologies logo to public directory
- [x] Update APP_LOGO constant to use RPM logo
- [x] Add copyright footer to all pages
- [x] Update page titles and metadata with RPM branding


## RPM Brand Color and Title Update

- [x] Update primary color to #AD1111 in index.css
- [ ] Update APP_TITLE to "RPM Customer Users Importer" in const.ts
- [x] Test color changes across all pages

- [x] Remove "CSV to Azure SQL Importer" heading and subtitle from main page

- [x] Create Azure App Services deployment documentation with Docker configuration

- [x] Create MySQL configuration guide for Azure deployment

- [x] Create automated deployment scripts (Bash and PowerShell) for Azure

- [x] Create Ubuntu server deployment script for Docker container with port 8080:8443

- [ ] Update deployment script to use /opt/customer-importer directory

- [x] Set up Nginx reverse proxy with Let's Encrypt SSL for rpm-importer-dev.rpmit.com on ports 8080:8443

- [x] Obtain and install Let's Encrypt SSL certificate for rpm-importer-dev.rpmit.com

- [x] Fix "Invalid URL" error by configuring production environment variables

- [x] Configure Azure Entra ID (Azure AD) authentication for single sign-on

- [x] Deploy Azure Entra ID authentication with App ID a44431bc-695a-4b44-a2ab-1617f636f773

- [x] Remove all Manus references and make application standalone with Azure AD only

- [ ] Fix Azure AD authentication error AADSTS700054 - enable ID tokens in app registration

- [x] Fix Azure AD 'invalid state' error - configure session and cookie settings properly

- [x] Implement MySQL-backed session store to replace MemoryStore and fix Azure AD state persistence

- [x] Fix session cookie settings for Nginx proxy environment - adjust secure/sameSite settings

- [x] Switch Azure AD to cookie-based state storage instead of session-based


- [x] Add cookie-parser middleware for Azure AD cookie-based authentication


- [x] Update Azure client secret in production environment


- [x] Create users table in production database


## User Management

- [x] Add tRPC procedures for user management (list, add, delete)
- [x] Update authentication to only allow existing users to login
- [x] Create user management UI page with add/delete functionality
- [x] Add admin-only access control for user management


- [x] Fix Azure AD environment variables not loading in production container


- [x] Fix .env.production file persistence during container restarts


- [x] Create startup script for easy deployment and initialization


- [x] Fix MySQL session store SSL/TLS certificate error by disabling SSL for local connections


- [x] Perform complete clean deployment from scratch


- [ ] Fix VITE_APP_TITLE and other VITE environment variables in production build


- [x] Update Home page to use DashboardLayout for navigation and logout access

