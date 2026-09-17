-- Opponent display names move out of code so a name can be added without a
-- deploy. Seeded from the map they lived in, so the table is never empty on a
-- database that has run its migrations; import refuses to run if it ever is.
CREATE TABLE "OpponentAlias" (
    "id"          TEXT NOT NULL,
    "scrapedName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OpponentAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OpponentAlias_scrapedName_key" ON "OpponentAlias"("scrapedName");

INSERT INTO "OpponentAlias" ("id", "scrapedName", "displayName") VALUES
  ('seed_00', 'ΑΣΠΡΟΜΑΥΡΑ ΥΠΟΒΡΥΧΙΑ', 'Aspromavra Ipovrichia'),
  ('seed_01', 'ΓΕΡΟΛΥΚΟΙ B.C.', 'Gerolykoi'),
  ('seed_02', 'ΛΑΛΑΔΕΣ BC', 'Lalades BC'),
  ('seed_03', 'ΡΕΝΤΑΚΗΔΕΣ', 'Rentakides'),
  ('seed_04', 'ΣΚΙΛΛΟΥΝΤΙΑ', 'Skillountia'),
  ('seed_05', 'ΦΟΝΙΚΕΣ ΤΡΟΜΠΕΤΕΣ', 'Fonikes Trompetes'),
  ('seed_06', 'ΧΛΑΤΣΕΡΣ LEGENDS', 'Xlatsers Legends'),
  ('seed_07', 'AIRBALL WIZARDS', 'Airball Wizards'),
  ('seed_08', 'AIRBALLS', 'Airballs'),
  ('seed_09', 'ATALANTOI HAWKS', 'Atalantoi Hawks'),
  ('seed_10', 'B.C. ABLA', 'B.C. Abla'),
  ('seed_11', 'BLACKOUTS B.A.M.C.', 'Blackouts BAMC'),
  ('seed_12', 'CAPPUCCINO KNIGHTS', 'Cappuccino Knights'),
  ('seed_13', 'CUBA LIBRE', 'Cuba Libre'),
  ('seed_14', 'DRAGONS', 'Dragons'),
  ('seed_15', 'EAZY TIGERS', 'Eazy Tigers'),
  ('seed_16', 'FAST BAKERS', 'Fast Bakers'),
  ('seed_17', 'GEROLEAGUE STARS', 'Geroleague Stars'),
  ('seed_18', 'HUSTLING HUSKIES', 'Hustling Huskies'),
  ('seed_19', 'MIAMI BRICKS', 'Miami Bricks'),
  ('seed_20', 'NEW YORK BRICKS', 'New York Bricks'),
  ('seed_21', 'PATISSIA THUNDERS', 'Patissia Thunders'),
  ('seed_22', 'PORT WARRIORS', 'Port Warriors'),
  ('seed_23', 'PTOMA HAWKS', 'Ptoma Hawks'),
  ('seed_24', 'RED HAWKS', 'Red Hawks'),
  ('seed_25', 'S.H.A.W.', 'Shaw'),
  ('seed_26', 'SAPIENS', 'Sapiens'),
  ('seed_27', 'SHARKS', 'Sharks'),
  ('seed_28', 'TAZ BOYS', 'Taz Boyz'),
  ('seed_29', 'THE 90`s', 'The 90s'),
  ('seed_30', 'THEMISTOKLIO THUNDERS', 'Themistoklio Thunders'),
  ('seed_31', 'TRANSPORTERS', 'Transporters'),
  ('seed_32', 'VROMIKOMETA', 'Vromikometa'),
  ('seed_33', 'WUHAN SURVIVORS', 'Wuhan Survivors');
