-- Add BUSINESS to the Role enum so venue accounts can be distinguished from
-- consumer users at the auth level.
ALTER TABLE `User` MODIFY `role` ENUM('USER', 'ADMIN', 'BUSINESS') NOT NULL DEFAULT 'USER';
