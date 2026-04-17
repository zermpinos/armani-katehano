import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client.ts";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ─── Raw Redis data ───────────────────────────────────────────────────────────

const RAW_PLAYERS = [
  { id: "p1",  number: 0,  name: "Alexandros Kougianos",      position: "PF/C"     },
  { id: "p2",  number: 3,  name: "Stathis Christofilopoulos", position: "SG"       },
  { id: "p3",  number: 5,  name: "Panagiotis Zermpinos",      position: "C"        },
  { id: "p4",  number: 6,  name: "Nikos Tsiardakas",          position: "PG/SG"    },
  { id: "p5",  number: 8,  name: "Spyros Papaspyrou",         position: "PG"       },
  { id: "p6",  number: 9,  name: "Dimitris Alevizos",         position: "SG"       },
  { id: "p7",  number: 10, name: "Loukas Margaritis",         position: "C"        },
  { id: "p8",  number: 11, name: "Giorgos Antonakos",         position: "PG"       },
  { id: "p9",  number: 14, name: "Giorgos Tsioulkas",         position: "SF/PF"    },
  { id: "p10", number: 19, name: "Panagiotis Antonakos",      position: "PG/SG/SF" },
  { id: "p11", number: 23, name: "Konstantinos Psillas",      position: "PG/SG"    },
  { id: "p12", number: 26, name: "Tolis Michalopoulos",       position: "SG/SF"    },
  { id: "p13", number: 77, name: "Andreas Papadimitriou",     position: "PG/SG"    },
];

