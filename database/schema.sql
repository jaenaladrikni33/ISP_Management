CREATE DATABASE IF NOT EXISTS lenet_local
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE lenet_local;

CREATE TABLE IF NOT EXISTS app_users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL DEFAULT '',
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_date DATETIME NOT NULL,
  updated_date DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS entity_records (
  entity VARCHAR(80) NOT NULL,
  id CHAR(36) NOT NULL,
  data LONGTEXT NOT NULL,
  created_date DATETIME NOT NULL,
  updated_date DATETIME NOT NULL,
  PRIMARY KEY (entity, id),
  KEY entity_created (entity, created_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  expires_at DATETIME NOT NULL,
  KEY reset_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS private_files (
  id CHAR(36) NOT NULL PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  mime_type VARCHAR(80) NOT NULL,
  file_data LONGBLOB NOT NULL,
  created_date DATETIME NOT NULL,
  KEY file_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
