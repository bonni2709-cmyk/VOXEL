export const IPC = {
  appInfo: 'app:info',
  systemInfo: 'system:info',
  profileGet: 'profile:get',
  profileSetName: 'profile:set-name',
  versionsList: 'versions:list',
  versionsInstalled: 'versions:installed',
  installStart: 'install:start',
  installCancel: 'install:cancel',
  launchStart: 'launch:start',
  launchStop: 'launch:stop',
  javaStatus: 'java:status',
  javaInstall: 'java:install',
  fabricInstall: 'fabric:install',
  worldsList: 'worlds:list',
  worldsBackup: 'worlds:backup',
  galleryList: 'gallery:list',
  modsSearch: 'mods:search',
  modsInstall: 'mods:install',
  modsList: 'mods:list',
  crashAnalyze: 'crash:analyze',
} as const;

/** События main → renderer. */
export const EVENTS = {
  installProgress: 'install:progress',
  launchLog: 'launch:log',
  launchExit: 'launch:exit',
} as const;
