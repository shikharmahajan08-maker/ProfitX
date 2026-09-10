ALTER TABLE `orders` DROP INDEX `orders_idempotencyKey_unique`;--> statement-breakpoint
DROP INDEX `orders_idempotency_idx` ON `orders`;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_idempotency_idx` UNIQUE(`userId`,`idempotencyKey`);