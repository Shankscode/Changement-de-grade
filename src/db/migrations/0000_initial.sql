-- Migration: 0000_initial
-- Creates all tables for brawl-grade-bot

DO $$ BEGIN
  CREATE TYPE "link_history_reason" AS ENUM ('initial_link', 'automatic_transfer', 'admin_unlink', 'manual_relink');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
---> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "challenge_status" AS ENUM ('pending', 'verified', 'expired', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
---> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "role_action" AS ENUM ('add_role', 'remove_role', 'replace_role', 'clear_roles', 'skip_under_10000', 'permission_error', 'role_not_found', 'dry_run');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
---> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guilds" (
  "id" serial PRIMARY KEY,
  "discord_guild_id" text NOT NULL UNIQUE,
  "name" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
---> statement-breakpoint
CREATE TABLE IF NOT EXISTS "grade_roles" (
  "id" serial PRIMARY KEY,
  "guild_id" integer NOT NULL REFERENCES "guilds"("id"),
  "threshold" integer NOT NULL,
  "discord_role_id" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "grade_roles_guild_threshold_uniq" UNIQUE ("guild_id", "threshold"),
  CONSTRAINT "grade_roles_guild_role_uniq" UNIQUE ("guild_id", "discord_role_id")
);
---> statement-breakpoint
CREATE TABLE IF NOT EXISTS "players" (
  "id" serial PRIMARY KEY,
  "brawl_tag" text NOT NULL UNIQUE,
  "brawl_name" text,
  "highest_trophies" integer NOT NULL DEFAULT 0,
  "last_fetched_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
---> statement-breakpoint
CREATE TABLE IF NOT EXISTS "discord_accounts" (
  "id" serial PRIMARY KEY,
  "discord_user_id" text NOT NULL UNIQUE,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
---> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account_links" (
  "id" serial PRIMARY KEY,
  "guild_id" integer NOT NULL REFERENCES "guilds"("id"),
  "discord_account_id" integer NOT NULL REFERENCES "discord_accounts"("id"),
  "player_id" integer NOT NULL REFERENCES "players"("id"),
  "verified_at" timestamp NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "current_grade_threshold" integer,
  "current_role_id" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
---> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "account_links_discord_guild_active_uniq"
  ON "account_links" ("discord_account_id", "guild_id")
  WHERE active = true;
---> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "account_links_player_guild_active_uniq"
  ON "account_links" ("player_id", "guild_id")
  WHERE active = true;
---> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account_link_history" (
  "id" serial PRIMARY KEY,
  "guild_id" integer NOT NULL REFERENCES "guilds"("id"),
  "player_id" integer NOT NULL REFERENCES "players"("id"),
  "previous_discord_account_id" integer REFERENCES "discord_accounts"("id"),
  "new_discord_account_id" integer NOT NULL REFERENCES "discord_accounts"("id"),
  "reason" "link_history_reason" NOT NULL,
  "transferred_at" timestamp NOT NULL DEFAULT now()
);
---> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification_challenges" (
  "id" serial PRIMARY KEY,
  "guild_id" integer NOT NULL REFERENCES "guilds"("id"),
  "discord_account_id" integer NOT NULL REFERENCES "discord_accounts"("id"),
  "player_id" integer NOT NULL REFERENCES "players"("id"),
  "expected_favorite_brawler_id" integer NOT NULL,
  "status" "challenge_status" NOT NULL DEFAULT 'pending',
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "verified_at" timestamp
);
---> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_assignment_logs" (
  "id" serial PRIMARY KEY,
  "guild_id" integer NOT NULL REFERENCES "guilds"("id"),
  "discord_account_id" integer REFERENCES "discord_accounts"("id"),
  "player_id" integer REFERENCES "players"("id"),
  "action" "role_action" NOT NULL,
  "success" boolean NOT NULL,
  "previous_role_id" text,
  "new_role_id" text,
  "error_message" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
