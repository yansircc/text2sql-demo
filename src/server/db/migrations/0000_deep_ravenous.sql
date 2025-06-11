CREATE TABLE `text2sql_companies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`companyId` integer NOT NULL,
	`name` text(500) NOT NULL,
	`serialId` text(100),
	`shortName` text(200),
	`country` text(10),
	`countryName` text(100),
	`timezone` text(50),
	`poolName` text(100),
	`groupName` text(100),
	`trailStatus` text(50),
	`star` integer DEFAULT 0,
	`homepage` text(500),
	`address` text(1000),
	`remark` text,
	`createTime` integer,
	`updateTime` integer,
	`privateTime` integer,
	`publicTime` integer,
	`isPrivate` integer DEFAULT 0,
	`customerRecycle42349295325607` text,
	`quoteCustomer42086173429707` text,
	`hasWebsite20753699812867` text,
	`searchKeywords7375691812971` text,
	`mainBusiness7375678270531` text,
	`inquiryKeywords22467658539` text,
	`requiredProducts19978277361` text,
	`publicAllocation19977530773` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `text2sql_companies_companyId_unique` ON `text2sql_companies` (`companyId`);--> statement-breakpoint
CREATE INDEX `companies_company_id_idx` ON `text2sql_companies` (`companyId`);--> statement-breakpoint
CREATE INDEX `companies_name_idx` ON `text2sql_companies` (`name`);--> statement-breakpoint
CREATE INDEX `companies_country_idx` ON `text2sql_companies` (`country`);--> statement-breakpoint
CREATE INDEX `companies_is_private_idx` ON `text2sql_companies` (`isPrivate`);--> statement-breakpoint
CREATE TABLE `text2sql_company_user_relations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`companyId` integer NOT NULL,
	`userId` text(100) NOT NULL,
	`relationType` text(50) DEFAULT 'owner',
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`companyId`) REFERENCES `text2sql_companies`(`companyId`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`userId`) REFERENCES `text2sql_sales_users`(`userId`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `company_user_relations_company_id_idx` ON `text2sql_company_user_relations` (`companyId`);--> statement-breakpoint
CREATE INDEX `company_user_relations_user_id_idx` ON `text2sql_company_user_relations` (`userId`);--> statement-breakpoint
CREATE TABLE `text2sql_contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customerId` integer NOT NULL,
	`companyId` integer NOT NULL,
	`name` text(200) NOT NULL,
	`email` text(255),
	`gender` integer DEFAULT 0,
	`post` text(100),
	`whatsapp` text(50),
	`telAreaCode` text(10),
	`tel` text(50),
	`isMain` integer DEFAULT 0,
	`remark` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`companyId`) REFERENCES `text2sql_companies`(`companyId`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `text2sql_contacts_customerId_unique` ON `text2sql_contacts` (`customerId`);--> statement-breakpoint
CREATE INDEX `contacts_customer_id_idx` ON `text2sql_contacts` (`customerId`);--> statement-breakpoint
CREATE INDEX `contacts_company_id_idx` ON `text2sql_contacts` (`companyId`);--> statement-breakpoint
CREATE INDEX `contacts_email_idx` ON `text2sql_contacts` (`email`);--> statement-breakpoint
CREATE INDEX `contacts_whatsapp_idx` ON `text2sql_contacts` (`whatsapp`);--> statement-breakpoint
CREATE TABLE `text2sql_follow_ups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`followUpId` integer NOT NULL,
	`companyId` integer NOT NULL,
	`customerId` integer,
	`opportunityId` integer,
	`userId` text(100) NOT NULL,
	`content` text NOT NULL,
	`type` integer DEFAULT 101,
	`createTime` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`companyId`) REFERENCES `text2sql_companies`(`companyId`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customerId`) REFERENCES `text2sql_contacts`(`customerId`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`userId`) REFERENCES `text2sql_sales_users`(`userId`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `text2sql_follow_ups_followUpId_unique` ON `text2sql_follow_ups` (`followUpId`);--> statement-breakpoint
CREATE INDEX `follow_ups_company_id_idx` ON `text2sql_follow_ups` (`companyId`);--> statement-breakpoint
CREATE INDEX `follow_ups_user_id_idx` ON `text2sql_follow_ups` (`userId`);--> statement-breakpoint
CREATE INDEX `follow_ups_create_time_idx` ON `text2sql_follow_ups` (`createTime`);--> statement-breakpoint
CREATE TABLE `text2sql_opportunities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`opportunityId` integer NOT NULL,
	`name` text(500) NOT NULL,
	`serialId` text(100),
	`companyId` integer NOT NULL,
	`mainUserId` text(100) NOT NULL,
	`amount` real DEFAULT 0,
	`currency` text(10) DEFAULT 'USD',
	`stageName` text(100),
	`typeName` text(100),
	`originName` text(100),
	`remark` text,
	`createTime` integer,
	`updateTime` integer,
	`orderTime` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`companyId`) REFERENCES `text2sql_companies`(`companyId`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mainUserId`) REFERENCES `text2sql_sales_users`(`userId`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `text2sql_opportunities_opportunityId_unique` ON `text2sql_opportunities` (`opportunityId`);--> statement-breakpoint
CREATE INDEX `opportunities_company_id_idx` ON `text2sql_opportunities` (`companyId`);--> statement-breakpoint
CREATE INDEX `opportunities_main_user_id_idx` ON `text2sql_opportunities` (`mainUserId`);--> statement-breakpoint
CREATE INDEX `opportunities_amount_idx` ON `text2sql_opportunities` (`amount`);--> statement-breakpoint
CREATE TABLE `text2sql_sales_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text(100) NOT NULL,
	`nickname` text(100) NOT NULL,
	`name` text(100),
	`avatar` text(500),
	`departmentName` text(100),
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `text2sql_sales_users_userId_unique` ON `text2sql_sales_users` (`userId`);--> statement-breakpoint
CREATE INDEX `sales_users_user_id_idx` ON `text2sql_sales_users` (`userId`);--> statement-breakpoint
CREATE INDEX `sales_users_nickname_idx` ON `text2sql_sales_users` (`nickname`);--> statement-breakpoint
CREATE TABLE `text2sql_whatsapp_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`messageId` text(200) NOT NULL,
	`timestamp` integer NOT NULL,
	`fromNumber` text(50) NOT NULL,
	`toNumber` text(50) NOT NULL,
	`body` text,
	`fromMe` integer NOT NULL,
	`contactName` text(200),
	`hasMedia` integer DEFAULT 0,
	`ack` integer DEFAULT 0,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `text2sql_whatsapp_messages_messageId_unique` ON `text2sql_whatsapp_messages` (`messageId`);--> statement-breakpoint
CREATE INDEX `whatsapp_from_number_idx` ON `text2sql_whatsapp_messages` (`fromNumber`);--> statement-breakpoint
CREATE INDEX `whatsapp_to_number_idx` ON `text2sql_whatsapp_messages` (`toNumber`);--> statement-breakpoint
CREATE INDEX `whatsapp_timestamp_idx` ON `text2sql_whatsapp_messages` (`timestamp`);--> statement-breakpoint
CREATE INDEX `whatsapp_from_me_idx` ON `text2sql_whatsapp_messages` (`fromMe`);