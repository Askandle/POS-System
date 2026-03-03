# Service Creation Feature

## Overview
Added the ability for admin users to create new services directly from the Services page.

## Features Implemented

### 1. Create Service API Function
- **Location**: `/src/db/api.ts`
- **Function**: `createService()`
- Creates a new service with name, description, base price, and unit
- Returns the created service object
- Automatically sets the service as active

### 2. Enhanced Services Page
- **Location**: `/src/pages/ServicesPage.tsx`
- **New Components**:
  - "Add Service" button (visible only to admin users)
  - Dialog modal with form for creating services
  - Form validation using Zod schema
  - Loading states during submission

### 3. Form Fields
- **Service Name** (required): Text input, max 100 characters
- **Description** (optional): Textarea, max 500 characters
- **Base Price** (required): Number input, minimum $0.01
- **Unit** (required): Text input, max 50 characters (e.g., "per hour", "per session")

### 4. Security
- Only users with `admin` role can see and access the "Add Service" button
- Database-level security enforced through RLS policies
- Form validation prevents invalid data submission

### 5. User Experience
- Success/error toast notifications
- Form resets after successful creation
- Services list automatically refreshes after creation
- Dialog closes automatically on success
- Disabled submit button during processing

## How to Use

### For Admin Users:
1. Navigate to the Services page
2. Click the "Add Service" button in the top-right corner
3. Fill in the service details:
   - Enter a descriptive service name
   - Optionally add a description
   - Set the base price
   - Specify the unit (e.g., "per hour", "per session", "per item")
4. Click "Create Service"
5. The new service will appear in the services list immediately

### For Staff Users:
- The "Add Service" button is not visible
- Can only view and select services for checkout

## Technical Details

### Dependencies Used:
- `react-hook-form`: Form state management
- `zod`: Schema validation
- `@hookform/resolvers`: Zod resolver for react-hook-form
- `shadcn/ui`: Dialog, Form, Input, Textarea components

### Database Schema:
```sql
services table:
- id: uuid (primary key)
- name: text (required)
- description: text (optional)
- base_price: numeric (required)
- unit: text (required)
- active: boolean (default: true)
- created_at: timestamp
```

### RLS Policies:
- All authenticated users can view services (SELECT)
- Only admins can create, update, and delete services (INSERT, UPDATE, DELETE)

## Future Enhancements (Optional)
- Edit existing services
- Delete/deactivate services
- Bulk service management
- Service categories
- Service images
- Pricing tiers
