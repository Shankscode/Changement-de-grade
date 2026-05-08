export interface VerificationChallengeResult {
  challengeId: number;
  brawlerName: string;
  expiresAt: Date;
}

export interface VerificationSuccess {
  discordUserId: string;
  brawlTag: string;
  brawlName: string;
  highestTrophies: number;
  gradeThreshold: number | null;
  wasTransfer: boolean;
  previousDiscordUserId: string | undefined;
}

export type ChallengeVerifyResult =
  | { status: 'success'; data: VerificationSuccess }
  | { status: 'wrong_brawler' }
  | { status: 'expired' }
  | { status: 'not_found' }
  | { status: 'already_verified' };
