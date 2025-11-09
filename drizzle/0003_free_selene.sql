CREATE TABLE `cleanup_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`connectionId` int NOT NULL,
	`customerName` varchar(255) NOT NULL,
	`importDate` varchar(10) NOT NULL,
	`deletedCount` int NOT NULL,
	`tableName` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cleanup_audit_logs_id` PRIMARY KEY(`id`)
);
