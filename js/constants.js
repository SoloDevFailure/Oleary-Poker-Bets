const STORAGE_KEY = "poker-night-bets-v1";
const TAX_RATE = 0.1;
const PLAYER_MARKETS_REFRESH_MS = 10000;
const DEFAULT_SEED_POOL = 300;
const MARKET_TYPES = ["Winner", "TopThree", "TopThreeCombo", "BottomThreeCombo", "FirstOut", "LastLonger", "Knockout", "Chaos", "Custom"];
const FIXED_ODDS_MARKET_TYPES = ["Winner", "FirstOut", "Knockout", "LastLonger"];
const PROFILE_STATS = ["skill", "survivability", "volatility", "consistency", "recentForm", "aggression"];
const DEFAULT_PLAYER_PROFILES = [
  { playerId: "dan", playerName: "Dan", skill: 92, survivability: 88, volatility: 28, consistency: 92, recentForm: 88, aggression: 70 },
  { playerId: "dave", playerName: "Dave", skill: 90, survivability: 76, volatility: 72, consistency: 76, recentForm: 86, aggression: 88 },
  { playerId: "chris", playerName: "Chris", skill: 88, survivability: 82, volatility: 42, consistency: 84, recentForm: 80, aggression: 68 },
  { playerId: "wes", playerName: "Wes", skill: 86, survivability: 78, volatility: 76, consistency: 68, recentForm: 84, aggression: 78 },
  { playerId: "jamie", playerName: "Jamie", skill: 86, survivability: 72, volatility: 82, consistency: 62, recentForm: 92, aggression: 82 },
  { playerId: "damo", playerName: "Damo", skill: 85, survivability: 78, volatility: 65, consistency: 50, recentForm: 75, aggression: 72 },
  { playerId: "jeremy", playerName: "Jeremy", skill: 80, survivability: 88, volatility: 32, consistency: 78, recentForm: 74, aggression: 52 },
  { playerId: "tom", playerName: "Tom", skill: 78, survivability: 70, volatility: 74, consistency: 58, recentForm: 66, aggression: 72 },
  { playerId: "nic", playerName: "Nic", skill: 76, survivability: 72, volatility: 52, consistency: 66, recentForm: 62, aggression: 60 },
  { playerId: "aaron", playerName: "Aaron", skill: 72, survivability: 58, volatility: 84, consistency: 46, recentForm: 58, aggression: 78 },
  { playerId: "fletcher", playerName: "Fletcher", skill: 70, survivability: 64, volatility: 66, consistency: 52, recentForm: 60, aggression: 64 },
  { playerId: "ben", playerName: "Ben", skill: 68, survivability: 62, volatility: 68, consistency: 50, recentForm: 56, aggression: 62 },
];

const PLAYER_TAB_ORDER = ["markets", "bets", "analytics", "social", "profile"];
