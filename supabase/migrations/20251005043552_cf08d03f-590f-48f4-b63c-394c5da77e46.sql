-- Add calendar_entry_link column to issues table
ALTER TABLE issues ADD COLUMN calendar_entry_link text;

-- Add comment for the new column
COMMENT ON COLUMN issues.calendar_entry_link IS 'Link to related calendar entry for task details and documentation';