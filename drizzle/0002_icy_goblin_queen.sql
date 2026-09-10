ALTER TABLE `orders` MODIFY COLUMN `orderType` enum('MARKET','LIMIT','STOP_LOSS','STOP_LIMIT') NOT NULL DEFAULT 'MARKET';--> statement-breakpoint
ALTER TABLE `orders` ADD `idempotencyKey` varchar(64);--> statement-breakpoint
ALTER TABLE `orders` ADD `rejectionReason` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(256);--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_idempotencyKey_unique` UNIQUE(`idempotencyKey`);--> statement-breakpoint
ALTER TABLE `alerts` ADD CONSTRAINT `alerts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `alerts` ADD CONSTRAINT `alerts_stockId_stocks_id_fk` FOREIGN KEY (`stockId`) REFERENCES `stocks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `holdings` ADD CONSTRAINT `holdings_portfolioId_portfolios_id_fk` FOREIGN KEY (`portfolioId`) REFERENCES `portfolios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `holdings` ADD CONSTRAINT `holdings_stockId_stocks_id_fk` FOREIGN KEY (`stockId`) REFERENCES `stocks`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `market_data` ADD CONSTRAINT `market_data_stockId_stocks_id_fk` FOREIGN KEY (`stockId`) REFERENCES `stocks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_portfolioId_portfolios_id_fk` FOREIGN KEY (`portfolioId`) REFERENCES `portfolios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_stockId_stocks_id_fk` FOREIGN KEY (`stockId`) REFERENCES `stocks`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portfolio_snapshots` ADD CONSTRAINT `portfolio_snapshots_portfolioId_portfolios_id_fk` FOREIGN KEY (`portfolioId`) REFERENCES `portfolios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portfolios` ADD CONSTRAINT `portfolios_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_portfolioId_portfolios_id_fk` FOREIGN KEY (`portfolioId`) REFERENCES `portfolios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_stockId_stocks_id_fk` FOREIGN KEY (`stockId`) REFERENCES `stocks`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `watchlist_items` ADD CONSTRAINT `watchlist_items_watchlistId_watchlists_id_fk` FOREIGN KEY (`watchlistId`) REFERENCES `watchlists`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `watchlist_items` ADD CONSTRAINT `watchlist_items_stockId_stocks_id_fk` FOREIGN KEY (`stockId`) REFERENCES `stocks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `watchlists` ADD CONSTRAINT `watchlists_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `orders_idempotency_idx` ON `orders` (`idempotencyKey`);