import type { NewProcess, Process, ProcessCode } from '@/domain'

/** Библиотека процессов (PRD 9). */
export interface ProcessService {
  listProcesses(): Promise<readonly Process[]>
  getProcess(code: ProcessCode): Promise<Process>
  /** Сохранить процесс в библиотеку (экран 09а); вернёт процесс с присвоенным кодом. */
  createProcess(input: NewProcess): Promise<Process>
}