const RAW_GAMES = [
  {
    id: "id_1773322959546_f5y5i", date: "2025-09-14", opponent: "Fonikes Trompetes",
    home: true, result: "L", score: "34-37", league: "wintercup",
    boxScore: [
      { pid:"p1",  min:17, pts:2,  reb:3,  orb:1, drb:2, ast:0, stl:0, blk:0, tov:0, pf:0, fgm:1,  fga:3,  fg3m:0, fg3a:1,  ftm:0, fta:0  },
      { pid:"p2",  min:27, pts:0,  reb:4,  orb:0, drb:4, ast:2, stl:2, blk:0, tov:0, pf:0, fgm:0,  fga:0,  fg3m:0, fg3a:5,  ftm:0, fta:0  },
      { pid:"p3",  min:32, pts:2,  reb:7,  orb:3, drb:4, ast:0, stl:0, blk:1, tov:0, pf:3, fgm:1,  fga:3,  fg3m:0, fg3a:0,  ftm:0, fta:0  },
      { pid:"p4",  min:25, pts:9,  reb:4,  orb:2, drb:2, ast:1, stl:3, blk:1, tov:1, pf:2, fgm:4,  fga:13, fg3m:1, fg3a:2,  ftm:0, fta:0  },
      { pid:"p6",  min:18, pts:2,  reb:3,  orb:0, drb:3, ast:1, stl:2, blk:0, tov:0, pf:1, fgm:1,  fga:7,  fg3m:0, fg3a:4,  ftm:0, fta:2  },
      { pid:"p8",  min:24, pts:7,  reb:6,  orb:1, drb:5, ast:3, stl:0, blk:0, tov:3, pf:3, fgm:3,  fga:8,  fg3m:0, fg3a:1,  ftm:1, fta:4  },
      { pid:"p10", min:26, pts:2,  reb:4,  orb:2, drb:2, ast:0, stl:3, blk:1, tov:3, pf:0, fgm:1,  fga:7,  fg3m:0, fg3a:0,  ftm:0, fta:0  },
      { pid:"p11", min:9,  pts:2,  reb:0,  orb:0, drb:0, ast:0, stl:0, blk:0, tov:0, pf:3, fgm:1,  fga:3,  fg3m:0, fg3a:0,  ftm:0, fta:0  },
      { pid:"p12", min:17, pts:2,  reb:3,  orb:1, drb:2, ast:0, stl:0, blk:0, tov:0, pf:0, fgm:1,  fga:3,  fg3m:0, fg3a:1,  ftm:0, fta:0  },
      { pid:"p13", min:22, pts:8,  reb:0,  orb:0, drb:0, ast:3, stl:0, blk:0, tov:2, pf:4, fgm:3,  fga:10, fg3m:2, fg3a:7,  ftm:0, fta:0  },
    ],
  },
  {
    id: "id_1773324710533_ersm7", date: "2025-09-20", opponent: "Eazy Tigers",
    home: false, result: "L", score: "43-54", league: "wintercup",
    boxScore: [
      { pid:"p1",  min:19, pts:0,  reb:1,  orb:1, drb:0, ast:0, stl:0, blk:0, tov:1, pf:3, fgm:0,  fga:3,  fg3m:0, fg3a:2,  ftm:0, fta:0  },
      { pid:"p2",  min:26, pts:7,  reb:12, orb:6, drb:6, ast:4, stl:1, blk:0, tov:0, pf:0, fgm:3,  fga:7,  fg3m:1, fg3a:5,  ftm:0, fta:0  },
      { pid:"p3",  min:21, pts:0,  reb:1,  orb:0, drb:1, ast:0, stl:0, blk:0, tov:0, pf:1, fgm:0,  fga:0,  fg3m:0, fg3a:0,  ftm:0, fta:0  },
      { pid:"p4",  min:30, pts:13, reb:7,  orb:0, drb:7, ast:0, stl:0, blk:0, tov:2, pf:2, fgm:6,  fga:17, fg3m:1, fg3a:6,  ftm:0, fta:2  },
      { pid:"p6",  min:17, pts:2,  reb:3,  orb:2, drb:1, ast:2, stl:2, blk:0, tov:1, pf:1, fgm:0,  fga:7,  fg3m:0, fg3a:3,  ftm:2, fta:2  },
      { pid:"p9",  min:21, pts:8,  reb:2,  orb:0, drb:2, ast:1, stl:2, blk:0, tov:1, pf:3, fgm:3,  fga:12, fg3m:1, fg3a:3,  ftm:1, fta:4  },
      { pid:"p10", min:29, pts:2,  reb:6,  orb:1, drb:5, ast:3, stl:1, blk:0, tov:2, pf:0, fgm:1,  fga:2,  fg3m:0, fg3a:0,  ftm:0, fta:0  },
      { pid:"p12", min:11, pts:5,  reb:4,  orb:2, drb:2, ast:0, stl:0, blk:0, tov:0, pf:5, fgm:2,  fga:5,  fg3m:1, fg3a:3,  ftm:0, fta:0  },
      { pid:"p13", min:25, pts:6,  reb:2,  orb:0, drb:2, ast:3, stl:0, blk:0, tov:3, pf:1, fgm:3,  fga:10, fg3m:0, fg3a:7,  ftm:0, fta:0  },
    ],
  },
  {
    id: "id_1773699918141_ylx5p", date: "2026-02-07", opponent: "Hustling Huskies",
    home: false, result: "L", score: "49-72", league: "bc6",
    boxScore: [
      { pid:"p1",  min:15, pts:1,  reb:3,  orb:1, drb:2, ast:0, stl:1, blk:0, tov:0, pf:0, fgm:0,  fga:2,  fg3m:0, fg3a:0,  ftm:1, fta:2  },
      { pid:"p2",  min:24, pts:3,  reb:4,  orb:2, drb:2, ast:3, stl:3, blk:0, tov:0, pf:0, fgm:1,  fga:8,  fg3m:0, fg3a:5,  ftm:1, fta:2  },
      { pid:"p3",  min:20, pts:2,  reb:3,  orb:0, drb:3, ast:0, stl:0, blk:0, tov:0, pf:0, fgm:1,  fga:1,  fg3m:0, fg3a:0,  ftm:0, fta:2  },
      { pid:"p4",  min:33, pts:16, reb:2,  orb:1, drb:1, ast:2, stl:3, blk:0, tov:1, pf:3, fgm:6,  fga:10, fg3m:3, fg3a:5,  ftm:1, fta:2  },
      { pid:"p5",  min:33, pts:18, reb:9,  orb:1, drb:8, ast:2, stl:3, blk:0, tov:4, pf:0, fgm:8,  fga:26, fg3m:0, fg3a:5,  ftm:2, fta:2  },
      { pid:"p7",  min:7,  pts:0,  reb:1,  orb:1, drb:0, ast:1, stl:0, blk:0, tov:0, pf:0, fgm:0,  fga:0,  fg3m:0, fg3a:0,  ftm:0, fta:0  },
      { pid:"p8",  min:29, pts:2,  reb:3,  orb:1, drb:2, ast:4, stl:0, blk:0, tov:2, pf:0, fgm:1,  fga:9,  fg3m:0, fg3a:1,  ftm:0, fta:2  },
      { pid:"p9",  min:30, pts:7,  reb:10, orb:1, drb:9, ast:3, stl:1, blk:0, tov:1, pf:0, fgm:2,  fga:8,  fg3m:1, fg3a:5,  ftm:2, fta:4  },
      { pid:"p12", min:10, pts:0,  reb:1,  orb:0, drb:1, ast:1, stl:0, blk:0, tov:0, pf:0, fgm:0,  fga:2,  fg3m:0, fg3a:2,  ftm:0, fta:0  },
    ],
  },
  {
    id: "id_1773699709624_d5jca", date: "2026-02-15", opponent: "THE 90s",
    home: false, result: "W", score: "46-40", league: "bc6",
    boxScore: [
      { pid:"p2",  min:37, pts:12, reb:4,  orb:2, drb:2, ast:4, stl:3, blk:0, tov:1, pf:3, fgm:4,  fga:10, fg3m:4, fg3a:10, ftm:0, fta:0  },
      { pid:"p3",  min:15, pts:0,  reb:0,  orb:0, drb:0, ast:1, stl:1, blk:0, tov:0, pf:0, fgm:0,  fga:0,  fg3m:0, fg3a:0,  ftm:0, fta:0  },
      { pid:"p6",  min:23, pts:3,  reb:9,  orb:3, drb:6, ast:2, stl:1, blk:0, tov:1, pf:1, fgm:1,  fga:14, fg3m:0, fg3a:5,  ftm:1, fta:2  },
      { pid:"p7",  min:25, pts:4,  reb:13, orb:5, drb:8, ast:1, stl:3, blk:0, tov:1, pf:1, fgm:2,  fga:5,  fg3m:0, fg3a:0,  ftm:0, fta:0  },
      { pid:"p8",  min:24, pts:9,  reb:10, orb:2, drb:8, ast:7, stl:1, blk:0, tov:3, pf:5, fgm:4,  fga:11, fg3m:0, fg3a:0,  ftm:1, fta:3  },
      { pid:"p9",  min:32, pts:18, reb:5,  orb:2, drb:3, ast:1, stl:1, blk:0, tov:1, pf:0, fgm:8,  fga:14, fg3m:0, fg3a:1,  ftm:2, fta:7  },
      { pid:"p10", min:23, pts:0,  reb:5,  orb:0, drb:5, ast:0, stl:2, blk:0, tov:0, pf:3, fgm:0,  fga:3,  fg3m:0, fg3a:0,  ftm:0, fta:0  },
      { pid:"p11", min:10, pts:0,  reb:3,  orb:1, drb:2, ast:1, stl:0, blk:0, tov:1, pf:2, fgm:0,  fga:2,  fg3m:0, fg3a:2,  ftm:0, fta:0  },
      { pid:"p12", min:10, pts:0,  reb:3,  orb:0, drb:3, ast:0, stl:1, blk:0, tov:0, pf:1, fgm:0,  fga:3,  fg3m:0, fg3a:2,  ftm:0, fta:0  },
    ],
  },
  {
    id: "id_1773699567571_29ww1", date: "2026-02-21", opponent: "DRAGONS",
    home: false, result: "W", score: "58-55", league: "bc6",
    boxScore: [
      { pid:"p1",  min:19, pts:0,  reb:4,  orb:1, drb:3, ast:1, stl:0, blk:1, tov:0, pf:2, fgm:0,  fga:2,  fg3m:0, fg3a:1,  ftm:0, fta:0  },
      { pid:"p3",  min:24, pts:0,  reb:8,  orb:2, drb:6, ast:2, stl:2, blk:0, tov:0, pf:1, fgm:0,  fga:1,  fg3m:0, fg3a:0,  ftm:0, fta:0  },
      { pid:"p4",  min:37, pts:10, reb:5,  orb:0, drb:5, ast:2, stl:0, blk:0, tov:2, pf:4, fgm:3,  fga:5,  fg3m:2, fg3a:3,  ftm:2, fta:2  },
      { pid:"p6",  min:28, pts:11, reb:3,  orb:2, drb:1, ast:4, stl:4, blk:0, tov:0, pf:3, fgm:3,  fga:8,  fg3m:1, fg3a:1,  ftm:4, fta:6  },
      { pid:"p8",  min:36, pts:21, reb:5,  orb:2, drb:3, ast:5, stl:0, blk:0, tov:1, pf:4, fgm:7,  fga:15, fg3m:0, fg3a:1,  ftm:7, fta:10 },
      { pid:"p9",  min:25, pts:14, reb:7,  orb:1, drb:6, ast:0, stl:2, blk:1, tov:3, pf:5, fgm:7,  fga:17, fg3m:0, fg3a:3,  ftm:0, fta:3  },
      { pid:"p11", min:13, pts:2,  reb:1,  orb:0, drb:1, ast:0, stl:0, blk:0, tov:0, pf:2, fgm:1,  fga:3,  fg3m:0, fg3a:1,  ftm:0, fta:2  },
      { pid:"p12", min:18, pts:0,  reb:8,  orb:1, drb:7, ast:2, stl:1, blk:0, tov:0, pf:2, fgm:0,  fga:2,  fg3m:0, fg3a:0,  ftm:0, fta:0  },
    ],
  },
  {
    id: "id_1773699365517_zi2uj", date: "2026-02-28", opponent: "B.C. ABLA",
    home: false, result: "W", score: "53-39", league: "bc6",
    boxScore: [
      { pid:"p1",  min:10, pts:0,  reb:1,  orb:0, drb:1, ast:0, stl:0, blk:0, tov:0, pf:1, fgm:0,  fga:1,  fg3m:0, fg3a:1,  ftm:0, fta:0  },
      { pid:"p2",  min:27, pts:12, reb:12, orb:5, drb:7, ast:0, stl:1, blk:0, tov:0, pf:0, fgm:5,  fga:12, fg3m:2, fg3a:7,  ftm:0, fta:0  },
      { pid:"p3",  min:17, pts:0,  reb:6,  orb:3, drb:3, ast:1, stl:0, blk:0, tov:1, pf:3, fgm:0,  fga:0,  fg3m:0, fg3a:0,  ftm:0, fta:0  },
      { pid:"p4",  min:28, pts:2,  reb:2,  orb:1, drb:1, ast:0, stl:1, blk:0, tov:1, pf:1, fgm:0,  fga:5,  fg3m:0, fg3a:4,  ftm:2, fta:4  },
      { pid:"p8",  min:32, pts:17, reb:2,  orb:1, drb:1, ast:1, stl:0, blk:0, tov:0, pf:2, fgm:7,  fga:15, fg3m:1, fg3a:1,  ftm:2, fta:8  },
      { pid:"p9",  min:29, pts:13, reb:7,  orb:1, drb:6, ast:0, stl:0, blk:0, tov:1, pf:2, fgm:6,  fga:11, fg3m:0, fg3a:2,  ftm:1, fta:3  },
      { pid:"p10", min:23, pts:4,  reb:4,  orb:0, drb:4, ast:2, stl:0, blk:0, tov:0, pf:1, fgm:2,  fga:3,  fg3m:0, fg3a:1,  ftm:0, fta:0  },
      { pid:"p11", min:9,  pts:2,  reb:0,  orb:0, drb:0, ast:0, stl:0, blk:0, tov:0, pf:4, fgm:1,  fga:3,  fg3m:0, fg3a:0,  ftm:0, fta:0  },
      { pid:"p13", min:25, pts:3,  reb:3,  orb:0, drb:3, ast:4, stl:1, blk:0, tov:0, pf:1, fgm:1,  fga:8,  fg3m:1, fg3a:6,  ftm:0, fta:0  },
    ],
  },
  {
    id: "id_1773699023526_kygd1", date: "2026-03-08", opponent: "Skillountia",
    home: false, result: "L", score: "57-60", league: "bc6",
    boxScore: [
      { pid:"p1",  min:14, pts:0,  reb:4,  orb:1, drb:3, ast:3, stl:0, blk:0, tov:0, pf:0, fgm:0,  fga:4,  fg3m:0, fg3a:2,  ftm:0, fta:0  },
      { pid:"p2",  min:31, pts:13, reb:10, orb:4, drb:6, ast:2, stl:1, blk:0, tov:0, pf:3, fgm:5,  fga:12, fg3m:3, fg3a:8,  ftm:0, fta:0  },
      { pid:"p4",  min:29, pts:0,  reb:3,  orb:2, drb:1, ast:1, stl:1, blk:0, tov:2, pf:3, fgm:0,  fga:10, fg3m:0, fg3a:3,  ftm:0, fta:2  },
      { pid:"p6",  min:17, pts:4,  reb:0,  orb:0, drb:0, ast:0, stl:1, blk:0, tov:2, pf:3, fgm:2,  fga:5,  fg3m:0, fg3a:1,  ftm:0, fta:0  },
      { pid:"p7",  min:25, pts:4,  reb:7,  orb:2, drb:5, ast:0, stl:1, blk:0, tov:0, pf:3, fgm:1,  fga:2,  fg3m:0, fg3a:0,  ftm:2, fta:4  },
      { pid:"p8",  min:27, pts:19, reb:4,  orb:1, drb:3, ast:2, stl:0, blk:0, tov:1, pf:3, fgm:8,  fga:17, fg3m:1, fg3a:3,  ftm:2, fta:4  },
      { pid:"p9",  min:27, pts:11, reb:8,  orb:1, drb:7, ast:2, stl:2, blk:0, tov:0, pf:3, fgm:5,  fga:13, fg3m:1, fg3a:2,  ftm:0, fta:4  },
      { pid:"p10", min:22, pts:6,  reb:4,  orb:4, drb:0, ast:1, stl:1, blk:10, tov:0, pf:2, fgm:2, fga:3,  fg3m:1, fg3a:1,  ftm:1, fta:2  },
      { pid:"p12", min:6,  pts:0,  reb:2,  orb:0, drb:2, ast:2, stl:0, blk:0, tov:0, pf:2, fgm:0,  fga:4,  fg3m:0, fg3a:3,  ftm:0, fta:0  },
    ],
  },
  {
    id: "id_1773698831400_qcqnf", date: "2026-03-14", opponent: "Cappuccino Knights",
    home: false, result: "L", score: "53-60", league: "bc6",
    boxScore: [
      { pid:"p1",  min:8,  pts:0,  reb:1,  orb:0, drb:1, ast:1, stl:0, blk:0, tov:1, pf:0, fgm:0,  fga:2,  fg3m:0, fg3a:1,  ftm:0, fta:0  },
      { pid:"p2",  min:30, pts:6,  reb:4,  orb:1, drb:3, ast:4, stl:1, blk:0, tov:1, pf:3, fgm:2,  fga:13, fg3m:2, fg3a:10, ftm:0, fta:0  },
      { pid:"p3",  min:20, pts:2,  reb:6,  orb:3, drb:3, ast:2, stl:1, blk:0, tov:0, pf:3, fgm:0,  fga:2,  fg3m:0, fg3a:0,  ftm:2, fta:2  },
      { pid:"p4",  min:28, pts:6,  reb:1,  orb:0, drb:1, ast:2, stl:0, blk:0, tov:0, pf:4, fgm:3,  fga:10, fg3m:0, fg3a:4,  ftm:0, fta:0  },
      { pid:"p8",  min:21, pts:4,  reb:6,  orb:5, drb:1, ast:1, stl:1, blk:0, tov:0, pf:4, fgm:2,  fga:13, fg3m:0, fg3a:2,  ftm:0, fta:2  },
      { pid:"p9",  min:30, pts:17, reb:7,  orb:5, drb:2, ast:2, stl:2, blk:0, tov:0, pf:1, fgm:8,  fga:20, fg3m:0, fg3a:4,  ftm:1, fta:4  },
      { pid:"p10", min:23, pts:0,  reb:11, orb:3, drb:8, ast:2, stl:3, blk:0, tov:1, pf:3, fgm:0,  fga:4,  fg3m:0, fg3a:0,  ftm:0, fta:0  },
      { pid:"p12", min:10, pts:0,  reb:0,  orb:0, drb:0, ast:0, stl:1, blk:0, tov:0, pf:2, fgm:0,  fga:3,  fg3m:0, fg3a:2,  ftm:0, fta:0  },
      { pid:"p13", min:29, pts:18, reb:6,  orb:0, drb:6, ast:1, stl:0, blk:0, tov:1, pf:1, fgm:7,  fga:19, fg3m:4, fg3a:11, ftm:0, fta:0  },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function calcEff({ pts=0, reb=0, ast=0, stl=0, blk=0, tov=0, fgm=0, fga=0, ftm=0, fta=0 }) {
  return Math.round(pts + reb + ast + stl + blk - (fga - fgm) - (fta - ftm) - tov);
}

function calcTsPct({ pts=0, fga=0, fta=0 }) {
  const denom = 2 * (fga + 0.44 * fta);
  return denom > 0 ? +((pts / denom) * 100).toFixed(1) : 0;
}

function pct(made, attempted) {
  return attempted > 0 ? +((made / attempted) * 100).toFixed(1) : 0;
}

// ─── Main seed ────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Starting seed...");

  // 1. Season
  const season = await prisma.season.create({
    data: { name: "2025-26", year: 2025 },
  });
  console.log(`✅ Season: ${season.name}`);

  // 2. Leagues — add more here in future seasons, nothing else changes
  const leagueData = [
    { slug: "wintercup", name: "Winter Cup",  organizer: "Basket City", level: "Amateur" },
    { slug: "bc6",       name: "BC6",         organizer: "Basket City", level: "Amateur" },
  ];
  const leagues = {};
  for (const l of leagueData) {
    leagues[l.slug] = await prisma.league.create({ data: l });
  }
  console.log(`✅ Leagues: ${Object.keys(leagues).join(", ")}`);

  // 3. SeasonLeagues — one per league per season
  const seasonLeagues = {};
  for (const [slug, league] of Object.entries(leagues)) {
    seasonLeagues[slug] = await prisma.seasonLeague.create({
      data: { seasonId: season.id, leagueId: league.id },
    });
  }
  console.log(`✅ SeasonLeagues created`);

  // 4. Players — slugs generated from names
  const playerMap = {}; // old pid → new Prisma id
  for (const p of RAW_PLAYERS) {
    const created = await prisma.player.create({
      data: {
        slug:     slugify(p.name),
        name:     p.name,
        number:   p.number,
        position: p.position,
        isActive: true,
      },
    });
    playerMap[p.id] = created.id;

    // Roster entry for every SeasonLeague
    for (const sl of Object.values(seasonLeagues)) {
      await prisma.rosterEntry.create({
        data: { playerId: created.id, seasonLeagueId: sl.id, isActive: true },
      });
    }
  }
  console.log(`✅ Players: ${RAW_PLAYERS.length}`);

  // 5. Games + PlayerGameStats
  let gameCount = 0;
  let statCount = 0;

  for (const g of RAW_GAMES) {
    const [teamScore, opponentScore] = g.score.split("-").map(Number);
    const sl = seasonLeagues[g.league];

    const game = await prisma.game.create({
      data: {
        seasonLeagueId: sl.id,
        opponent:       g.opponent,
        location:       g.home ? "home" : "away",
        teamScore,
        opponentScore,
        result:         g.result,
        playedOn:       new Date(g.date),
      },
    });
    gameCount++;

    for (const row of g.boxScore) {
      const playerId = playerMap[row.pid];
      if (!playerId) continue;

      await prisma.playerGameStat.create({
        data: {
          playerId,
          gameId:    game.id,
          minutes:   row.min,
          pts:       row.pts,
          reb:       row.reb,
          orb:       row.orb,
          drb:       row.drb,
          ast:       row.ast,
          stl:       row.stl,
          blk:       row.blk,
          tov:       row.tov,   // ← fixed
          pf:        row.pf,
          fgm:       row.fgm,
          fga:       row.fga,
          fg2m:      row.fg2m ?? (row.fgm - row.fg3m),
          fg2a:      row.fg2a ?? (row.fga - row.fg3a),
          fg3m:      row.fg3m,  // ← fixed
          fg3a:      row.fg3a,  // ← fixed
          ftm:       row.ftm,
          fta:       row.fta,
          plusMinus: 0,
        },
      });
      statCount++;
    }
  }
  console.log(`✅ Games: ${gameCount}, PlayerGameStats: ${statCount}`);

  // 6. PlayerSeasonAggregates — computed from raw stats per player per SeasonLeague
  let aggCount = 0;

  for (const [slSlug, sl] of Object.entries(seasonLeagues)) {
    // Get all games for this SeasonLeague
    const slGames = await prisma.game.findMany({
      where: { seasonLeagueId: sl.id },
      include: { playerStats: true },
    });

    for (const rawPlayer of RAW_PLAYERS) {
      const playerId = playerMap[rawPlayer.id];

      // Collect all stat rows for this player across all games in this SeasonLeague
      const rows = slGames
        .flatMap(g => g.playerStats)
        .filter(r => r.playerId === playerId && r.minutes > 0);

      const gp = rows.length;
      if (gp === 0) continue;

      const sum = key => rows.reduce((a, r) => a + (r[key] || 0), 0);
      const avg = key => +(sum(key) / gp).toFixed(2);

      const totalFgm  = sum("fgm");
      const totalFga  = sum("fga");
      const totalFg3m = sum("fg3m");
      const totalFg3a = sum("fg3a");
      const totalFtm  = sum("ftm");
      const totalFta  = sum("fta");
      const totalPts  = sum("pts");
      const totalReb  = sum("reb");
      const totalAst  = sum("ast");

      const tsPctVal  = calcTsPct({ pts: totalPts, fga: totalFga, fta: totalFta });

      await prisma.playerSeasonAggregate.create({
        data: {
          playerId,
          seasonLeagueId: sl.id,
          gp,
          ptsAvg:     avg("pts"),
          rebAvg:     avg("reb"),
          orbAvg:     avg("orb"),
          drbAvg:     avg("drb"),
          astAvg:     avg("ast"),
          stlAvg:     avg("stl"),
          blkAvg:     avg("blk"),
          toAvg:      avg("tov"),
          pfAvg:      avg("pf"),
          minutesAvg: avg("minutes"),
          fgPct:      pct(totalFgm,  totalFga),
          fg2Pct:     pct(sum("fg2m"), sum("fg2a")),
          fg3Pct:     pct(totalFg3m, totalFg3a),
          ftPct:      pct(totalFtm,  totalFta),
          tsPct:      tsPctVal,
          ptsTotal:   totalPts,
          rebTotal:   totalReb,
          astTotal:   totalAst,
        },
      });
      aggCount++;
    }
  }
  console.log(`✅ PlayerSeasonAggregates: ${aggCount}`);
  console.log("🏀 Seed complete.");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
