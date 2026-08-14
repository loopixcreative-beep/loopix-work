# Admin Setup Instructions

## Grant Admin Role to Users

To grant admin privileges to specific users, run the following SQL in your Supabase SQL Editor:

```sql
-- Grant admin role to sanjaynewar007@gmail.com
INSERT INTO user_roles (user_id, role)
SELECT user_id, 'admin'::app_role
FROM profiles
WHERE email = 'sanjaynewar007@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Grant admin role to the second admin user (Sandesh Gadal)
-- Replace 'sandesh.gadal@example.com' with the actual email
INSERT INTO user_roles (user_id, role)
SELECT user_id, 'admin'::app_role
FROM profiles
WHERE email = 'YOUR_SECOND_ADMIN_EMAIL_HERE'
ON CONFLICT (user_id, role) DO NOTHING;
```

## Verify Admin Roles

To check which users have admin roles:

```sql
SELECT 
  ur.id,
  ur.role,
  p.full_name,
  p.email
FROM user_roles ur
JOIN profiles p ON ur.user_id = p.user_id
WHERE ur.role = 'admin'
ORDER BY p.email;
```

## Features Enabled for Admins

1. **Delete Projects**: Only admins can delete projects
2. **Delete Issues**: Admins can delete any issue
3. **Edit All Issues**: Admins can edit any issue regardless of assignment
4. **Role Management**: Admins can assign roles to other users via Settings > Role Management
5. **Full Project Control**: Admins can manage all projects

## Other User Roles

- **manager**: Can manage projects and issues but cannot delete projects
- **user**: Standard user with basic permissions
- **employee**: Same as user (legacy role)
- **stakeholder**: View-only access (legacy role)
