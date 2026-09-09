CREATE TABLE `alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stockId` int NOT NULL,
	`alert_type` enum('PRICE_ABOVE','PRICE_BELOW') NOT NULL,
	`targetValue` decimal(14,2) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`triggeredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `holdings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`portfolioId` int NOT NULL,
	`stockId` int NOT NULL,
	`quantity` decimal(14,4) NOT NULL,
	`averageBuyPrice` decimal(14,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `holdings_id` PRIMARY KEY(`id`),
	CONSTRAINT `holdings_portfolio_stock_unique` UNIQUE(`portfolioId`,`stockId`)
);
--> statement-breakpoint
CREATE TABLE `market_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stockId` int NOT NULL,
	`timestamp` timestamp NOT NULL,
	`open` decimal(14,2) NOT NULL,
	`high` decimal(14,2) NOT NULL,
	`low` decimal(14,2) NOT NULL,
	`close` decimal(14,2) NOT NULL,
	`volume` int NOT NULL,
	CONSTRAINT `market_data_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `news` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(220) NOT NULL,
	`description` text NOT NULL,
	`source` varchar(80) NOT NULL,
	`url` varchar(500),
	`publishedAt` timestamp NOT NULL,
	`sector` varchar(80) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `news_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`portfolioId` int NOT NULL,
	`stockId` int NOT NULL,
	`side` enum('BUY','SELL') NOT NULL,
	`orderType` enum('MARKET') NOT NULL DEFAULT 'MARKET',
	`quantity` decimal(14,4) NOT NULL,
	`requestedPrice` decimal(14,2) NOT NULL,
	`executedPrice` decimal(14,2),
	`totalAmount` decimal(16,2),
	`status` enum('PENDING','EXECUTED','CANCELLED','REJECTED') NOT NULL DEFAULT 'PENDING',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portfolio_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`portfolioId` int NOT NULL,
	`totalValue` decimal(16,2) NOT NULL,
	`cashValue` decimal(16,2) NOT NULL,
	`investedValue` decimal(16,2) NOT NULL,
	`pnl` decimal(16,2) NOT NULL,
	`timestamp` timestamp NOT NULL,
	CONSTRAINT `portfolio_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portfolios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`cashBalance` decimal(16,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portfolios_id` PRIMARY KEY(`id`),
	CONSTRAINT `portfolios_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `stocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`symbol` varchar(16) NOT NULL,
	`companyName` varchar(160) NOT NULL,
	`exchange` varchar(32) NOT NULL,
	`sector` varchar(80) NOT NULL,
	`industry` varchar(120),
	`currentPrice` decimal(14,2) NOT NULL,
	`previousClose` decimal(14,2) NOT NULL,
	`dayHigh` decimal(14,2) NOT NULL,
	`dayLow` decimal(14,2) NOT NULL,
	`week52High` decimal(14,2) NOT NULL,
	`week52Low` decimal(14,2) NOT NULL,
	`volume` int NOT NULL,
	`marketCap` decimal(18,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stocks_id` PRIMARY KEY(`id`),
	CONSTRAINT `stocks_symbol_unique` UNIQUE(`symbol`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`portfolioId` int NOT NULL,
	`stockId` int NOT NULL,
	`orderId` int NOT NULL,
	`transaction_type` enum('BUY','SELL') NOT NULL,
	`quantity` decimal(14,4) NOT NULL,
	`price` decimal(14,2) NOT NULL,
	`totalAmount` decimal(16,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `watchlist_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`watchlistId` int NOT NULL,
	`stockId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `watchlist_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `watchlist_items_watchlist_stock_unique` UNIQUE(`watchlistId`,`stockId`)
);
--> statement-breakpoint
CREATE TABLE `watchlists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `watchlists_id` PRIMARY KEY(`id`),
	CONSTRAINT `watchlists_user_name_unique` UNIQUE(`userId`,`name`)
);
--> statement-breakpoint
CREATE INDEX `alerts_user_active_idx` ON `alerts` (`userId`,`isActive`);--> statement-breakpoint
CREATE INDEX `market_data_stock_date_idx` ON `market_data` (`stockId`,`timestamp`);--> statement-breakpoint
CREATE INDEX `news_published_idx` ON `news` (`publishedAt`);--> statement-breakpoint
CREATE INDEX `news_sector_idx` ON `news` (`sector`);--> statement-breakpoint
CREATE INDEX `orders_user_created_idx` ON `orders` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `snapshots_portfolio_time_idx` ON `portfolio_snapshots` (`portfolioId`,`timestamp`);--> statement-breakpoint
CREATE INDEX `stocks_sector_idx` ON `stocks` (`sector`);--> statement-breakpoint
CREATE INDEX `transactions_user_created_idx` ON `transactions` (`userId`,`createdAt`);