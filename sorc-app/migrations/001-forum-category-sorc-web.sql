-- Forum category id rename: sorc-beyond -> sorc-web
--
-- The SORC Beyond platform was renamed to SORC Web. The forum category
-- carried the id 'sorc-beyond', and that id was changed in the code to
-- 'sorc-web' at the same time.
--
-- threads.category_id stores the id as a literal string, and the API reads
-- threads with `WHERE category_id = ?` bound to the code's id. So every
-- thread posted under the old id stops matching any category: it disappears
-- from the forum listing and the category's thread count reads zero. The
-- rows are still there, they just no longer join to anything.
--
-- This repoints them. Safe to run more than once.

UPDATE threads SET category_id = 'sorc-web' WHERE category_id = 'sorc-beyond';

-- Check afterwards. The first number should be 0, the second should be the
-- thread count you expect to see on the SORC Web category:
--
--   SELECT COUNT(*) FROM threads WHERE category_id = 'sorc-beyond';
--   SELECT COUNT(*) FROM threads WHERE category_id = 'sorc-web';
