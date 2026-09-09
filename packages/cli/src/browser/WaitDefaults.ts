/** 操作とシナリオに共通の時間設定。 */
export const WaitDefaults = {
  readyTimeoutMilliseconds: 5000,
  settleMilliseconds: 150,
  settleTimeoutMilliseconds: 10000,
  scenarioTimeoutMilliseconds: 900000,
  pollMilliseconds: 25,
  gestureMilliseconds: 300,
} as const;
