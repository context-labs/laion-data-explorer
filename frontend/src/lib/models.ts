// Stub for @kuzco/models
// This file contains minimal stubs to replace imports from the monorepo @kuzco/models package

export enum LogLevel {
  Debug = 0,
  Info = 1,
  Warn = 2,
  Error = 3,
  Fatal = 4,
}

export interface LogMessage {
  timestamp: string;
  level: LogLevel;
  message: string;
  header: string;
}

export const LINKS = {
  INFERENCE_DEVNET_STAKING_PROTOCOL_DOCUMENTATION:
    "https://docs.example.com/staking",
  // Add other links as needed
};
