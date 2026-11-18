export type MigrationPhase = 'login' | 'preparing' | 'exporting' | 'downloading' | 'error'
export function migrationStep(): { phase: MigrationPhase; message?: string }
export function isNewArchive(name: string): boolean
export function renderMigrationOverlay(phase: MigrationPhase, message: string): void
