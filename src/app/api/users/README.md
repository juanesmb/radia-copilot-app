# User Registration API

## Overview
This API endpoint allows user registration with email uniqueness validation. It creates a new user record only if the email doesn't already exist in the database.

## Endpoint
- **URL**: `/api/users`
- **Method**: `POST`
- **Authentication**: Required (Clerk JWT)

## Request Body
```json
{
  "email": "user@example.com",
  "language": "es"
}
```

### Fields
- `email` (required): User's email address
- `language` (optional): User's preferred language, defaults to "es"

## Response

### Success Response (201 - New User Created)
```json
{
  "user": {
    "id": "47d07d2c-e4b1-4e31-980d-e25002b5a0cb",
    "created_at": "2026-02-17 21:19:25.08899+00",
    "email": "user@example.com",
    "language": "es"
  },
  "isNewUser": true,
  "message": "User registered successfully"
}
```

### Success Response (200 - User Already Exists)
```json
{
  "user": {
    "id": "47d07d2c-e4b1-4e31-980d-e25002b5a0cb",
    "created_at": "2026-02-17 21:19:25.08899+00",
    "email": "user@example.com",
    "language": "es"
  },
  "isNewUser": false,
  "message": "User already exists"
}
```

### Error Responses
- `400`: Bad Request (invalid JSON, missing email, invalid email format)
- `401`: Unauthorized (no valid JWT token)
- `500`: Internal Server Error

## Database Schema
The `users` table has the following structure:
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  email VARCHAR(255) UNIQUE NOT NULL,
  language VARCHAR(10) NOT NULL DEFAULT 'es'
);
```

## Usage Example
```javascript
const response = await fetch('/api/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <your-jwt-token>'
  },
  body: JSON.stringify({
    email: 'johan@gmail.com',
    language: 'es'
  })
});

const result = await response.json();
console.log(result);
```

## Notes
- The endpoint uses Row Level Security (RLS) to ensure users can only access their own records
- Email validation is performed using a basic regex pattern
- The endpoint follows the existing API patterns in the codebase
