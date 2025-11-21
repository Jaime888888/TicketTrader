
DROP DATABASE IF EXISTS ticket_trader;
CREATE DATABASE ticket_trader
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE ticket_trader;

CREATE TABLE users (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username      VARCHAR(50)     NOT NULL,
  email         VARCHAR(100)    NOT NULL,
  password_hash VARCHAR(255)    NOT NULL,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email    (email)
) ENGINE=InnoDB;


CREATE TABLE wallet (
  user_id    BIGINT UNSIGNED NOT NULL,
  cash_usd   DECIMAL(10,2)   NOT NULL DEFAULT 2000.00,  -- starting cash
  PRIMARY KEY (user_id),
  CONSTRAINT fk_wallet_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;


CREATE TABLE favorites (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  event_id    VARCHAR(64)     NOT NULL,  -- Ticketmaster event id
  event_name  VARCHAR(255)    NULL,      -- optional cached label
  event_image TEXT            NULL,      -- optional cached image url
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_fav_user_event (user_id, event_id),
  KEY ix_fav_user (user_id),
  CONSTRAINT fk_fav_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;


CREATE TABLE positions (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id          BIGINT UNSIGNED NOT NULL,
  event_id         VARCHAR(64)     NOT NULL,
  event_name       VARCHAR(255)    NULL,         -- optional cached label
  qty              INT             NOT NULL,     -- how many tickets you own
  total_cost_usd   DECIMAL(12,2)   NOT NULL,     -- sum of all buy costs (used for average cost)
  min_price_usd    DECIMAL(10,2)   NOT NULL,     -- latest min price seen from details API
  max_price_usd    DECIMAL(10,2)   NOT NULL,     -- latest max price seen from details API
  last_updated     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                            ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pos_user_event (user_id, event_id),
  KEY ix_pos_user (user_id),
  CONSTRAINT fk_pos_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;


CREATE OR REPLACE VIEW v_positions AS
SELECT
  p.id,
  p.user_id,
  p.event_id,
  p.event_name,
  p.qty,
  p.total_cost_usd,
  CASE WHEN p.qty > 0 THEN ROUND(p.total_cost_usd / p.qty, 2) ELSE NULL END AS avg_cost_usd,
  p.min_price_usd,
  p.max_price_usd,
  ROUND(p.max_price_usd * p.qty, 2) AS market_value_usd,
  p.last_updated
FROM positions p;


DELIMITER //
CREATE TRIGGER trg_users_after_insert
AFTER INSERT ON users
FOR EACH ROW
BEGIN
  INSERT INTO wallet(user_id, cash_usd) VALUES (NEW.id, 2000.00);
END//
DELIMITER ;
