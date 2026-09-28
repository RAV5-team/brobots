import type { NewProcess, Process, ProcessCode, ProcessDemoText, ProcessRequirements, ProcessTemplateDefaults } from '@/domain'

/** Библиотека процессов (PRD 9). */
export interface ProcessService {
  listProcesses(): Promise<readonly Process[]>
  getProcess(code: ProcessCode): Promise<Process>
  /** Сохранить процесс в библиотеку (экран 09а); вернёт процесс с присвоенным кодом. */
  createProcess(input: NewProcess): Promise<Process>
  /** Значения по умолчанию формы 09а и копии 16, которых нет в процессах и нормативах (PRD 15 · №22). */
  getTemplateDefaults(): Promise<ProcessTemplateDefaults>
  /** Тексты демо-заполнения формы 09а; экран запрашивает их только в демо-режиме. */
  getDemoText(): Promise<ProcessDemoText>
  /** Что процесс запрашивает у локации (PRD 9.3), без объёма потока. Нет процесса — `NotFoundError`. */
  getRequirements(code: ProcessCode): Promise<ProcessRequirements>
}
