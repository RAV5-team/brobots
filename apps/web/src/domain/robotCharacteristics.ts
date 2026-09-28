/**
 * Характеристики робота по шести группам ТЗ 3.3 — строки «Все технические характеристики» К-4 (16777:977, PRD 7.7).
 * Значения хранятся только там, где их нельзя вывести из полей робота (D-76); подписи — в словаре.
 */
export const ROBOT_CHARACTERISTIC_GROUPS = {
  identification: ['manufacturer', 'id', 'solutionType', 'operationClasses', 'origin', 'availability'],
  technical: ['payload', 'dimensions', 'speed', 'productivity', 'autonomy', 'positioningAccuracy', 'navigation', 'operatingConditions'],
  infrastructure: ['aisleRequirements', 'floorRequirements', 'charging', 'connectivity', 'integration', 'service'],
  economics: ['equipmentPrice', 'software', 'implementation', 'maintenance', 'acquisitionModel', 'serviceLife'],
  applicability: ['supportedProcesses', 'facilityTypes', 'limitations', 'cases'],
  dataQuality: ['dataSource', 'sourceLink', 'actualizedAt'],
} as const

export type RobotCharacteristicGroup = keyof typeof ROBOT_CHARACTERISTIC_GROUPS

/** Температура — только в блоке «Требования к объекту» (16777:878); в группах она внутри «Допустимых условий эксплуатации». */
export type RobotCharacteristicKey = (typeof ROBOT_CHARACTERISTIC_GROUPS)[RobotCharacteristicGroup][number] | 'temperature'

/**
 * Блок «Требования к объекту» К-4 (16777:854): те же записи, что в группе «Инфраструктура», плюс температура —
 * одно значение на строку, без второй формулировки (D-76).
 */
export const SITE_REQUIREMENT_KEYS: readonly RobotCharacteristicKey[] = [
  'aisleRequirements', 'floorRequirements', 'connectivity', 'temperature', 'charging', 'integration',
]

/**
 * Ключевые ТТХ для плитки «N из M ключевых ТТХ подтверждено» (D-77): технические параметры, от которых зависит подбор
 * и симуляция. На макете у AMR 800 — «7 из 8».
 */
export const KEY_SPEC_KEYS: readonly RobotCharacteristicKey[] = [
  'payload', 'dimensions', 'speed', 'productivity', 'autonomy', 'positioningAccuracy', 'navigation', 'operatingConditions',
]

/**
 * Поля, по которым считаются «Полнота X из Y полей» и «N подтверждено · N оценка · N нет данных» (D-77):
 * пять содержательных групп. «Качество данных» — сведения о данных, а не характеристики, и в счёт не входят.
 */
export const COMPLETENESS_GROUPS: readonly RobotCharacteristicGroup[] = [
  'identification', 'technical', 'infrastructure', 'economics', 'applicability',
]
