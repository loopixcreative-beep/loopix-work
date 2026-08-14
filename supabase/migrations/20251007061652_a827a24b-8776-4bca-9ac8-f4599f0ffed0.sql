-- Create trigger for awarding coin points on task completion
CREATE TRIGGER award_coin_points_trigger
  AFTER UPDATE ON issues
  FOR EACH ROW
  EXECUTE FUNCTION award_coin_points_on_completion();

-- Manually award points for existing completed tasks
UPDATE profiles p
SET coin_points = (
  SELECT COUNT(*) * 10
  FROM issues i
  WHERE i.assignee_id = p.user_id AND i.status = 'done'
)
WHERE EXISTS (
  SELECT 1 FROM issues i
  WHERE i.assignee_id = p.user_id AND i.status = 'done'
);